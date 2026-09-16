/**
 * MaurEdge 3.0 — Feature Engine
 * Converts raw market data into derived features for AI reasoning.
 * Deterministic — no randomness, no AI calls.
 */

/**
 * Compute all features from raw market data.
 * @param {object} snapshot - Normalized market data from DexScreener
 * @returns {object} Feature set
 */
function computeFeatures(snapshot) {
  return {
    ...computeMomentum(snapshot),
    ...computeFlow(snapshot),
    ...computeVolume(snapshot),
    ...computeLiquidity(snapshot),
    ...computeValuation(snapshot),
    ...computeAge(snapshot),
    ...computeVolatility(snapshot),
  };
}

function computeMomentum(s) {
  return {
    momentum_5m: s.momentum_5m || 0,
    momentum_1h: s.momentum_1h || 0,
    momentum_6h: s.momentum_6h || 0,
    momentum_24h: s.momentum_24h || 0,
    momentum_composite: weightedAvg(
      [s.momentum_5m, s.momentum_1h, s.momentum_6h, s.momentum_24h],
      [0.4, 0.3, 0.2, 0.1]
    ),
    momentum_direction: s.momentum_5m > 0 && s.momentum_1h > 0 ? 'up' : s.momentum_5m < 0 && s.momentum_1h < 0 ? 'down' : 'mixed',
  };
}

function computeFlow(s) {
  const buys = s.buys_5m || 0;
  const sells = s.sells_5m || 0;
  const total = buys + sells;
  return {
    buys_5m: buys,
    sells_5m: sells,
    buy_pressure: s.buy_pressure || 0,
    buy_dominance: total > 0 ? (buys / total) * 100 : 0,
    transaction_count: total,
    buy_sell_gap: buys - sells,
    flow_signal: buys > sells * 2 ? 'strong_buy' : buys > sells ? 'buy' : sells > buys * 2 ? 'strong_sell' : sells > buys ? 'sell' : 'neutral',
  };
}

function computeVolume(s) {
  const vol5m = s.volume_5m || 0;
  const vol1h = s.volume_1h || 0;
  const expected5m = vol1h / 12;
  return {
    volume_5m: vol5m,
    volume_1h: vol1h,
    volume_24h: s.volume_24h || 0,
    volume_acceleration: expected5m > 0 ? vol5m / expected5m : 0,
    volume_relative_1h: vol1h > 0 ? vol5m / (vol1h / 12) : 0,
    volume_explosion: vol5m > expected5m * 3,
  };
}

function computeLiquidity(s) {
  const liq = s.liquidity_usd || 0;
  return {
    liquidity_usd: liq,
    liquidity_tier: liq > 100000 ? 'high' : liq > 20000 ? 'medium' : liq > 5000 ? 'low' : 'danger',
    liquidityadequate: liq >= 5000,
  };
}

function computeValuation(s) {
  const fdv = s.fdv_usd || 0;
  const liq = s.liquidity_usd || 1;
  return {
    fdv_usd: fdv,
    fdv_tier: fdv < 50000 ? 'micro' : fdv < 500000 ? 'small' : fdv < 5000000 ? 'mid' : fdv < 50000000 ? 'large' : 'mega',
    fdv_liquidity_ratio: liq > 0 ? fdv / liq : 999,
    sweet_spot_fdv: fdv > 10000 && fdv < 5000000,
  };
}

function computeAge(s) {
  const mins = s.age_minutes;
  return {
    age_minutes: mins,
    age_hours: mins ? mins / 60 : null,
    age_tier: mins == null ? 'unknown' : mins < 60 ? 'fresh' : mins < 360 ? 'new' : mins < 1440 ? 'young' : 'mature',
    is_new_launch: mins != null && mins < 360,
  };
}

function computeVolatility(s) {
  const m5 = Math.abs(s.momentum_5m || 0);
  const h1 = Math.abs(s.momentum_1h || 0);
  return {
    volatility_5m: m5,
    volatility_1h: h1,
    volatility_increasing: m5 > h1 / 12 * 1.5,
    volatility_tier: m5 > 10 ? 'extreme' : m5 > 5 ? 'high' : m5 > 2 ? 'moderate' : 'low',
  };
}

function weightedAvg(values, weights) {
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) {
      sum += values[i] * weights[i];
      weightSum += weights[i];
    }
  }
  return weightSum > 0 ? sum / weightSum : 0;
}

module.exports = { computeFeatures };
