/**
 * MaurEdge 3.0 — HTTP Fetch Utility
 * Centralized fetchJSON with timeout, retry, and error handling.
 * Replaces 17 duplicated implementations.
 */

const https = require('https');
const http = require('http');

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY = 500;

/**
 * Fetch JSON from a URL with timeout and retry.
 * @param {string} url
 * @param {object} opts - { timeout, retries, headers }
 * @returns {Promise<any|null>}
 */
async function fetchJSON(url, opts = {}) {
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const headers = { 'User-Agent': 'MaurEdge/3.0', ...opts.headers };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await _fetch(url, timeout, headers);
      return result;
    } catch (err) {
      if (attempt < retries) {
        await sleep(RETRY_DELAY * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

function _fetch(url, timeout, headers) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers, timeout }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { fetchJSON, sleep };
