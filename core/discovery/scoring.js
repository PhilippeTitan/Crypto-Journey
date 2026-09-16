/**
 * MaurEdge 3.0 — Scoring Engine
 * Configurable scoring based on the Rising Star methodology.
 * Weights loaded from config, not hardcoded.
 */

const DEFAULT_WEIGHTS = {
  newness: 50,
  buy_pressure: 40,
  volume_explosion: 30,
  momentum: 35,
  fdv: 15,
  liquidity: 15,
  activity: 10,
  insider: 20,
};

/**
 * Score a token for opportunity potential.
 * @param {object} features - Feature set from computeFeatures()
 * @param {object} weights - Override weights (optional)
 * @returns {{ score: number, signals: string[], breakdown: object }}
 */
function scoreOpportunity(features, weights = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  let score = 0;
  const signals = [];
  const breakdown = {};

  // 1. NEWNESS
  const newnessScore = scoreNewness(features, w);
  score += newnessScore.points;
  if (newnessScore.signal) signals.push(newnessScore.signal);
  breakdown.newness = newnessScore.points;

  // 2. BUY PRESSURE
  const flowScore = scoreFlow(features, w);
  score += flowScore.points;
  if (flowScore.signal) signals.push(flowScore.signal);
  breakdown.flow = flowScore.points;

  // 3. VOLUME
  const volumeScore = scoreVolume(features, w);
  score += volumeScore.points;
  if (volumeScore.signal) signals.push(volumeScore.signal);
  breakdown.volume = volumeScore.points;

  // 4. MOMENTUM
  const momentumScore = scoreMomentum(features, w);
  score += momentumScore.points;
  if (momentumScore.signal) signals.push(momentumScore.signal);
  breakdown.momentum = momentumScore.points;

  // 5. FDV
  const fdvScore = scoreFDV(features, w);
  score += fdvScore.points;
  if (fdvScore.signal) signals.push(fdvScore.signal);
  breakdown.fdv = fdvScore.points;

  // 6. LIQUIDITY
  const liqScore = scoreLiquidity(features, w);
  score += liqScore.points;
  breakdown.liquidity = liqScore.points;

  // 7. ACTIVITY
  const actScore = scoreActivity(features, w);
  score += actScore.points;
  if (actScore.signal) signals.push(actScore.signal);
  breakdown.activity = actScore.points;

  return { score: Math.round(score), signals, breakdown };
}

function scoreNewness(f, w) {
  const h = f.age_hours;
  if (h == null) return { points: 0 };
  if (h < 1) return { points: w.newness, signal: `🔥 <1h OLD!` };
  if (h < 3) return { points: w.newness * 0.8, signal: `⚡ <3h old` };
  if (h < 6) return { points: w.newness * 0.6, signal: `🌟 <6h old` };
  if (h < 12) return { points: w.newness * 0.4, signal: `📅 <12h old` };
  if (h < 24) return { points: w.newness * 0.2 };
  return { points: 0 };
}

function scoreFlow(f, w) {
  const bp = f.buy_pressure;
  if (bp >= 5) return { points: w.buy_pressure, signal: `🔥🔥 ${bp.toFixed(1)}x BUY PRESSURE` };
  if (bp >= 3) return { points: w.buy_pressure * 0.75, signal: `🔥 ${bp.toFixed(1)}x buy pressure` };
  if (bp >= 2) return { points: w.buy_pressure * 0.5, signal: `📈 ${bp.toFixed(1)}x buy pressure` };
  if (bp >= 1.5) return { points: w.buy_pressure * 0.25 };
  return { points: 0 };
}

function scoreVolume(f, w) {
  const accel = f.volume_acceleration;
  if (accel > 3) return { points: w.volume_explosion, signal: `🚀 ${accel.toFixed(1)}x volume spike!` };
  if (accel > 2) return { points: w.volume_explosion * 0.66, signal: `📈 ${accel.toFixed(1)}x volume surge` };
  if (accel > 1.5) return { points: w.volume_explosion * 0.33, signal: `📊 ${accel.toFixed(1)}x volume uptick` };
  return { points: 0 };
}

function scoreMomentum(f, w) {
  const m5 = f.momentum_5m;
  if (m5 > 10) return { points: w.momentum, signal: `🚀🚀 +${m5}% 5m!` };
  if (m5 > 5) return { points: w.momentum * 0.7, signal: `🚀 +${m5}% 5m` };
  if (m5 > 2) return { points: w.momentum * 0.4, signal: `📈 +${m5}% 5m` };
  if (m5 > 0.5) return { points: w.momentum * 0.15 };
  return { points: 0 };
}

function scoreFDV(f, w) {
  if (f.sweet_spot_fdv) return { points: w.fdv, signal: `💎 Sweet FDV: $${(f.fdv_usd / 1000).toFixed(0)}k` };
  if (f.fdv_tier === 'small' || f.fdv_tier === 'mid') return { points: w.fdv * 0.6 };
  return { points: 0 };
}

function scoreLiquidity(f, w) {
  if (f.liquidity_tier === 'medium') return { points: w.liquidity };
  if (f.liquidity_tier === 'high') return { points: w.liquidity * 0.3 };
  if (f.liquidity_tier === 'low') return { points: w.liquidity * 0.5 };
  return { points: 0 };
}

function scoreActivity(f, w) {
  const total = f.transaction_count;
  if (total > 50) return { points: w.activity, signal: '🎯 Very active market' };
  if (total > 20) return { points: w.activity * 0.5 };
  return { points: 0 };
}

/**
 * Detect insider buying patterns.
 */
function detectInsiderPattern(features) {
  let insiderScore = 0;
  const patterns = [];

  if (features.buys_5m > 10 && features.sells_5m < features.buys_5m * 0.3) {
    insiderScore += 20;
    patterns.push('BUILDING: Buy wall forming');
  }

  if (features.momentum_5m > 0.5 && features.sells_5m < 3) {
    insiderScore += 15;
    patterns.push('STEALTH: Rising price, no sellers');
  }

  if (features.volume_acceleration > 1.2 && features.momentum_5m < 2) {
    insiderScore += 15;
    patterns.push('PRE-PUMP: Volume up but price quiet');
  }

  return { insiderScore, patterns };
}

module.exports = { scoreOpportunity, detectInsiderPattern, DEFAULT_WEIGHTS };
