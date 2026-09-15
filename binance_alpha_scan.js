const crypto = require('crypto');
const https = require('https');

const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';

function sign(queryString) {
  return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
}

function apiGet(path, signed = false) {
  return new Promise((resolve, reject) => {
    let fullPath = path;
    if (signed) {
      const sep = path.includes('?') ? '&' : '?';
      const timestamp = Date.now();
      const qs = path.split('?')[1] || '';
      const signStr = qs ? qs + '&timestamp=' + timestamp : 'timestamp=' + timestamp;
      const signature = sign(signStr);
      fullPath = path.split('?')[0] + '?' + signStr + '&signature=' + signature;
    }
    const options = {
      hostname: 'api.binance.com',
      path: fullPath,
      method: 'GET',
      headers: { 'X-MBX-APIKEY': API_KEY }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const fullBody = body + '&timestamp=' + timestamp;
    const signature = sign(fullBody);
    const options = {
      hostname: 'api.binance.com',
      path: path + '?' + fullBody + '&signature=' + signature,
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Binance API: Alpha & Market Scan ===\n');

  // 1. Get all BSC trading pairs with volume
  console.log('--- All BSC USDT pairs with 24h stats ---');
  const allTickers = await apiGet('/api/v3/ticker/24hr');
  if (Array.isArray(allTickers)) {
    const bscPairs = allTickers
      .filter(t => t.symbol.endsWith('USDT'))
      .map(t => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        change: parseFloat(t.priceChangePercent),
        volume: parseFloat(t.quoteVolume),
        high: parseFloat(t.highPrice),
        low: parseFloat(t.lowPrice),
      }))
      .sort((a, b) => b.change - a.change);
    
    console.log('\nTop 20 USDT pairs by 24h change:');
    bscPairs.slice(0, 20).forEach((t, i) => {
      console.log(`${i+1}. ${t.symbol} | Price: $${t.price} | 24h: ${t.change > 0 ? '+' : ''}${t.change.toFixed(2)}% | Vol: $${(t.volume/1000000).toFixed(1)}M`);
    });

    console.log('\nBottom 10 (most beaten down):');
    bscPairs.slice(-10).forEach((t, i) => {
      console.log(`  ${t.symbol} | Price: $${t.price} | 24h: ${t.change.toFixed(2)}% | Vol: $${(t.volume/1000000).toFixed(1)}M`);
    });
  }

  // 2. Check if there are Alpha-specific endpoints
  console.log('\n--- Trying Binance Alpha endpoints ---');
  
  // Try the alpha listing endpoint
  const alphaEndpoints = [
    '/sapi/v1/alpha/quote/list',
    '/sapi/v1/alpha/tokens',
    '/bapi/asset/v1/public/asset-service/product/alpha',
    '/bapi/composite/v1/public/market/ranking',
    '/gateway-api/v1/public/product/alpha/list',
  ];

  for (const ep of alphaEndpoints) {
    try {
      const result = await apiGet(ep, true);
      const str = JSON.stringify(result);
      if (str.length > 50 && !str.includes('"code":-')) {
        console.log(`${ep}: SUCCESS (${str.length} chars)`);
        console.log(str.substring(0, 500));
      } else {
        console.log(`${ep}: ${str.substring(0, 100)}`);
      }
    } catch(e) {
      console.log(`${ep}: ERROR`);
    }
  }

  // 3. Check earn products (some alpha tokens are in earn)
  console.log('\n--- Binance Earn flexible products ---');
  try {
    const earn = await apiGet('/sapi/v1/simple-earn/flexible/list', true);
    if (earn && earn.rows) {
      console.log(`Found ${earn.total} earn products`);
      earn.rows.forEach(p => {
        console.log(`  ${p.asset} | APY: ${(p.latestAnnualPercentageRate * 100).toFixed(2)}%`);
      });
    }
  } catch(e) { console.log('Earn list error:', e.message); }
}

main();
