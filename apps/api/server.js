/**
 * MaurEdge 3.0 — API Service
 * Dashboard API + system status + manual controls.
 */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../../core/lib/db');

const PORT = process.env.PORT || 3456;

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
    switch (url.pathname) {
      case '/':
      case '/index.html': {
        const html = fs.readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      case '/api/status': {
        const mission = await db.getActiveMission();
        const positions = await db.getOpenPositions();
        const autonomy = await db.getAutonomyState();
        const recentEvents = await db.select('system_events', {}, 'created_at DESC', 10);
        const health = await db.query('SELECT * FROM system_health');
        res.end(JSON.stringify({ mission, positions, autonomy, recentEvents, health: health.rows?.[0] }));
        return;
      }

      case '/api/positions': {
        const positions = await db.getOpenPositions();
        res.end(JSON.stringify(positions));
        return;
      }

      case '/api/trades': {
        const trades = await db.select('trades', {}, 'created_at DESC', 50);
        res.end(JSON.stringify(trades));
        return;
      }

      case '/api/opportunities': {
        const opps = await db.select('opportunities', {}, 'created_at DESC', 20);
        res.end(JSON.stringify(opps));
        return;
      }

      case '/api/decisions': {
        const decisions = await db.select('ai_decisions', {}, 'created_at DESC', 20);
        res.end(JSON.stringify(decisions));
        return;
      }

      case '/api/events': {
        const events = await db.select('system_events', {}, 'created_at DESC', 50);
        res.end(JSON.stringify(events));
        return;
      }

      case '/api/regime': {
        const regimes = await db.select('market_regimes', {}, 'created_at DESC', 10);
        json(res, regimes);
        return;
      }

      // --- PROVIDER REGISTRY ---
      case '/api/config/providers': {
        const { PROVIDERS } = require('../../core/intelligence/ai-provider');
        const list = Object.entries(PROVIDERS).map(([key, reg]) => ({
          key,
          name: reg.name,
          models: reg.models,
          defaultModel: reg.defaultModel,
          keyPlaceholder: reg.keyPlaceholder,
          noKeyRequired: reg.noKeyRequired || false,
          needsEndpoint: reg.needsEndpoint || false,
        }));
        json(res, list);
        return;
      }

      // --- AI CONFIG ENDPOINTS ---
      case '/api/config': {
        if (req.method === 'GET') {
          // Get all config (redact API keys)
          const allConfig = await db.select('configuration');
          const safe = {};
          for (const row of allConfig) {
            if (row.key.includes('api_key') || row.key.includes('secret')) {
              safe[row.key] = row.value ? '••••••' + row.value.slice(-4) : '';
            } else {
              safe[row.key] = row.value;
            }
          }
          json(res, safe);
        } else if (req.method === 'POST') {
          const body = await parseBody(req);
          const updated = [];
          for (const [key, value] of Object.entries(body)) {
            // For any API key field: only update if user provided a real value
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
          // Clear AI config cache so changes take effect immediately
          const { clearConfigCache } = require('../../core/intelligence/ai-provider');
          clearConfigCache();
          json(res, { ok: true, updated });
        }
        return;
      }

      case '/api/config/test': {
        const body = await parseBody(req);
        const { createProvider } = require('../../core/intelligence/ai-provider');
        const provider = createProvider(body.provider || 'openai', {
          apiKey: body.apiKey,
          model: body.model,
          endpoint: body.endpoint,
        });
        try {
          const result = await provider.decide(
            { mission: { name: 'test' }, portfolio: { total_value: 10 }, open_positions: [], market_regime: { regime: 'QUIET' }, top_opportunities: [] },
            'Respond with exactly: {"action": "WAIT", "confidence": 0.5, "reason": "Connection test successful"}'
          );
          if (result && result.decision) {
            json(res, { ok: true, message: 'AI provider connected successfully', model: body.model, response: result.decision });
          } else {
            json(res, { ok: false, message: 'AI provider returned no valid response' }, 400);
          }
        } catch (err) {
          json(res, { ok: false, message: err.message }, 400);
        }
        return;
      }

      default:
        res.writeHead(404);
        json(res, { error: 'Not found' }, 404);
    }
  } catch (err) {
    res.writeHead(500);
    json(res, { error: err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 MaurEdge 3.0 API running on port ${PORT}`);
});
