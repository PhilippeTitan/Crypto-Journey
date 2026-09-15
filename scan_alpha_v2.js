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

function trySwap(fromQty, fromToken, toToken) {
  try {
    const result = execSync(
      `baw market-order quote --fromTokenQty ${fromQty} --fromToken ${fromToken} --toToken ${toToken} --binanceChainId 56 --json`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const parsed = JSON.parse(result);
    return parsed.success === true ? parsed.data : null;
  } catch(e) {
    return null;
  }
}

async function main() {
  console.log('=== Binance Alpha BSC Token Scanner ===\n');
  
  // Search DexScreener for BSC tokens with "alpha" in name or recently created
  const queries = ['alpha', 'binance alpha', 'new', 'launch', 'listing'];
  const allPairs = new Map();
  
  for (const q of queries) {
    try {
      const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
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

  // Filter for interesting ones
  const candidates = Array.from(allPairs.values())
    .filter(p => p.liquidity?.usd > 1000)
    .filter(p => p.volume?.h24 > 1000)
    .sort((a, b) => (b.priceChange?.h1 || 0) - (a.priceChange?.h1 || 0));

  console.log(`Found ${candidates.length} BSC tokens. Checking wallet support...\n`);
  
  const USDT = '0x55d398326f99059fF775485246999027B3197955';
  
  const tradeable = [];
  
  for (const p of candidates.slice(0, 20)) {
    const quote = trySwap(1, USDT, p.baseToken.address);
    if (quote) {
      tradeable.push({
        symbol: p.baseToken.symbol,
        address: p.baseToken.address,
        h1: p.priceChange?.h1,
        h6: p.priceChange?.h6,
        h24: p.priceChange?.h24,
        vol: p.volume?.h24,
        liq: p.liquidity?.usd,
        fdv: p.fdv,
        price: p.priceUsd,
        quote: quote
      });
      console.log(`TRADEABLE: ${p.baseToken.symbol} | 1h: ${p.priceChange?.h1 > 0 ? '+' : ''}${p.priceChange?.h1}% | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k`);
    }
  }

  console.log(`\n=== ${tradeable.length} Tradeable tokens found ===\n`);
  tradeable.forEach((t, i) => {
    const emoji = (t.h1 || 0) > 0 ? 'GREEN' : 'RED';
    console.log(`${i+1}. [${emoji}] ${t.symbol} | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1 || 'N/A'}% | 6h: ${t.h6 > 0 ? '+' : ''}${t.h6 || 'N/A'}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24 || 'N/A'}%`);
    console.log(`   Vol: $${(t.vol/1000).toFixed(1)}k | Liq: $${(t.liq/1000).toFixed(1)}k | FDV: $${(t.fdv/1000).toFixed(1)}k`);
    console.log(`   Price: $${t.price} | Address: ${t.address}`);
    console.log(`   $1 gets you: ${t.quote.toCoinAmount} ${t.quote.toCoinSymbol}`);
    console.log('');
  });

  // Also check the ones from the CEX that are pumping
  console.log('\n=== CEX tokens pumping hard (may have on-chain equivalent) ===');
  const cexPumping = [
    { symbol: 'CREAM', pair: 'CREAMUSDT' },
    { symbol: 'PNT', pair: 'PNTUSDT' },
    { symbol: 'SAGA', pair: 'SAGAUSDT' },
    { symbol: 'FF', pair: 'FFUSDT' },
    { symbol: 'TUT', pair: 'TUTUSDT' },
  ];
  
  // Get their BSC contract addresses
  for (const c of cexPumping) {
    try {
      const info = await fetchJSON(`https://api.dexscreener.com/latest/dex/search?q=${c.symbol}`);
      if (info && info.pairs) {
        const bsc = info.pairs.filter(p => p.chainId === 'bsc');
        if (bsc.length > 0) {
          const p = bsc[0];
          const quote = trySwap(1, USDT, p.baseToken.address);
          if (quote) {
            console.log(`[TRADEABLE] ${c.symbol} on BSC: 1h: ${p.priceChange?.h1 > 0 ? '+' : ''}${p.priceChange?.h1}% | 24h: ${p.priceChange?.h24 > 0 ? '+' : ''}${p.priceChange?.h24}% | Address: ${p.baseToken.address}`);
          } else {
            console.log(`${c.symbol}: BSC token found but NOT tradeable via baw`);
          }
        }
      }
    } catch(e) {}
  }
}

main();
