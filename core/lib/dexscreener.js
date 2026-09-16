/**
 * MaurEdge 3.0 — DexScreener Provider
 * All DexScreener API interactions in one place.
 * Normalizes raw API responses into the common MarketSnapshot schema.
 */

const { fetchJSON } = require('./fetch');

const BASE = 'https://api.dexscreener.com';
const BSC = 'bsc';
const REQUEST_DELAY = 200;

// ============================================
// RAW DATA FETCHERS
// ============================================

/**
 * Get token data from DexScreener by address.
 */
async function getTokenByAddress(address) {
  const data = await fetchJSON(`${BASE}/latest/dex/tokens/${address}`);
  if (!data?.pairs?.length) return null;
  const pair = data.pairs.find((p) => p.chainId === BSC) || data.pairs[0];
  return pair;
}

/**
 * Search DexScreener for pairs matching a query.
 */
async function searchPairs(query) {
  const data = await fetchJSON(`${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!data?.pairs) return [];
  return data.pairs.filter((p) => p.chainId === BSC);
}

/**
 * Get latest BSC pairs sorted by creation time.
 */
async function getNewPairs(limit = 50) {
  const data = await fetchJSON(
    `${BASE}/latest/dex/pairs/bsc?sort=pairCreatedAt&order=desc`
  );
  if (!Array.isArray(data)) return [];
  return data.slice(0, limit);
}

/**
 * Get trending/boosted tokens.
 */
async function getTrendingTokens() {
  const data = await fetchJSON(`${BASE}/token-boosts/top/v1`);
  if (!Array.isArray(data)) return [];
  return data.filter((t) => t.chainId === BSC || t.chain === BSC);
}

// ============================================
// NORMALIZER — Raw pair → Common schema
// ============================================

/**
 * Normalize a DexScreener pair object into the standard MarketSnapshot format.
 * @param {object} pair - Raw DexScreener pair
 * @returns {object} Normalized market data
 */
function normalizePair(pair) {
  if (!pair) return null;

  const now = Date.now();
  const createdAt = pair.pairCreatedAt || null;
  const ageMs = createdAt ? now - createdAt : null;
  const ageMinutes = ageMs ? Math.floor(ageMs / 60000) : null;

  return {
    token: pair.baseToken?.symbol || 'UNKNOWN',
    address: pair.baseToken?.address || '',
    chain: 'bsc',
    price: parseFloat(pair.priceUsd) || 0,
    priceNative: parseFloat(pair.priceNative) || 0,

    // Momentum
    momentum_5m: pair.priceChange?.m5 || 0,
    momentum_1h: pair.priceChange?.h1 || 0,
    momentum_6h: pair.priceChange?.h6 || 0,
    momentum_24h: pair.priceChange?.h24 || 0,

    // Flow
    buys_5m: pair.txns?.m5?.buys || 0,
    sells_5m: pair.txns?.m5?.sells || 0,
    buy_pressure:
      (pair.txns?.m5?.sells || 0) > 0
        ? (pair.txns?.m5?.buys || 0) / (pair.txns?.m5?.sells || 1)
        : (pair.txns?.m5?.buys || 0) > 0
          ? 10
          : 0,

    // Volume
    volume_5m: pair.volume?.m5 || 0,
    volume_1h: pair.volume?.h1 || 0,
    volume_24h: pair.volume?.h24 || 0,

    // Liquidity & valuation
    liquidity_usd: pair.liquidity?.usd || 0,
    fdv_usd: pair.fdv || 0,

    // Pair info
    pair_address: pair.pairAddress || '',
    pair_created_at: createdAt,
    age_minutes: ageMinutes,

    // Raw for debugging
    raw_json: pair,
  };
}

/**
 * Fetch and normalize token data by address.
 */
async function getNormalizedToken(address) {
  const pair = await getTokenByAddress(address);
  return normalizePair(pair);
}

/**
 * Fetch multiple tokens by address in sequence (with rate limiting).
 */
async function getMultipleTokens(addresses) {
  const results = [];
  for (const addr of addresses) {
    const data = await getNormalizedToken(addr);
    if (data) results.push(data);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY));
  }
  return results;
}

module.exports = {
  getTokenByAddress,
  searchPairs,
  getNewPairs,
  getTrendingTokens,
  normalizePair,
  getNormalizedToken,
  getMultipleTokens,
  REQUEST_DELAY,
};
