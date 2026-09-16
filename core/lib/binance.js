/**
 * MaurEdge 3.0 — Binance API Client
 * All Binance REST API interactions with HMAC signing.
 * Replaces 14 duplicated implementations with hardcoded keys.
 * Keys MUST come from environment variables.
 */

const crypto = require('crypto');
const https = require('https');

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
const BASE_HOST = 'api.binance.com';

if (!API_KEY || !API_SECRET) {
  console.warn('⚠️  BINANCE_API_KEY/BINANCE_API_SECRET not set. Binance API calls will fail.');
}

// ============================================
// SIGNING
// ============================================

function sign(queryString) {
  return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
}

function signedParams(params = {}) {
  params.timestamp = Date.now();
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return qs + '&signature=' + sign(qs);
}

// ============================================
// HTTP CLIENT
// ============================================

function apiRequest(method, path, params = {}, body = null) {
  return new Promise((resolve, reject) => {
    const qs = signedParams(params);
    const fullPath = `${path}?${qs}`;

    const options = {
      hostname: BASE_HOST,
      path: fullPath,
      method,
      headers: {
        'X-MBX-APIKEY': API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ============================================
// PUBLIC API (no signing required)
// ============================================

function publicGet(path) {
  return new Promise((resolve, reject) => {
    https
      .get(`https://${BASE_HOST}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      })
      .on('error', reject);
  });
}

// ============================================
// HIGH-LEVEL METHODS
// ============================================

async function getTicker24h(symbol) {
  return publicGet(`/api/v3/ticker/24hr?symbol=${symbol}`);
}

async function getKlines(symbol, interval = '1h', limit = 24) {
  return publicGet(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
}

async function getSpotBalances() {
  return apiRequest('GET', '/api/v3/account');
}

async function getConvertQuote(fromAsset, toAsset, amount) {
  return apiRequest('POST', '/sapi/v1/convert/getQuote', {
    fromAsset,
    toAsset,
    fromAmount: amount,
  });
}

async function acceptConvertQuote(quoteId) {
  return apiRequest('POST', '/sapi/v1/convert/acceptQuote', { quoteId });
}

module.exports = {
  sign,
  apiRequest,
  publicGet,
  getTicker24h,
  getKlines,
  getSpotBalances,
  getConvertQuote,
  acceptConvertQuote,
};
