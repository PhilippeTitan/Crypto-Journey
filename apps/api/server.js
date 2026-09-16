/**
 * MaurEdge 3.0 — API Service
 * Dashboard API + system status + manual controls.
 */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../core/lib/db');

const PORT = process.env.PORT || 3456;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

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
        res.end(JSON.stringify(regimes));
        return;
      }

      default:
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 MaurEdge 3.0 API running on port ${PORT}`);
});
