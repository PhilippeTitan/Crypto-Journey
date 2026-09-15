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
  const searches = ['meme', 'cat', 'dog', 'pepe', 'moon', 'inu', 'bonk', 'wojak', 'chad', 'ai', 'gaming', 'defi', 'token', 'safe', 'rocket', 'gem', 'shib', 'floki', 'baby', 'king'];
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
    await new Promise(r => setTimeout(r, 150));
  }

  const bsc = Array.from(allPairs.values())
    .filter(p => p.liquidity?.usd > 1000)
    .filter(p => p.volume?.h24 > 1000);

  // BTC is down -4%, so any token doing better than -4% has relative strength
  const strongTokens = bsc
    .filter(p => (p.priceChange?.h1 || 0) > -2)
    .filter(p => (p.priceChange?.h6 || 0) > -10)
    .sort((a, b) => (b.priceChange?.h1 || 0) - (a.priceChange?.h1 || 0));

  console.log(`Scanned ${bsc.length} BSC tokens. Market: BTC -4%, ETH -5%.\n`);
  console.log('=== Tokens with RELATIVE STRENGTH (h1 > -2%) ===');
  strongTokens.slice(0, 15).forEach((p, i) => {
    const h1 = p.priceChange?.h1;
    const h6 = p.priceChange?.h6;
    const h24 = p.priceChange?.h24;
    const emoji = h1 > 0 ? 'GREEN' : (h1 > -1 ? 'YELLOW' : 'ORANGE');
    console.log(`${i+1}. [${emoji}] ${p.baseToken.symbol} | 1h: ${h1 > 0 ? '+' : ''}${h1}% | 6h: ${h6 > 0 ? '+' : ''}${h6}% | 24h: ${h24 > 0 ? '+' : ''}${h24}%`);
    console.log(`   Vol: $${(p.volume?.h24/1000).toFixed(1)}k | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k | FDV: $${(p.fdv/1000).toFixed(1)}k`);
    console.log(`   Price: $${p.priceUsd} | Address: ${p.baseToken.address}`);
    console.log('');
  });

  // Top 1h performers
  console.log('=== TOP 1h Performers ===');
  bsc.sort((a, b) => (b.priceChange?.h1 || 0) - (a.priceChange?.h1 || 0));
  bsc.slice(0, 10).forEach((p, i) => {
    const h1 = p.priceChange?.h1;
    const h24 = p.priceChange?.h24;
    console.log(`${i+1}. ${p.baseToken.symbol} | 1h: ${h1 > 0 ? '+' : ''}${h1}% | 24h: ${h24 > 0 ? '+' : ''}${h24}% | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k | Address: ${p.baseToken.address}`);
  });
}

main();
