/**
 * MaurEdge 3.0 — Risk Engine
 * Independent validation layer.
 * AI proposes, Risk disposes.
 */

const DEFAULT_LIMITS = {
  max_position_pct: 80,
  max_daily_loss_pct: 20,
  max_consecutive_losses: 5,
  min_liquidity_usd: 5000,
  min_buy_pressure: 1.5,
  min_confidence: 0.5,
  gas_reserve_usdt: 0.50,
  max_slippage_pct: 5,
  max_simultaneous_positions: 3,
  emergency_drawdown_pct: 30,
};

/**
 * Validate a proposed decision against risk limits.
 * @returns {{ approved: boolean, reason: string, adjustedDecision: object|null }}
 */
function validateDecision(decision, state, limits = {}) {
  const L = { ...DEFAULT_LIMITS, ...limits };

  // WAIT and HOLD always pass
  if (['WAIT', 'HOLD', 'ESCALATE'].includes(decision.action)) {
    return { approved: true, reason: `${decision.action} requires no risk check` };
  }

  // Check confidence threshold
  if (decision.confidence < L.min_confidence) {
    return { approved: false, reason: `Confidence ${decision.confidence} below minimum ${L.min_confidence}` };
  }

  // Check daily loss limit
  if (state.daily_pnl_pct && state.daily_pnl_pct < -L.max_daily_loss_pct) {
    return { approved: false, reason: `Daily loss ${state.daily_pnl_pct}% exceeds limit -${L.max_daily_loss_pct}%` };
  }

  // Check consecutive losses
  if (state.consecutive_losses >= L.max_consecutive_losses) {
    return { approved: false, reason: `${state.consecutive_losses} consecutive losses exceeds limit ${L.max_consecutive_losses}` };
  }

  // Check simultaneous positions
  if (['BUY', 'ROTATE'].includes(decision.action)) {
    const openCount = state.open_positions?.length || 0;
    if (openCount >= L.max_simultaneous_positions) {
      return { approved: false, reason: `${openCount} open positions exceeds max ${L.max_simultaneous_positions}` };
    }
  }

  // Check liquidity for BUY
  if (decision.action === 'BUY' && decision.candidate) {
    const opp = (state.opportunities || []).find((o) => o.token === decision.candidate);
    if (opp && opp.liquidity_usd < L.min_liquidity_usd) {
      return { approved: false, reason: `Liquidity $${opp.liquidity_usd} below minimum $${L.min_liquidity_usd}` };
    }
    if (opp && opp.buy_pressure < L.min_buy_pressure) {
      return { approved: false, reason: `Buy pressure ${opp.buy_pressure} below minimum ${L.min_buy_pressure}` };
    }
  }

  // Check gas reserve
  if (state.cash_available != null && state.cash_available < L.gas_reserve_usdt) {
    return { approved: false, reason: `Cash $${state.cash_available} below gas reserve $${L.gas_reserve_usdt}` };
  }

  // Check drawdown for emergency
  if (state.drawdown_pct && state.drawdown_pct > L.emergency_drawdown_pct) {
    return {
      approved: false,
      reason: `Drawdown ${state.drawdown_pct}% exceeds emergency threshold ${L.emergency_drawdown_pct}%`,
      action_override: 'ESCALATE',
    };
  }

  return { approved: true, reason: 'Risk checks passed' };
}

/**
 * Circuit breaker conditions.
 * Returns triggered breakers or empty array.
 */
function checkCircuitBreakers(state) {
  const breakers = [];

  if (state.repeated_tx_failures >= 3) {
    breakers.push({ type: 'TX_FAILURE', message: `${state.repeated_tx_failures} consecutive transaction failures` });
  }

  if (state.wallet_balance_mismatch) {
    breakers.push({ type: 'WALLET_MISMATCH', message: 'Wallet balance does not match expected state' });
  }

  if (state.data_provider_failed) {
    breakers.push({ type: 'DATA_FAILURE', message: 'Market data provider unavailable' });
  }

  if (state.extreme_slippage) {
    breakers.push({ type: 'SLIPPAGE', message: 'Extreme slippage detected on execution' });
  }

  if (state.database_unavailable) {
    breakers.push({ type: 'DB_UNAVAILABLE', message: 'Database connection lost' });
  }

  return breakers;
}

module.exports = { validateDecision, checkCircuitBreakers, DEFAULT_LIMITS };
