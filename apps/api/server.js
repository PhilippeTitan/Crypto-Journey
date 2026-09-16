/**
 * MaurEdge 3.1 — API Service + Next.js Dashboard
 * Single entry point: serves both the React dashboard and the API.
 */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../../core/lib/db');

const PORT = process.env.PORT || 3456;
const IS_DEV = process.env.NODE_ENV !== 'production';

// ─── Next.js Integration ───
let nextApp = null;
let nextHandle = null;

async function initNext() {
  try {
    const next = require('next');
    const app = next({
      dev: IS_DEV,
      dir: path.join(__dirname, '../..'),
      conf: require('../../next.config.js'),
    });
    await app.prepare();
    nextApp = app;
    nextHandle = app.getRequestHandler();
    console.log('✅ Next.js dashboard ready');
  } catch (err) {
    console.warn('⚠️  Next.js not available, falling back to static HTML:', err.message);
    nextApp = null;
    nextHandle = null;
  }
}

// Helper: parse JSON body from POST requests
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

// Helper: respond with JSON
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── API Routes (kept for backward compat + worker) ───
const API_ROUTES = new Set([
  '/api/status', '/api/positions', '/api/trades', '/api/opportunities',
  '/api/decisions', '/api/events', '/api/regime', '/api/config',
  '/api/config/providers', '/api/config/test',
]);

function isApiRoute(pathname) {
  if (API_ROUTES.has(pathname)) return true;
  // Match /api/config/* sub-routes
  if (pathname.startsWith('/api/config/')) return true;
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    // ── API Routes: handle directly ──
    if (isApiRoute(url.pathname)) {
      return await handleApiRoute(req, res, url);
    }

    // ── Next.js: let it handle pages, static, etc. ──
    if (nextApp && nextHandle) {
      const parsedUrl = require('url').parse(req.url, true);
      return nextHandle(req, res, parsedUrl);
    }

    // ── Fallback: serve living board or dashboard.html ──
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const boardHtml = path.join(__dirname, '../../mauredge_v3_board.html');
      const dashHtml = path.join(__dirname, '../../dashboard.html');
      const filePath = fs.existsSync(boardHtml) ? boardHtml : dashHtml;
      const html = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    res.writeHead(404);
    json(res, { error: 'Not found' }, 404);
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    json(res, { error: err.message }, 500);
  }
});

// ─── API Route Handler ───
async function handleApiRoute(req, res, url) {
  switch (url.pathname) {
    case '/api/status': {
      const mission = await db.getActiveMission();
      const positions = await db.getOpenPositions();
      const autonomy = await db.getAutonomyState();
      const recentEvents = await db.select('system_events', {}, 'created_at DESC', 10);
      const health = await db.query('SELECT * FROM system_health');
      return json(res, { mission, positions, autonomy, recentEvents, health: health.rows?.[0] });
    }
    case '/api/positions': {
      const positions = await db.getOpenPositions();
      return json(res, positions);
    }
    case '/api/trades': {
      const trades = await db.select('trades', {}, 'created_at DESC', 50);
      return json(res, trades);
    }
    case '/api/opportunities': {
      const opps = await db.select('opportunities', {}, 'created_at DESC', 20);
      return json(res, opps);
    }
    case '/api/decisions': {
      const decisions = await db.select('ai_decisions', {}, 'created_at DESC', 20);
      return json(res, decisions);
    }
    case '/api/events': {
      const events = await db.select('system_events', {}, 'created_at DESC', 50);
      return json(res, events);
    }
    case '/api/regime': {
      const regimes = await db.select('market_regimes', {}, 'created_at DESC', 10);
      return json(res, regimes);
    }
    case '/api/config/providers': {
      const { PROVIDERS } = require('../../core/intelligence/ai-provider');
      const list = Object.entries(PROVIDERS).map(([key, reg]) => ({
        key, name: reg.name, models: reg.models, defaultModel: reg.defaultModel,
        keyPlaceholder: reg.keyPlaceholder, noKeyRequired: reg.noKeyRequired || false,
        needsEndpoint: reg.needsEndpoint || false,
      }));
      return json(res, list);
    }
    case '/api/config': {
      if (req.method === 'GET') {
        const allConfig = await db.select('configuration');
        const safe = {};
        for (const row of allConfig) {
          if (row.key.includes('api_key') || row.key.includes('secret')) {
            safe[row.key] = row.value ? '••••••' + row.value.slice(-4) : '';
          } else {
            safe[row.key] = row.value;
          }
        }
        return json(res, safe);
      } else if (req.method === 'POST') {
        const body = await parseBody(req);
        const updated = [];
        for (const [key, value] of Object.entries(body)) {
          if (key.includes('api_key') || key.includes('secret')) {
            if (value && !value.startsWith('•••')) {
              await db.setConfig(key, value);
              updated.push(key);
            }
          } else {
            await db.setConfig(key, String(value));
            updated.push(key);
          }
        }
        const { clearConfigCache } = require('../../core/intelligence/ai-provider');
        clearConfigCache();
        return json(res, { ok: true, updated });
      }
      return;
    }
    case '/api/config/test': {
      const body = await parseBody(req);
      const { createProvider } = require('../../core/intelligence/ai-provider');
      const provider = createProvider(body.provider || 'openai', {
        apiKey: body.apiKey, model: body.model, endpoint: body.endpoint,
      });
      try {
        const result = await provider.decide(
          { mission: { name: 'test' }, portfolio: { total_value: 10 }, open_positions: [],
            market_regime: { regime: 'QUIET' }, top_opportunities: [] },
          'Respond with exactly: {"action": "WAIT", "confidence": 0.5, "reason": "Connection test successful"}'
        );
        if (result && result.decision) {
          return json(res, { ok: true, message: 'AI provider connected successfully', model: body.model, response: result.decision });
        }
        return json(res, { ok: false, message: 'AI provider returned no valid response' }, 400);
      } catch (err) {
        return json(res, { ok: false, message: err.message }, 400);
      }
    }
    default:
      res.writeHead(404);
      return json(res, { error: 'Not found' }, 404);
  }
}

// ─── Boot ───
async function start() {
  await initNext();
  server.listen(PORT, () => {
    console.log(`🚀 MaurEdge 3.1 running on port ${PORT}`);
    console.log(`   Dashboard: http://localhost:${PORT}`);
    console.log(`   API:       http://localhost:${PORT}/api/status`);
  });
}

start();
