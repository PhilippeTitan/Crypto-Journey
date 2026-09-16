/**
 * MaurEdge 3.0 — Autonomy Engine
 * Controls system mode, capital temperature, and escalation.
 * The AI can RECOMMEND mode changes — the policy engine DECIDES.
 */

const MODES = ['soft', 'normal', 'aggressive', 'protect', 'preserve', 'emergency'];

const MODE_DESCRIPTIONS = {
  soft: 'High signal threshold, low exposure, few trades, prefer WAIT',
  normal: 'Standard opportunity threshold and position sizing',
  aggressive: 'Faster reaction, higher exposure, stronger pursuit of momentum',
  protect: 'Reduce exposure, tighten risk, preserve gains',
  preserve: 'No new exposure, prefer HOLD/WAIT, require stronger evidence',
  emergency: 'STOP NEW TRADES, MONITOR EXISTING, ALERT HUMAN',
};

// ============================================
// MODE TRANSITIONS
// ============================================

const ALLOWED_TRANSITIONS = {
  soft: ['normal', 'protect'],
  normal: ['soft', 'aggressive', 'protect', 'preserve'],
  aggressive: ['normal', 'protect', 'preserve', 'emergency'],
  protect: ['soft', 'normal', 'preserve', 'emergency'],
  preserve: ['soft', 'normal', 'emergency'],
  emergency: ['preserve', 'soft', 'normal'],
};

/**
 * Evaluate whether a mode transition is allowed.
 */
function canTransition(from, to) {
  if (!MODES.includes(from) || !MODES.includes(to)) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================
// CAPITAL TEMPERATURE
// ============================================

/**
 * Calculate market heat from regime data.
 */
function marketTemperature(regime) {
  const heat = regime?.heat_score || 0;
  if (heat <= 20) return 'COLD';
  if (heat <= 40) return 'COOL';
  if (heat <= 60) return 'WARM';
  if (heat <= 80) return 'HOT';
  return 'BLAZING';
}

/**
 * Calculate portfolio heat from positions and capital.
 */
function portfolioTemperature(positions, totalCapital, config = {}) {
  const deployed = positions
    .filter((p) => p.status === 'open')
    .reduce((sum, p) => sum + (parseFloat(p.current_value || p.entry_value) || 0), 0);

  const exposurePct = totalCapital > 0 ? (deployed / totalCapital) * 100 : 0;

  if (exposurePct > 80) return { temp: 'HOT', exposure_pct: exposurePct };
  if (exposurePct > 50) return { temp: 'WARM', exposure_pct: exposurePct };
  if (exposurePct > 20) return { temp: 'COOL', exposure_pct: exposurePct };
  return { temp: 'COLD', exposure_pct: exposurePct };
}

// ============================================
// OPPORTUNITY COST
// ============================================

/**
 * Compare current position quality against best available opportunity.
 */
function capitalRotationScore(currentPosition, bestOpportunity) {
  if (!currentPosition || !bestOpportunity) return 0;
  const currentPnl = currentPosition.unrealized_pnl_pct || 0;
  const oppScore = bestOpportunity.score || 0;
  // Simple rotation signal: positive = rotate, negative = hold
  return (oppScore / 100) * 50 - (currentPnl / 10) * 50;
}

// ============================================
// ESCALATION LOGIC
// ============================================

/**
 * Determine if capital has become significant and requires human approval.
 */
function shouldEscalate(portfolio, mission, config = {}) {
  const thresholds = {
    absolute: config.escalation_absolute || 100,
    pct_of_target: config.escalation_pct_of_target || 10,
    recent_growth: config.escalation_recent_growth || 200,
  };

  const value = portfolio.total_value || 0;
  const target = mission?.target_capital || 10000;

  if (value >= thresholds.absolute) return { escalate: true, reason: `Capital reached $${value.toFixed(2)} (threshold: $${thresholds.absolute})` };
  if (mission && value / target * 100 >= thresholds.pct_of_target) {
    return { escalate: true, reason: `Reached ${(value / target * 100).toFixed(1)}% of target` };
  }

  return { escalate: false };
}

/**
 * Apply autonomy policy to an AI decision.
 * Returns the decision (possibly modified) or null if rejected.
 */
function applyPolicy(decision, currentState, mission) {
  const mode = currentState?.mode || 'normal';

  // Emergency blocks everything except HOLD and WAIT
  if (mode === 'emergency' && !['HOLD', 'WAIT', 'ESCALATE'].includes(decision.action)) {
    return { ...decision, action: 'WAIT', reason: `EMERGENCY mode: ${decision.reason}`, overridden: true };
  }

  // Preserve requires confirmation for new trades
  if (mode === 'preserve' && ['BUY', 'ROTATE'].includes(decision.action)) {
    return { ...decision, requires_confirmation: true, reason: `PRESERVE mode: ${decision.reason}` };
  }

  // Soft mode blocks aggressive actions
  if (mode === 'soft' && ['ROTATE', 'PARTIAL_BUY'].includes(decision.action)) {
    if (decision.confidence < 0.8) {
      return { ...decision, action: 'WAIT', reason: `SOFT mode, low confidence: ${decision.reason}`, overridden: true };
    }
  }

  return decision;
}

module.exports = {
  MODES,
  MODE_DESCRIPTIONS,
  canTransition,
  marketTemperature,
  portfolioTemperature,
  capitalRotationScore,
  shouldEscalate,
  applyPolicy,
};
