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
  // Check broader market first
  console.log('=== Market Overview ===');
  try {
    const btc = await fetchJSON('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    const eth = await fetchJSON('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT');
    const bnb = await fetchJSON('https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT');
    console.log(`BTC: $${parseFloat(btc.lastPrice).toFixed(0)} (${btc.priceChangePercent > 0 ? '+' : ''}${btc.priceChangePercent}%)`);
    console.log(`ETH: $${parseFloat(eth.lastPrice).toFixed(0)} (${eth.priceChangePercent > 0 ? '+' : ''}${eth.priceChangePercent}%)`);
    console.log(`BNB: $${parseFloat(bnb.lastPrice).toFixed(0)} (${bnb.priceChangePercent > 0 ? '+' : ''}${bnb.priceChangePercent}%)`);
  } catch(e) { console.log('Error:', e.message); }

  // Now scan for tokens that pumped 24h but dipping in 1h = buy the dip
  const searches = ['meme', 'cat', 'dog', 'pepe', 'moon', 'inu', 'bonk', 'wojak', 'chad', 'ai', 'gaming'];
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

  // PUMPED 24h but dipping 1h = potential entry
  const dipBuys = Array.from(allPairs.values())
    .filter(p => p.liquidity?.usd > 3000)
    .filter(p => p.volume?.h24 > 5000)
    .filter(p => (p.priceChange?.h24 || 0) > 20) // pumped 20%+ in 24h
    .filter(p => (p.priceChange?.h1 || 0) < 0)   // but dipping now
    .sort((a, b) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0));
  
  console.log(`\n=== 🎯 PUMPED 24h, DIPPING NOW (buy the dip?) ===`);
  console.log(`Found ${dipBuys.length} tokens that pumped 24h+ but are red in 1h:\n`);
  
  dipBuys.slice(0, 10).forEach((p, i) => {
    const h1 = p.priceChange?.h1;
    const h6 = p.priceChange?.h6;
    const h24 = p.priceChange?.h24;
    console.log(`${i+1}. ${p.baseToken.symbol}/${p.quoteToken.symbol}`);
    console.log(`   1h: ${h1}% (DIP) | 6h: ${h6}% | 24h: +${h24}% (PUMPED)`);
    console.log(`   Vol: $${(p.volume?.h24/1000).toFixed(1)}k | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k | FDV: $${(p.fdv/1000).toFixed(1)}k`);
    console.log(`   Price: $${p.priceUsd} | Address: ${p.baseToken.address}`);
    console.log('');
  });

  // Also show tokens actively growing NOW (1h positive)
  const growing = Array.from(allPairs.values())
    .filter(p => p.liquidity?.usd > 1000)
    .filter(p => p.volume?.h24 > 2000)
    .filter(p => (p.priceChange?.h1 || 0) > 3)
    .sort((a, b) => (b.priceChange?.h1 || 0) - (a.priceChange?.h1 || 0));

  console.log(`\n=== 🟢 GROWING RIGHT NOW (1h: +3%+) ===`);
  console.log(`Found ${growing.length} tokens:\n`);
  
  growing.slice(0, 10).forEach((p, i) => {
    const h1 = p.priceChange?.h1;
    const h6 = p.priceChange?.h6;
    const h24 = p.priceChange?.h24;
    console.log(`${i+1}. ${p.baseToken.symbol}/${p.quoteToken.symbol}`);
    console.log(`   1h: +${h1}% | 6h: ${h6 > 0 ? '+' : ''}${h6}% | 24h: ${h24 > 0 ? '+' : ''}${h24}%`);
    console.log(`   Vol: $${(p.volume?.h24/1000).toFixed(1)}k | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k`);
    console.log(`   Price: $${p.priceUsd} | Address: ${p.baseToken.address}`);
    console.log('');
  });
}

main();
