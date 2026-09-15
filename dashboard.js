const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3456;

// === Trade Log ===
const TRADE_LOG = path.join(__dirname, 'trade_log.json');
function loadTrades() {
  try { return JSON.parse(fs.readFileSync(TRADE_LOG, 'utf8')); } catch { return []; }
}
function saveTrades(trades) {
  fs.writeFileSync(TRADE_LOG, JSON.stringify(trades, null, 2));
}

// Initialize with today's trades if empty
if (fs.existsSync(TRADE_LOG) === false) {
  saveTrades([
    { id: 1, token: 'AFOB', action: 'BUY',  time: '2:53 PM', price: 0.0002770, qty: 17240.57, value: 5.03 },
    { id: 2, token: 'AFOB', action: 'SELL', time: '3:27 PM', price: 0.0003223, qty: 17240.57, value: 5.54, pnl: 0.51, pnlPct: 10.09 },
    { id: 3, token: 'DOGE', action: 'BUY',  time: '3:55 PM', price: 0.08077,   qty: 130.505,  value: 10.54 },
    { id: 4, token: 'DOGE', action: 'SELL', time: '4:22 PM', price: 0.08033,   qty: 130.505,  value: 10.48, pnl: -0.06, pnlPct: -0.57 },
    { id: 5, token: 'AFOB', action: 'BUY',  time: '4:22 PM', price: 0.0003186, qty: 33205.14, value: 10.58 },
    { id: 6, token: 'AFOB', action: 'SELL', time: '4:44 PM', price: 0.0003620, qty: 33205.14, value: 12.02, pnl: 1.44, pnlPct: 13.61 },
  ]);
}

// === Price Cache ===
const priceCache = {};
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Dashboard/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

async function getTokenPrice(address) {
  const cacheKey = address;
  if (priceCache[cacheKey] && Date.now() - priceCache[cacheKey].ts < 5000) {
    return priceCache[cacheKey].data;
  }
  try {
    const json = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (json?.pairs?.[0]) {
      const p = json.pairs[0];
      const data = {
        price: parseFloat(p.priceUsd),
        m5: p.priceChange?.m5 || 0,
        h1: p.priceChange?.h1 || 0,
        h6: p.priceChange?.h6 || 0,
        h24: p.priceChange?.h24 || 0,
        buys5m: p.txns?.m5?.buys || 0,
        sells5m: p.txns?.m5?.sells || 0,
        vol5m: p.volume?.m5 || 0,
        vol1h: p.volume?.h1 || 0,
        liq: p.liquidity?.usd || 0,
        fdv: p.fdv || 0,
        pairAddress: p.pairAddress,
      };
      priceCache[cacheKey] = { data, ts: Date.now() };
      return data;
    }
  } catch {}
  return null;
}

async function getWalletBalance() {
  try {
    const raw = execSync('baw wallet balance --json', { encoding: 'utf8', timeout: 15000 });
    return JSON.parse(raw);
  } catch { return null; }
}

// === Price History for Charts ===
const priceHistory = {};  // token -> [{t, price}]
function recordPrice(token, price) {
  if (!priceHistory[token]) priceHistory[token] = [];
  priceHistory[token].push({ t: Date.now(), price });
  if (priceHistory[token].length > 300) priceHistory[token].shift();
}

// === HTTP Server ===
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Serve dashboard HTML
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  
  // API: Portfolio
  if (url.pathname === '/api/portfolio') {
    const balance = await getWalletBalance();
    const trades = loadTrades();
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const startValue = 5.03;
    const currentValue = balance?.data?.reduce((sum, t) => sum + parseFloat(t.value || 0), 0) || 0;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      balance: balance?.data || [],
      totalValue: currentValue,
      totalPnl,
      totalReturn: ((currentValue - startValue) / startValue * 100).toFixed(2),
      startValue,
    }));
    return;
  }
  
  // API: Live Price
  if (url.pathname === '/api/price') {
    const token = url.searchParams.get('token');
    const tokens = {
      AFOB: '0x5EB323BD76D309c9916C942cfe8c813626467777',
      DOGE: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43',
      ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      CAT: '0x6894CDe390a3f51155ea41Ed24a33A4827d3063D',
      '1INCH': '0x111111111117dC0aa78b770fA6A738034120C302',
    };
    const addr = tokens[token] || token;
    const data = await getTokenPrice(addr);
    if (data) recordPrice(token, data.price);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token, ...data }));
    return;
  }
  
  // API: Price History
  if (url.pathname === '/api/price-history') {
    const token = url.searchParams.get('token');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(priceHistory[token] || []));
    return;
  }
  
  // API: Trades
  if (url.pathname === '/api/trades') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadTrades()));
    return;
  }
  
  // API: All Prices
  if (url.pathname === '/api/prices') {
    const tokens = {
      AFOB: '0x5EB323BD76D309c9916C942cfe8c813626467777',
      DOGE: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43',
      ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      CAT: '0x6894CDe390a3f51155ea41Ed24a33A4827d3063D',
      '1INCH': '0x111111111117dC0aa78b770fA6A738034120C302',
    };
    const results = {};
    for (const [sym, addr] of Object.entries(tokens)) {
      const data = await getTokenPrice(addr);
      if (data) { results[sym] = data; recordPrice(sym, data.price); }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🚀 CRYPTO DASHBOARD LIVE at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
