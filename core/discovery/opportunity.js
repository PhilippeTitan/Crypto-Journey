/**
 * MaurEdge 3.0 — Opportunity Engine
 * Discovery → Filter → Features → Score → Rank → Tradeability → AI Review
 */

const dexscreener = require('../lib/dexscreener');
const baw = require('../lib/baw');
const { computeFeatures } = require('../market/features');
const { scoreOpportunity, detectInsiderPattern } = require('./scoring');
const db = require('../lib/db');

// Known Binance Alpha tokens on BSC
const KNOWN_ALPHA = [
  { symbol: 'AFOB', address: '0x5EB323BD76D309c9916C942cfe8c813626467777' },
  { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43' },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
  { symbol: 'CAT', address: '0x6894CDe390a3f51155ea41Ed24a33A4827d3063D' },
  { symbol: '1INCH', address: '0x111111111117dC0aa78b770fA6A738034120C302' },
  { symbol: 'BNX', address: '0x7F6f1E61c2281f4127394fE878b5E7e4c0F6376e' },
  { symbol: 'ALPINE', address: '0x2C7D8fC9d5795213089E8bf46a8a1AF43D9c3c45' },
  { symbol: 'FF', address: '0x22fF10E0e88d582e8e50059cBeE5BAb36e703760' },
  { symbol: 'TUT', address: '0xA26d1F29891253B78A64543A4a5B484E79921245' },
];

/**
 * Full opportunity discovery pipeline.
 * @returns {object[]} Ranked opportunities
 */
async function discover() {
  const cycleId = crypto.randomUUID();
  const allSnapshots = [];

  // PHASE 1: Discover new BSC pairs
  const newPairs = await dexscreener.getNewPairs(30);
  for (const pair of newPairs) {
    const normalized = dexscreener.normalizePair(pair);
    if (normalized && normalized.liquidity_usd >= 5000) {
      allSnapshots.push({ ...normalized, source: 'new_pair' });
    }
  }

  // PHASE 2: Monitor known Alpha tokens
  for (const alpha of KNOWN_ALPHA) {
    const data = await dexscreener.getNormalizedToken(alpha.address);
    if (data) {
      allSnapshots.push({ ...data, source: 'known_alpha' });
    }
    await sleep(200);
  }

  // PHASE 3: Compute features
  const featured = allSnapshots.map((s) => ({
    ...s,
    features: computeFeatures(s),
  }));

  // PHASE 4: Score & rank
  const scored = featured.map((s) => {
    const { score, signals, breakdown } = scoreOpportunity(s.features);
    const { insiderScore, patterns } = detectInsiderPattern(s.features);
    return {
      ...s,
      score,
      totalScore: score + insiderScore,
      signals,
      breakdown,
      insiderScore,
      patterns,
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  // PHASE 5: Filter — reject obvious invalids
  const qualified = scored.filter((s) => {
    if (s.totalScore <= 0) return false;
    if (!s.address) return false;
    if (s.liquidity_usd < 5000) return false;
    return true;
  });

  // PHASE 6: Tradeability check on top candidates
  const tradeable = [];
  for (const cand of qualified.slice(0, 10)) {
    const isTradeable = baw.checkTradeability(cand.address);
    cand.tradeability_status = isTradeable ? 'pass' : 'fail';
    if (isTradeable) tradeable.push(cand);
    await sleep(300);
  }

  // Store in DB
  for (const opp of tradeable.slice(0, 5)) {
    await db.insert('opportunities', {
      token: opp.token,
      address: opp.address,
      score: opp.totalScore,
      features_json: JSON.stringify(opp.features),
      tradeability_status: opp.tradeability_status,
      status: 'qualified',
      cycle_id: cycleId,
    }).catch(() => {});
  }

  return { cycleId, total: allSnapshots.length, qualified: qualified.length, tradeable };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { discover, KNOWN_ALPHA };
