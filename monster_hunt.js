const https = require('https');
const { execSync } = require('child_process');

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

function checkTradeability(tokenAddress) {
  try {
    const result = execSync(
      `baw market-order quote --fromTokenQty 1 --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken ${tokenAddress} --binanceChainId 56 --json`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const parsed = JSON.parse(result);
    return parsed.success === true;
  } catch(e) {
    return false;
  }
}

function getTokenDetails(address) {
  try {
    const result = execSync(
      `baw market-order quote --fromTokenQty 10 --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken ${address} --binanceChainId 56 --json`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const parsed = JSON.parse(result);
    if (parsed.success) return parsed.data;
  } catch(e) {}
  return null;
}

async function scanTrending() {
  console.log('🔥🔥🔥 MONSTER HUNTER v2 🔥🔥🔥');
  console.log('Looking for the BIGGEST momentum plays on BSC...\n');
  
  // Multiple search strategies
  const searches = [
    // Hot/trending tokens
    'https://api.dexscreener.com/token-boosts/top/v1',
    // BSC trending
    'https://api.dexscreener.com/latest/dex/search?q=moon',
    'https://api.dexscreener.com/latest/dex/search?q=pump',
    'https://api.dexscreener.com/latest/dex/search?q=gem',
    'https://api.dexscreener.com/latest/dex/search?q=100x',
    'https://api.dexscreener.com/latest/dex/search?q=alpha',
    'https://api.dexscreener.com/latest/dex/search?q=yield',
    'https://api.dexscreener.com/latest/dex/search?q=cat',
    'https://api.dexscreener.com/latest/dex/search?q=doge',
    'https://api.dexscreener.com/latest/dex/search?q=pepe',
  ];
  
  const allPairs = new Map();
  
  for (const url of searches) {
    try {
      let data = await fetchJSON(url);
      
      // Handle token-boosts format (returns array of tokens, not pairs)
      if (Array.isArray(data)) {
        for (const token of data) {
          if (token.tokenAddress && token.chainId === 'bsc') {
            const pairData = await fetchJSON(`https://api.dexscreener.com/tokens/v1/bsc/${token.tokenAddress}`);
            if (pairData && Array.isArray(pairData)) {
              for (const p of pairData) {
                if (!allPairs.has(p.pairAddress)) {
                  allPairs.set(p.pairAddress, p);
                }
              }
            }
          }
        }
      } else if (data && data.pairs) {
        for (const p of data.pairs) {
          if (p.chainId === 'bsc' && !allPairs.has(p.pairAddress)) {
            allPairs.set(p.pairAddress, p);
          }
        }
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`Scanned ${allPairs.size} BSC pairs\n`);
  
  // Score each pair by momentum + volume + buy pressure
  const scored = Array.from(allPairs.values())
    .filter(p => p.liquidity?.usd > 500)
    .map(p => {
      const h5 = p.priceChange?.h5 || 0;
      const h1 = p.priceChange?.h1 || 0;
      const vol24 = p.volume?.h24 || 0;
      const buys = p.txns?.h5?.buys || 0;
      const sells = p.txns?.h5?.sells || 0;
      const buyPressure = sells > 0 ? buys / sells : buys;
      
      // Score: heavy weight on 5m momentum, 1h momentum, buy pressure, volume
      const score = (
        h5 * 2.0 +         // 5-minute price change (biggest signal)
        h1 * 1.0 +          // 1-hour price change
        buyPressure * 5.0 + // buy/sell ratio
        (buys > sells ? 10 : -10) + // buy dominance bonus
        (vol24 > 10000 ? 5 : 0) + // volume bonus
        (buys >= 10 ? 5 : buys >= 5 ? 3 : 0) // trade count bonus
      );
      
      return {
        symbol: p.baseToken?.symbol,
        address: p.baseToken?.address,
        price: p.priceUsd,
        h5, h1,
        h6: p.priceChange?.h6 || 0,
        h24: p.priceChange?.h24 || 0,
        vol: vol24,
        liq: p.liquidity?.usd || 0,
        buys, sells, buyPressure: buyPressure.toFixed(1),
        score,
        pair: p
      };
    })
    .sort((a, b) => b.score - a.score);
  
  // Check top 30 for tradeability
  console.log(`=== Checking top ${Math.min(scored.length, 30)} for tradeability ===\n`);
  
  const tradeable = [];
  for (const token of scored.slice(0, 30)) {
    process.stdout.write(`${token.symbol}... `);
    if (checkTradeability(token.address)) {
      tradeable.push(token);
      console.log(`✅ TRADEABLE! Score: ${token.score.toFixed(1)} | 5m: ${token.h5 > 0 ? '+' : ''}${token.h5}% | Buys: ${token.buys}/${token.sells}`);
    } else {
      console.log(`❌ no`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Final ranking
  console.log('\n' + '='.repeat(80));
  console.log('🏆 MONSTER HUNT RESULTS — TOP TRADEABLE BSC TOKENS');
  console.log('='.repeat(80) + '\n');
  
  tradeable
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .forEach((t, i) => {
      const emoji = t.h5 > 2 ? '🚀' : t.h5 > 0 ? '🟢' : t.h5 > -2 ? '🟡' : '🔴';
      console.log(`${emoji} #${i+1} ${t.symbol}`);
      console.log(`   Score: ${t.score.toFixed(1)} | Price: $${t.price}`);
      console.log(`   5m: ${t.h5 > 0 ? '+' : ''}${t.h5}% | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24}%`);
      console.log(`   Buys/Sells: ${t.buys}/${t.sells} | Buy Pressure: ${t.buyPressure}x`);
      console.log(`   Vol24h: $${(t.vol/1000).toFixed(1)}k | Liq: $${(t.liq/1000).toFixed(1)}k`);
      console.log(`   Address: ${t.address}`);
      console.log('');
    });
  
  return tradeable;
}

scanTrending();
