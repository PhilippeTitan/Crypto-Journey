/**
 * MaurEdge 3.0 — Market Regime Engine
 * Determines market conditions from aggregated data.
 * Heat score → Regime classification.
 */

const DEFAULT_THRESHOLDS = {
  quiet: 20,
  cool: 40,
  active: 60,
  hot: 80,
  bananas: 100,
};

const REGIMES = ['QUIET', 'COOL', 'ACTIVE', 'HOT', 'BANANAS', 'UNSTABLE', 'DEFENSIVE'];

/**
 * Analyze market regime from a set of scored opportunities.
 * @param {object[]} opportunities - Array of scored token features
 * @param {object} opts - { thresholds, recentRegime }
 * @returns {object} Regime analysis
 */
function detectRegime(opportunities = [], opts = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...opts.thresholds };

  if (opportunities.length === 0) {
    return buildResult(0, 'QUIET', opportunities, opts);
  }

  // Calculate heat score components
  const avgMomentum = avg(opportunities.map((o) => Math.abs(o.momentum_composite || 0)));
  const highMomentumCount = opportunities.filter((o) => Math.abs(o.momentum_composite || 0) > 5).length;
  const avgBuyPressure = avg(opportunities.map((o) => o.buy_pressure || 0));
  const newLaunchCount = opportunities.filter((o) => o.is_new_launch).length;
  const avgVolumeAccel = avg(opportunities.map((o) => o.volume_acceleration || 0));
  const opportunityCount = opportunities.length;

  // Weighted heat score (0-100)
  const heatScore = Math.min(100,
    (normalize(avgMomentum, 0, 15) * 25) +        // Momentum weight: 25%
    (normalize(highMomentumCount, 0, 10) * 20) +   // Hot token count: 20%
    (normalize(avgBuyPressure, 0, 5) * 15) +       // Buy pressure: 15%
    (normalize(newLaunchCount, 0, 20) * 15) +      // New launches: 15%
    (normalize(avgVolumeAccel, 0, 5) * 15) +       // Volume accel: 15%
    (normalize(opportunityCount, 0, 50) * 10)       // Opportunity density: 10%
  );

  const regime = classifyRegime(heatScore, thresholds, opts.recentRegime);

  return buildResult(heatScore, regime, opportunities, opts, {
    avg_momentum: round(avgMomentum),
    avg_buy_pressure: round(avgBuyPressure),
    high_momentum_count: highMomentumCount,
    new_launch_count: newLaunchCount,
    avg_volume_acceleration: round(avgVolumeAccel),
    opportunity_count: opportunityCount,
  });
}

function classifyRegime(heat, thresholds, recentRegime) {
  if (recentRegime === 'DEFENSIVE') return 'DEFENSIVE';
  if (recentRegime === 'UNSTABLE') {
    if (heat < thresholds.cool) return 'COOL';
    return 'UNSTABLE';
  }
  if (heat <= thresholds.quiet) return 'QUIET';
  if (heat <= thresholds.cool) return 'COOL';
  if (heat <= thresholds.active) return 'ACTIVE';
  if (heat <= thresholds.hot) return 'HOT';
  return 'BANANAS';
}

function buildResult(heat, regime, opportunities, opts, inputs = {}) {
  return {
    heat_score: round(heat),
    regime,
    opportunity_count: opportunities.length,
    inputs_json: inputs,
    timestamp: new Date().toISOString(),
  };
}

function normalize(value, min, max) {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function avg(arr) {
  const valid = arr.filter((v) => v != null && !isNaN(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function round(v, d = 2) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

module.exports = { detectRegime, REGIMES, DEFAULT_THRESHOLDS };
