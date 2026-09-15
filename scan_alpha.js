const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const opts = typeof url === 'object' ? url : { hostname: new URL(url).hostname, path: new URL(url).pathname + new URL(url).search, method: 'GET' };
    const req = https.request(opts, (res) => {
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
  console.log('=== Binance Alpha Scan ===\n');

  // 1. Search DexScreener for "alpha" BSC tokens
  try {
    const data = await fetchJSON('https://api.dexscreener.com/latest/dex/search?q=alpha');
    if (data && data.pairs) {
      const bscAlpha = data.pairs
        .filter(p => p.chainId === 'bsc')
        .filter(p => p.liquidity?.usd > 500)
        .sort((a, b) => (b.priceChange?.h1 || 0) - (a.priceChange?.h1 || 0));
      
      console.log(`Found ${bscAlpha.length} "alpha" BSC tokens on DexScreener:\n`);
      bscAlpha.slice(0, 15).forEach((p, i) => {
        const h1 = p.priceChange?.h1;
        const h6 = p.priceChange?.h6;
        const h24 = p.priceChange?.h24;
        const emoji = h1 > 0 ? 'GREEN' : 'RED';
        console.log(`${i+1}. [${emoji}] ${p.baseToken.symbol} | 1h: ${h1 > 0 ? '+' : ''}${h1}% | 6h: ${h6 > 0 ? '+' : ''}${h6}% | 24h: ${h24 > 0 ? '+' : ''}${h24}%`);
        console.log(`   Vol: $${(p.volume?.h24/1000).toFixed(1)}k | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k | FDV: $${(p.fdv/1000).toFixed(1)}k`);
        console.log(`   Price: $${p.priceUsd} | Address: ${p.baseToken.address}`);
        console.log('');
      });
    }
  } catch(e) { console.log('DexScreener error:', e.message); }

  // 2. Try Binance Alpha API directly
  console.log('\n=== Binance Alpha direct check ===');
  try {
    const alpha = await fetchJSON('https://www.binance.com/bapi/composite/v1/public/marketing/rank/query?timeZone=0&lang=en&page=1&pageSize=50&rankType=ALPHA_BSC');
    console.log(JSON.stringify(alpha).substring(0, 3000));
  } catch(e) { 
    try {
      const alpha2 = await fetchJSON('https://www.binance.com/bapi/composite/v1/public/market/ranking?timeZone=0&lang=en&page=1&pageSize=20&rankId=alpha_bsc');
      console.log(JSON.stringify(alpha2).substring(0, 3000));
    } catch(e2) { console.log('Binance Alpha API not accessible:', e.message); }
  }

  // 3. Check Binance Wallet Alpha - known tokens
  console.log('\n=== Known Binance Alpha BSC tokens ===');
  const alphaTokens = [
    { name: 'B2', symbol: 'B2', address: '0x26A8e3E5a0a378C40b41B4b85c90cC49c85E0A86' },
    { name: 'PARTI', symbol: 'PARTI', address: '0x5D5A0B5F7bA808f0B4ADe298D8c2d21E79A67C2E' },
    { name: 'NIL', symbol: 'NIL', address: '0x43E18864Ba59d4AB4C90bB5D30e7fC9f980f9e41' },
    { name: 'SHELL', symbol: 'SHELL', address: '0xf9F83b1A806Be81e4C3B4F6C0B11b0E0F4B5b3E3' },
    { name: 'BANK', symbol: 'BANK', address: '0x61B172d1642b24B3aE1A8680e8886A04dBC08f86' },
    { name: 'MYX', symbol: 'MYX', address: '0xd8218f0BE855e289E38b1ca5a2B52Bc1219519AF' },
    { name: 'SKYAI', symbol: 'SKYAI', address: '0x35E59238f0A55A9C3E8d661B8b580A0d836e13eB' },
    { name: 'AINTI', symbol: 'AINTI', address: '0xAf78805367E03bE329d7d9c0C8b268023C999552' },
  ];

  for (const t of alphaTokens) {
    try {
      const info = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${t.address}`);
      if (info && info.pairs && info.pairs.length > 0) {
        const p = info.pairs[0];
        const h1 = p.priceChange?.h1;
        const h6 = p.priceChange?.h6;
        const h24 = p.priceChange?.h24;
        const emoji = h1 > 0 ? 'GREEN' : 'RED';
        console.log(`[${emoji}] ${p.baseToken.symbol} | 1h: ${h1 > 0 ? '+' : ''}${h1}% | 6h: ${h6 > 0 ? '+' : ''}${h6}% | 24h: ${h24 > 0 ? '+' : ''}${h24}%`);
        console.log(`   Vol: $${(p.volume?.h24/1000).toFixed(1)}k | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k | Price: $${p.priceUsd}`);
        console.log(`   Address: ${t.address}`);
        console.log('');
      }
    } catch(e) {}
  }
}

main();
