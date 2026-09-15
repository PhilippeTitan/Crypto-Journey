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

// Known tradeable Binance Alpha tokens on BSC
const ALPHA_TOKENS = [
  { symbol: 'AFOB', address: '0x5EB323BD76D309c9916C942cfe8c813626467777' },
  { symbol: 'FF', address: '0x22fF10E0e88d582e8e50059cBeE5BAb36e703760' },
  { symbol: 'TUT', address: '0xA26d1F29891253B78A64543A4a5B484E79921245' },
  { symbol: 'CREAM', address: '0xD5664B890035B3c3187B97E982180786F7f398F5' },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
  { symbol: 'GICAT', address: '0x46E04CaE45b62bF8B97986cEBE2f4B0b1d7a9436' },
  { symbol: 'NECTAR', address: '0x4235ad74177C5e47c5e2DF62ab4b104e1e710845' },
  { symbol: 'BNBCAT', address: '0x6Bd516637b9B8E1F4E2e6E0a8b981D4C5e39142D' },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
  { symbol: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  { symbol: 'BinanceTown', address: '0x5DB83d4C4861d940141B82936aE5951e98876a33' },
  { symbol: 'Fly', address: '0x1B27B90Db3A78c6D8b19b382BeDc80e6D1a77e8e' },
  { symbol: '果蝇', address: '0x73Ea708d048A55DBcF07E064885A30C3A61429db' },
  { symbol: 'SAGA', address: '0x1466f357F40b2C4e6b8D3C3A28C01e5e8B7b1289' },
  { symbol: 'PNT', address: '0x673eAf2F1b20c2fC9F0957E8e4C431B209e0Ac59' },
];

async function getTokenMomentum(token) {
  try {
    const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
    if (!data || !data.pairs || data.pairs.length === 0) return null;
    
    const bscPair = data.pairs.find(p => p.chainId === 'bsc') || data.pairs[0];
    if (!bscPair) return null;
    
    return {
      symbol: token.symbol,
      address: token.address,
      price: bscPair.priceUsd,
      h5: bscPair.priceChange?.h5 || 0,
      h1: bscPair.priceChange?.h1 || 0,
      h6: bscPair.priceChange?.h6 || 0,
      h24: bscPair.priceChange?.h24 || 0,
      buys5m: bscPair.txns?.m5?.buys || bscPair.txns?.h5?.buys || 0,
      sells5m: bscPair.txns?.m5?.sells || bscPair.txns?.h5?.sells || 0,
      buysH1: bscPair.txns?.h1?.buys || 0,
      sellsH1: bscPair.txns?.h1?.sells || 0,
      vol5m: bscPair.volume?.m5 || 0,
      volH1: bscPair.volume?.h1 || 0,
      vol24: bscPair.volume?.h24 || 0,
      liq: bscPair.liquidity?.usd || 0,
      fdv: bscPair.fdv || 0,
      pair: bscPair.pairAddress,
    };
  } catch(e) {
    return null;
  }
}

async function main() {
  console.log('🔥⚔️  ALPHA WARRIOR — LIVE MOMENTUM SCANNER  ⚔️🔥');
  console.log('Checking all known tradeable Binance Alpha tokens...\n');
  
  const results = [];
  
  for (const token of ALPHA_TOKENS) {
    process.stdout.write(`Scanning ${token.symbol}...`);
    const data = await getTokenMomentum(token);
    if (data) {
      results.push(data);
      const buyP = data.sells5m > 0 ? (data.buys5m / data.sells5m).toFixed(1) : data.buys5m + ':0';
      console.log(` $${data.price} | 5m: ${data.h5 > 0 ? '+' : ''}${data.h5}% | 1h: ${data.h1 > 0 ? '+' : ''}${data.h1}% | ${data.buys5m}B/${data.sells5m}S`);
    } else {
      console.log(' no data');
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Score and rank
  const scored = results
    .filter(r => r.buys5m + r.sells5m > 0 || r.h1 !== 0 || r.h5 !== 0)
    .map(r => {
      const buyRatio = r.sells5m > 0 ? r.buys5m / r.sells5m : (r.buys5m > 0 ? 10 : 0);
      const score = (
        r.h5 * 3.0 +            // 5m momentum (heaviest)
        r.h1 * 2.0 +            // 1h momentum
        buyRatio * 5.0 +        // buy pressure
        (r.buys5m > r.sells5m ? 15 : -5) + // buy dominance
        (r.vol5m > 5000 ? 10 : r.vol5m > 1000 ? 5 : 0) + // 5m volume
        Math.min(r.buys5m, 20) * 0.5 // trade count bonus
      );
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);
  
  // Also get ALL BSC tokens trending on DexScreener
  console.log('\n\n🔍 Also scanning DexScreener for trending BSC tokens...\n');
  
  let trending = [];
  try {
    const boosts = await fetchJSON('https://api.dexscreener.com/token-boosts/top/v1');
    if (Array.isArray(boosts)) {
      const bscTokens = boosts.filter(t => t.chainId === 'bsc').slice(0, 10);
      for (const t of bscTokens) {
        process.stdout.write(`Trending: ${t.tokenAddress.slice(0,8)}...`);
        const data = await getTokenMomentum({ symbol: t.tokenAddress.slice(0,8), address: t.tokenAddress });
        if (data) {
          trending.push(data);
          console.log(` ✅ $${data.price} | 5m: ${data.h5 > 0 ? '+' : ''}${data.h5}%`);
        } else {
          console.log(' no data');
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }
  } catch(e) {
    console.log('Trending scan failed:', e.message);
  }
  
  // Merge and deduplicate
  const allTokens = new Map();
  for (const t of [...scored, ...trending]) {
    if (!allTokens.has(t.address)) {
      const buyRatio = t.sells5m > 0 ? t.buys5m / t.sells5m : (t.buys5m > 0 ? 10 : 0);
      const score = (
        t.h5 * 3.0 + t.h1 * 2.0 + buyRatio * 5.0 +
        (t.buys5m > t.sells5m ? 15 : -5) +
        (t.vol5m > 5000 ? 10 : t.vol5m > 1000 ? 5 : 0) +
        Math.min(t.buys5m, 20) * 0.5
      );
      allTokens.set(t.address, { ...t, score });
    }
  }
  
  const final = Array.from(allTokens.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏆 TOP ALPHA TOKENS BY MOMENTUM + BUY PRESSURE');
  console.log('='.repeat(80) + '\n');
  
  final.forEach((t, i) => {
    const emoji = t.h5 > 3 ? '🚀🚀' : t.h5 > 1 ? '🚀' : t.h5 > 0 ? '🟢' : t.h5 > -1 ? '🟡' : '🔴';
    const buyP = t.sells5m > 0 ? (t.buys5m / t.sells5m).toFixed(1) : t.buys5m + ':0';
    console.log(`${emoji} #${i+1} ${t.symbol} (Score: ${t.score.toFixed(1)})`);
    console.log(`   Price: $${t.price}`);
    console.log(`   5m: ${t.h5 > 0 ? '+' : ''}${t.h5}% | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1}% | 6h: ${t.h6 > 0 ? '+' : ''}${t.h6}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24}%`);
    console.log(`   5m Trades: ${t.buys5m}B / ${t.sells5m}S (${buyP}x buy pressure)`);
    console.log(`   Vol: 5m=$${(t.vol5m/1000).toFixed(1)}k | 1h=$${(t.volH1/1000).toFixed(1)}k | 24h=$${(t.vol24/1000).toFixed(1)}k`);
    console.log(`   Liquidity: $${(t.liq/1000).toFixed(1)}k | FDV: $${(t.fdv/1000).toFixed(1)}k`);
    console.log(`   Address: ${t.address}`);
    console.log('');
  });
  
  console.log('💰 Your wallet: ~$10.58 USDT + $0.72 BNB');
  console.log('🎯 Strategy: ALL IN on the hottest momentum play!\n');
}

main();
