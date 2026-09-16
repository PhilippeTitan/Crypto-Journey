/**
 * MaurEdge 3.0 — Autonomous Loop
 * The primary cycle that runs continuously in the cloud.
 *
 * WAKE → LOAD STATE → COLLECT DATA → COMPUTE → DECIDE → ACT → REPEAT
 */

const db = require('../lib/db');
const dexscreener = require('../lib/dexscreener');
const { computeFeatures } = require('../market/features');
const { detectRegime } = require('../intelligence/regime');
const { discover } = require('../discovery/opportunity');
const { createProvider, loadAIConfig, validateDecision, buildContext } = require('../intelligence/ai-provider');
const { applyPolicy, shouldEscalate, marketTemperature, portfolioTemperature, canTransition } = require('../autonomy/engine');
const { validateDecision: riskValidate, checkCircuitBreakers } = require('../risk/engine');
const { monitorPositions, closePositionBySell } = require('../positions/engine');
const { execute } = require('../execution/engine');
const { openPosition } = require('../positions/engine');

const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL_MS || '30000');

/**
 * Run one cycle of the autonomous loop.
 */
async function runCycle(provider) {
  const cycleId = crypto.randomUUID();
  const cycleStart = Date.now();

  try {
    // ═══════════════════════════════════════════
    // 1. LOAD STATE
    // ═══════════════════════════════════════════
    const mission = await db.getActiveMission();
    const positions = await db.getOpenPositions();
    const autonomyState = await db.getAutonomyState();

    // Check circuit breakers
    const breakers = checkCircuitBreakers({
      repeated_tx_failures: 0,
      wallet_balance_mismatch: false,
      data_provider_failed: false,
      extreme_slippage: false,
      database_unavailable: false,
    });
    if (breakers.length > 0) {
      await db.logEvent('CIRCUIT_BREAKER', 'Breakers triggered', { breakers }, 'critical', cycleId);
      if (autonomyState && canTransition(autonomyState.mode, 'emergency')) {
        await db.updateAutonomyState({ mode: 'emergency' });
      }
      return { cycleId, status: 'circuit_breaker', breakers };
    }

    // ═══════════════════════════════════════════
    // 2. MONITOR EXISTING POSITIONS
    // ═══════════════════════════════════════════
    const positionActions = await monitorPositions();
    for (const pa of positionActions) {
      if (pa.action === 'SELL') {
        await db.logEvent('POSITION_EXIT_SIGNAL', pa.reason, { position: pa.position, type: pa.type }, 'info', cycleId);
        const result = await closePositionBySell(pa.position, pa.reason);
        if (!result.success) {
          await db.logError('position_engine', 'SELL_FAILED', `Failed to close ${pa.position.token}: ${result.error}`);
        }
      }
    }

    // ═══════════════════════════════════════════
    // 3. DISCOVER OPPORTUNITIES
    // ═══════════════════════════════════════════
    await db.logEvent('CYCLE_STARTED', `Cycle ${cycleId.slice(0, 8)}`, null, 'info', cycleId);

    const { tradeable, total, qualified } = await discover();

    // ═══════════════════════════════════════════
    // 4. DETECT MARKET REGIME
    // ═══════════════════════════════════════════
    const regimeInputs = tradeable.map((t) => t.features || computeFeatures(t));
    const regime = detectRegime(regimeInputs);
    await db.insert('market_regimes', {
      heat_score: regime.heat_score,
      regime: regime.regime,
      opportunity_count: regime.opportunity_count,
      inputs_json: JSON.stringify(regime.inputs_json),
      cycle_id: cycleId,
    }).catch(() => {});

    const marketTemp = marketTemperature(regime);

    // ═══════════════════════════════════════════
    // 5. BUILD PORTFOLIO CONTEXT
    // ═══════════════════════════════════════════
    const portfolioTemp = portfolioTemperature(positions, parseFloat(mission?.starting_capital || 12.35));
    const cashAvailable = portfolioTemp.exposure_pct < 100 ? parseFloat(mission?.starting_capital || 12.35) * (1 - portfolioTemp.exposure_pct / 100) : 0;

    const context = buildContext({
      mission,
      portfolio: {
        total_value: parseFloat(mission?.starting_capital || 12.35),
        cash_available: cashAvailable,
        exposure_pct: portfolioTemp.exposure_pct,
        portfolio_temp: portfolioTemp.temp,
      },
      positions,
      regime,
      opportunities: tradeable.slice(0, 5),
      recentTrades: [],
      recentFailures: [],
      health: { open_positions: positions.length, cycle_time_ms: Date.now() - cycleStart },
      autonomyPolicy: { mode: autonomyState?.mode || 'normal', market_temp: marketTemp },
    });

    // ═══════════════════════════════════════════
    // 6. ASK AI
    // ═══════════════════════════════════════════
    let rawDecision = null;
    let aiUsage = null;

    if (provider) {
      try {
        const result = await provider.decide(context);
        if (result) {
          rawDecision = result.decision;
          aiUsage = result.usage;
        }
      } catch (err) {
        await db.logError('ai_provider', 'AI_CALL_FAILED', err.message, err.stack);
      }
    }

    // Fallback: if AI unavailable, default to WAIT
    if (!rawDecision) {
      rawDecision = { action: 'WAIT', confidence: 0.5, reason: 'AI unavailable — defaulting to WAIT' };
    }

    // ═══════════════════════════════════════════
    // 7. VALIDATE & POLICY CHECK
    // ═══════════════════════════════════════════
    const validation = validateDecision(rawDecision);
    if (!validation.valid) {
      await db.logEvent('AI_REJECTED', `Invalid AI decision: ${validation.error}`, rawDecision, 'warning', cycleId);
      rawDecision = { action: 'WAIT', confidence: 0.5, reason: `AI output invalid: ${validation.error}` };
    }

    const policyDecision = applyPolicy(rawDecision, autonomyState, mission);

    // ═══════════════════════════════════════════
    // 8. RISK CHECK
    // ═══════════════════════════════════════════
    const riskResult = riskValidate(policyDecision, {
      daily_pnl_pct: autonomyState?.daily_pnl || 0,
      consecutive_losses: autonomyState?.consecutive_losses || 0,
      open_positions: positions,
      cash_available: cashAvailable,
      opportunities: tradeable,
    });

    if (!riskResult.approved) {
      await db.logEvent('RISK_REJECTED', riskResult.reason, policyDecision, 'warning', cycleId);
      if (riskResult.action_override) {
        policyDecision.action = riskResult.action_override;
      } else {
        policyDecision.action = 'WAIT';
        policyDecision.reason = `Risk rejection: ${riskResult.reason}`;
      }
    }

    // ═══════════════════════════════════════════
    // 9. STORE AI DECISION
    // ═══════════════════════════════════════════
    const decisionRecord = await db.insert('ai_decisions', {
      provider: currentConfig?.provider || 'openai',
      model: currentConfig?.model || 'gpt-4o',
      context_json: JSON.stringify(context),
      decision_json: JSON.stringify(policyDecision),
      action: policyDecision.action,
      confidence: policyDecision.confidence,
      requires_confirmation: policyDecision.requires_confirmation || false,
      reason: policyDecision.reason,
    }).catch(() => null);

    await db.updateAutonomyState({
      last_decision_action: policyDecision.action,
      last_decision_at: new Date().toISOString(),
    });

    // ═══════════════════════════════════════════
    // 10. EXECUTE
    // ═══════════════════════════════════════════
    let executionResult = null;

    switch (policyDecision.action) {
      case 'BUY': {
        if (policyDecision.candidate) {
          const opp = tradeable.find((t) => t.token === policyDecision.candidate);
          if (opp) {
            executionResult = await execute({
              token: opp.token,
              address: opp.address,
              action: 'BUY',
              amount: Math.min(cashAvailable * 0.8, parseFloat(mission?.starting_capital || 12.35) * 0.8),
            });
            if (executionResult.success) {
              await openPosition({
                token: opp.token,
                address: opp.address,
                entryPrice: opp.price,
                entryValue: executionResult.data?.outputValue || 0,
                quantity: executionResult.data?.outputAmount || 0,
                tpPct: policyDecision.position_plan?.take_profit_pct || 10,
                slPct: policyDecision.position_plan?.stop_loss_pct || 5,
                trailingPct: policyDecision.position_plan?.trailing_stop_pct || 3,
              });
            }
          }
        }
        break;
      }
      case 'ROTATE': {
        // Sell source, buy destination
        if (policyDecision.candidate && policyDecision.allocation) {
          const sourcePos = positions.find((p) => p.token === policyDecision.allocation.source_token);
          if (sourcePos) {
            const sellResult = await closePositionBySell(sourcePos, 'ROTATE');
            if (sellResult.success) {
              const opp = tradeable.find((t) => t.token === policyDecision.candidate);
              if (opp) {
                const buyAmount = parseFloat(sellResult.data?.outputValue || 0) * (policyDecision.allocation.destination_fraction || 0.5);
                executionResult = await execute({
                  token: opp.token,
                  address: opp.address,
                  action: 'BUY',
                  amount: buyAmount,
                });
              }
            }
          }
        }
        break;
      }
      case 'WAIT':
      case 'HOLD':
      case 'ESCALATE': {
        // No execution needed
        break;
      }
    }

    // ═══════════════════════════════════════════
    // 11. LOG & RECONCILE
    // ═══════════════════════════════════════════
    await db.logEvent('CYCLE_COMPLETED', `Cycle ${cycleId.slice(0, 8)}: ${policyDecision.action}`, {
      regime: regime.regime,
      heat: regime.heat_score,
      action: policyDecision.action,
      confidence: policyDecision.confidence,
      candidates_found: tradeable.length,
      cycle_ms: Date.now() - cycleStart,
    }, 'info', cycleId);

    return {
      cycleId,
      status: 'completed',
      regime: regime.regime,
      heat: regime.heat_score,
      action: policyDecision.action,
      confidence: policyDecision.confidence,
      candidates: tradeable.length,
      cycle_ms: Date.now() - cycleStart,
    };
  } catch (err) {
    await db.logError('autonomous_loop', 'CYCLE_FAILED', err.message, err.stack);
    return { cycleId, status: 'error', error: err.message };
  }
}

