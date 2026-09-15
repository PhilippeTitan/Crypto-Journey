const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
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
  // Check GICAT price history
  console.log('=== GICAT (0x118179FC98F245e59b2eCb702652C2355b723364) ===');
  try {
    const gicat = await fetchJSON('https://api.dexscreener.com/latest/dex/tokens/0x118179FC98F245e59b2eCb702652C2355b723364');
    if (gicat && gicat.pairs) {
      gicat.pairs.forEach(p => {
        console.log(`  Pair: ${p.baseToken.symbol}/${p.quoteToken.symbol}`);
        console.log(`  Price: $${p.priceUsd || 'N/A'}`);
        console.log(`  24h Change: ${p.priceChange?.h24 || 'N/A'}%`);
        console.log(`  6h Change: ${p.priceChange?.h6 || 'N/A'}%`);
        console.log(`  1h Change: ${p.priceChange?.h1 || 'N/A'}%`);
        console.log(`  Volume 24h: $${(p.volume?.h24 || 0).toFixed(0)}`);
        console.log(`  Liquidity: $${(p.liquidity?.usd || 0).toFixed(0)}`);
        console.log(`  FDV: $${(p.fdv || 0).toFixed(0)}`);
        console.log('');
      });
    }
  } catch(e) { console.log('Error:', e.message); }

  // Check NeuroFly price history
  console.log('=== NeuroFly (0xb032bfB90e3BB708A5adaba0d757A4650D507777) ===');
  try {
    const neuro = await fetchJSON('https://api.dexscreener.com/latest/dex/tokens/0xb032bfB90e3BB708A5adaba0d757A4650D507777');
    if (neuro && neuro.pairs) {
      neuro.pairs.forEach(p => {
        console.log(`  Pair: ${p.baseToken.symbol}/${p.quoteToken.symbol}`);
        console.log(`  Price: $${p.priceUsd || 'N/A'}`);
        console.log(`  24h Change: ${p.priceChange?.h24 || 'N/A'}%`);
        console.log(`  6h Change: ${p.priceChange?.h6 || 'N/A'}%`);
        console.log(`  1h Change: ${p.priceChange?.h1 || 'N/A'}%`);
        console.log(`  Volume 24h: $${(p.volume?.h24 || 0).toFixed(0)}`);
        console.log(`  Liquidity: $${(p.liquidity?.usd || 0).toFixed(0)}`);
        console.log(`  FDV: $${(p.fdv || 0).toFixed(0)}`);
        console.log('');
      });
    }
  } catch(e) { console.log('Error:', e.message); }
}

main();
