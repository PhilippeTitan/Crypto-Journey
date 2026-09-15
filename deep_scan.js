const https = require('https');
const { execSync } = require('child_process');
require('dotenv').config();

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function checkTradeability(address) {
  try {
    const result = execSync(
      `baw market-order quote --fromTokenQty 1 --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken ${address} --binanceChainId 56 --json`,
      { encoding: 'utf8', timeout: 15000 }
    );
    return JSON.parse(result).success === true;
  } catch(e) {
    return false;
  }
}

async function main() {
  console.log('🔍 DEEP ALPHA SCAN — Finding hidden gems\n');
  
  // Get ALL DexScreener BSC pairs with volume
  const searches = [
    'https://api.dexscreener.com/latest/dex/search?q=a',
    'https://api.dexscreener.com/latest/dex/search?q=b',
    'https://api.dexscreener.com/latest/dex/search?q=c',
    'https://api.dexscreener.com/latest/dex/search?q=d',
    'https://api.dexscreener.com/latest/dex/search?q=e',
  ];
  
  // Get trending/boosted tokens
  console.log('📡 Getting DexScreener trending BSC tokens...\n');
  
  const trendingAddresses = new Set();
  
  try {
    const boosts = await fetchJSON('https://api.dexscreener.com/token-boosts/top/v1');
    if (Array.isArray(boosts)) {
      boosts.filter(t => t.chainId === 'bsc').forEach(t => trendingAddresses.add(t.tokenAddress));
      console.log(`Found ${trendingAddresses.size} trending BSC tokens`);
    }
  } catch(e) {}
  
  // Also get trending pairs
  try {
    const trending = await fetchJSON('https://api.dexscreener.com/latest/dex/search?q=trending');
    if (trending?.pairs) {
      trending.pairs.filter(p => p.chainId === 'bsc').forEach(p => trendingAddresses.add(p.baseToken?.address));
    }
  } catch(e) {}
  
  // Check each trending token for buy/sell data
  const candidates = [];
  const addresses = Array.from(trendingAddresses).slice(0, 20);
  
  for (const addr of addresses) {
    if (!addr) continue;
    process.stdout.write(`${addr.slice(0,8)}... `);
    
    try {
      const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
      if (data?.pairs?.length > 0) {
        const bsc = data.pairs.find(p => p.chainId === 'bsc') || data.pairs[0];
        if (bsc) {
          const buys = bsc.txns?.m5?.buys || bsc.txns?.h5?.buys || 0;
          const sells = bsc.txns?.m5?.sells || bsc.txns?.h5?.sells || 0;
          const h5 = bsc.priceChange?.m5 || bsc.priceChange?.h5 || 0;
          const vol5m = bsc.volume?.m5 || 0;
          const liq = bsc.liquidity?.usd || 0;
          
          if (buys + sells > 0 && vol5m > 100) {
            candidates.push({
              symbol: bsc.baseToken?.symbol || addr.slice(0,8),
              address: addr,
              price: bsc.priceUsd,
              h5, h1: bsc.priceChange?.h1 || 0,
              h24: bsc.priceChange?.h24 || 0,
              buys, sells,
              vol5m, vol24: bsc.volume?.h24 || 0,
              liq,
              fdv: bsc.fdv || 0,
            });
            console.log(`${bsc.baseToken?.symbol?.padEnd(12)} 5m:${h5 > 0 ? '+' : ''}${h5}% ${buys}B/${sells}S vol5m:$${(vol5m/1000).toFixed(1)}k liq:$${(liq/1000).toFixed(1)}k`);
          } else {
            console.log(`${bsc.baseToken?.symbol || '?'} (no 5m activity)`);
          }
        }
      }
    } catch(e) { console.log('error'); }
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Score
  const scored = candidates.map(c => {
    const bp = c.sells > 0 ? c.buys / c.sells : (c.buys > 0 ? 10 : 0);
    const score = c.h5 * 3 + c.h1 * 2 + bp * 5 + (c.buys > c.sells ? 15 : -5) + (c.vol5m > 5000 ? 10 : 0);
    return { ...c, score, bp };
  }).sort((a, b) => b.score - a.score);
  
  console.log('\n🏆 Top trending BSC tokens by momentum:\n');
  scored.slice(0, 10).forEach((t, i) => {
    console.log(`#${i+1} ${t.symbol} | 5m: ${t.h5 > 0 ? '+' : ''}${t.h5}% | ${t.buys}B/${t.sells}S (${t.bp.toFixed(1)}x) | Vol5m: $${(t.vol5m/1000).toFixed(1)}k`);
  });
  
  // Now test tradeability of top candidates
  console.log('\n\n🔍 Testing baw tradeability...\n');
  const USDT = '0x55d398326f99059fF775485246999027B3197955';
  const tradeable = [];
  
  for (const t of scored.slice(0, 15)) {
    process.stdout.write(`${t.symbol.padEnd(14)} `);
    if (checkTradeability(t.address)) {
      tradeable.push(t);
      console.log('✅ TRADEABLE!');
    } else {
      console.log('❌ no');
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Final
  console.log('\n' + '🎯'.repeat(20));
  console.log('TRADEABLE HIDDEN GEMS');
  console.log('🎯'.repeat(20) + '\n');
  
  tradeable.forEach((t, i) => {
    const emoji = t.h5 > 3 ? '🚀🚀' : t.h5 > 1 ? '🚀' : t.h5 > 0 ? '🟢' : '🔴';
    console.log(`${emoji} #${i+1} ${t.symbol}`);
    console.log(`   Price: $${t.price} | 5m: ${t.h5 > 0 ? '+' : ''}${t.h5}% | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24}%`);
    console.log(`   ${t.buys}B/${t.sells}S (${t.bp.toFixed(1)}x) | Vol5m: $${(t.vol5m/1000).toFixed(1)}k | Liq: $${(t.liq/1000).toFixed(1)}k | FDV: $${(t.fdv/1000).toFixed(1)}k`);
    console.log(`   Address: ${t.address}`);
    console.log('');
  });
  
  console.log(`💰 Wallet: ~$10.58 USDT + $0.72 BNB\n`);
}

main();
