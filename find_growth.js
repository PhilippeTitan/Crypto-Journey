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
  const searches = ['meme', 'cat', 'dog', 'pepe', 'moon', 'inu', 'bonk', 'wojak', 'chad', 'ai', 'gaming', 'defi'];
  const allPairs = new Map();
  
  for (const q of searches) {
    try {
      const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/search?q=${q}`);
      if (data && data.pairs) {
        for (const p of data.pairs) {
          if (p.chainId === 'bsc' && !allPairs.has(p.pairAddress)) {
            allPairs.set(p.pairAddress, p);
          }
        }
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Filter: BSC, decent liquidity, growing NOW (1h positive AND 6h positive)
  const candidates = Array.from(allPairs.values())
    .filter(p => p.liquidity?.usd > 3000)
    .filter(p => p.volume?.h24 > 5000)
    .filter(p => (p.priceChange?.h1 || 0) > 0)
    .filter(p => (p.priceChange?.h6 || 0) > 0)
    .sort((a, b) => (b.priceChange?.h6 || 0) - (a.priceChange?.h6 || 0));
  
  console.log(`Found ${allPairs.size} BSC pairs. ${candidates.length} are GROWING right now (1h+ and 6h+).\n`);
  console.log('=== 🟢 CURRENTLY GROWING (best entry NOW) ===');
  candidates.slice(0, 15).forEach((p, i) => {
    const h1 = p.priceChange?.h1;
    const h6 = p.priceChange?.h6;
    const h24 = p.priceChange?.h24;
    console.log(`${i+1}. ${p.baseToken.symbol}/${p.quoteToken.symbol}`);
    console.log(`   1h: +${h1}% | 6h: +${h6}% | 24h: ${h24 > 0 ? '+' : ''}${h24}%`);
    console.log(`   Vol: $${(p.volume?.h24/1000).toFixed(1)}k | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k | FDV: $${(p.fdv/1000).toFixed(1)}k`);
    console.log(`   Price: $${p.priceUsd} | Address: ${p.baseToken.address}`);
    console.log('');
  });
}

main();