/**
 * Continuous autonomous loop.
 */
async function startLoop() {
  console.log('🔄 MaurEdge 3.0 — Autonomous Loop Starting...\n');

  // Load AI config from DB (with env var fallback)
  let currentConfig = null;
  let provider = null;

  async function refreshProvider() {
    try {
      currentConfig = await loadAIConfig({ query: db.query });
      if (currentConfig.apiKey) {
        provider = createProvider(currentConfig.provider, {
          apiKey: currentConfig.apiKey,
          model: currentConfig.model,
        });
        console.log(`   🤖 AI: ${currentConfig.provider} / ${currentConfig.model}`);
      } else {
        console.log('   ⚠️  No AI API key configured — will default to WAIT');
        provider = null;
      }
    } catch {
      console.log('   ⚠️  Could not load AI config — defaulting to WAIT');
      provider = null;
    }
  }

  await refreshProvider();

  let cycleCount = 0;
  while (true) {
    cycleCount++;
    console.log(`\n⏳ Cycle #${cycleCount} — ${new Date().toLocaleTimeString()}`);

    // Refresh provider every 10 cycles (5 min at 30s interval) to pick up config changes
    if (cycleCount % 10 === 0) await refreshProvider();

    const result = await runCycle(provider);
    console.log(`   ✅ ${result.action || 'error'} | Regime: ${result.regime} | Heat: ${result.heat} | ${result.cycle_ms}ms`);

    const interval = parseInt(process.env.SCAN_INTERVAL_MS || '30000');
    await sleep(interval);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { runCycle, startLoop };
