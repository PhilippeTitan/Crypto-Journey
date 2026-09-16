/**
 * MaurEdge 3.0 — Market Normalizer
 * 
 * Unifies Binance/DexScreener/on-chain data into a common schema.
 * Every token, regardless of source, arrives at the AI in the same format.
 * 
 * Architecture position: Below CAPABILITY REGISTRY, feeds into DISCOVERY
 */

// ─── COMMON SCHEMA ─────────────────────────────────────────

/**
 * @typedef {Object} NormalizedToken
 * @property {string} symbol
 * @property {string} address
 * @property {string} source        - 'binance' | 'dexscreener' | 'onchain'
 * @property {string} chain         - 'bsc' | 'eth' | 'sol' | 'binance'
 * @property {number} price_usd
 * @property {number} price_change_5m
 * @property {number} price_change_1h
 * @property {number} price_change_24h
 * @property {number} volume_5m
 * @property {number} volume_1h
 * @property {number} volume_24h
 * @property {number} liquidity_usd
 * @property {number} market_cap
 * @property {number} holders        - number of holders (if available)
 * @property {number} age_hours      - token age in hours (if available)
 * @property {object} raw            - original raw data (for debugging)
 * @property {string} normalized_at  - ISO timestamp
 */

// ─── NORMALIZERS ───────────────────────────────────────────

/**
 * Normalize a DexScreener pair into common schema
 */
function normalizeDexScreener(pair) {
  if (!pair) return null;

  const baseToken = pair.baseToken || {};
  const quoteToken = pair.quoteToken || {};
  const priceChange = pair.priceChange || {};
  const volume = pair.volume || {};
  const liquidity = pair.liquidity || {};

  return {
    symbol: baseToken.symbol || 'UNKNOWN',
    address: baseToken.address || '',
    source: 'dexscreener',
    chain: 'bsc',
    price_usd: parseFloat(pair.priceUsd) || 0,
    price_change_5m: parseFloat(priceChange.m5) || 0,
    price_change_1h: parseFloat(priceChange.h1) || 0,
    price_change_24h: parseFloat(priceChange.h24) || 0,
    volume_5m: parseFloat(volume.m5) || 0,
    volume_1h: parseFloat(volume.h1) || 0,
    volume_24h: parseFloat(volume.h24) || 0,
    liquidity_usd: parseFloat(liquidity?.usd) || 0,
    market_cap: parseFloat(pair.marketCap) || 0,
    holders: null,
    age_hours: computeAgeHours(pair.pairCreatedAt),
    dex: pair.dexId || 'unknown',
    pair_address: pair.pairAddress || '',
    url: pair.url || '',
    raw: pair,
    normalized_at: new Date().toISOString(),
  };
}

/**
 * Normalize a Binance spot ticker into common schema
 */
function normalizeBinance(ticker) {
  if (!ticker) return null;

  return {
    symbol: ticker.symbol || 'UNKNOWN',
    address: ticker.symbol || '', // Binance uses symbol as identifier
    source: 'binance',
    chain: 'binance',
    price_usd: parseFloat(ticker.lastPrice) || 0,
    price_change_5m: 0, // Binance doesn't provide 5m in ticker
    price_change_1h: parseFloat(ticker.priceChangePercent) || 0,
    price_change_24h: parseFloat(ticker.priceChangePercent) || 0,
    volume_5m: 0,
    volume_1h: 0,
    volume_24h: parseFloat(ticker.quoteVolume) || 0,
    liquidity_usd: 0,
    market_cap: 0,
    holders: null,
    age_hours: null,
    dex: 'binance',
    pair_address: ticker.symbol,
    url: `https://www.binance.com/en/trade/${ticker.symbol}`,
    raw: ticker,
    normalized_at: new Date().toISOString(),
  };
}

/**
 * Normalize an on-chain token (custom format)
 */
function normalizeOnChain(tokenData) {
  if (!tokenData) return null;

  return {
    symbol: tokenData.symbol || 'UNKNOWN',
    address: tokenData.address || '',
    source: 'onchain',
    chain: tokenData.chain || 'bsc',
    price_usd: tokenData.priceUsd || 0,
    price_change_5m: tokenData.priceChange5m || 0,
    price_change_1h: tokenData.priceChange1h || 0,
    price_change_24h: tokenData.priceChange24h || 0,
    volume_5m: tokenData.volume5m || 0,
    volume_1h: tokenData.volume1h || 0,
    volume_24h: tokenData.volume24h || 0,
    liquidity_usd: tokenData.liquidityUsd || 0,
    market_cap: tokenData.marketCap || 0,
    holders: tokenData.holders || null,
    age_hours: tokenData.ageHours || null,
    dex: tokenData.dex || 'unknown',
    pair_address: tokenData.pairAddress || '',
    url: '',
    raw: tokenData,
    normalized_at: new Date().toISOString(),
  };
}

// ─── MERGE / DEDUPLICATE ──────────────────────────────────

/**
 * Merge multiple token lists, deduplicating by address
 * Later sources override earlier ones for matching addresses
 */
function mergeTokens(...lists) {
  const merged = new Map();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const token of list) {
      if (!token || !token.address) continue;

      const key = `${token.chain}:${token.address.toLowerCase()}`;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, token);
      } else {
        // Merge: prefer source with more data
        merged.set(key, mergeTwoTokens(existing, token));
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Merge two token records, preferring the one with more data
 */
function mergeTwoTokens(a, b) {
  // Prefer the source that has more actual data
  const scoreA = countDataFields(a);
  const scoreB = countDataFields(b);
  const base = scoreB > scoreA ? b : a;
  const overlay = scoreB > scoreA ? a : b;

  return {
    ...overlay,
    ...base,
    // Always keep both sources' data in the merge trail
    merge_sources: [
      ...(a.merge_sources || [a.source]),
      ...(b.merge_sources || [b.source]),
    ].filter((v, i, arr) => arr.indexOf(v) === i),
    raw: base.raw, // Keep the richer raw
  };
}

function countDataFields(token) {
  let count = 0;
  if (token.price_usd) count++;
  if (token.volume_24h) count++;
  if (token.liquidity_usd) count++;
  if (token.holders) count++;
  if (token.market_cap) count++;
  if (token.price_change_1h) count++;
  return count;
}

// ─── FILTERING ─────────────────────────────────────────────

/**
 * Apply minimum quality filters to normalized tokens
 */
function filterTokens(tokens, minLiquidity = 5000) {
  return tokens.filter(t =>
    t.price_usd > 0 &&
    t.liquidity_usd >= minLiquidity &&
    t.address &&
    t.address.length > 10
  );
}

// ─── HELPERS ───────────────────────────────────────────────

function computeAgeHours(createdAt) {
  if (!createdAt) return null;
  const now = Date.now();
  const created = typeof createdAt === 'number'
    ? createdAt
    : new Date(createdAt).getTime();
  return (now - created) / (1000 * 60 * 60);
}

module.exports = {
  normalizeDexScreener,
  normalizeBinance,
  normalizeOnChain,
  mergeTokens,
  filterTokens,
};
