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
  } catch(e) { return false; }
}

async function main() {
  console.log('🔥 HOT BSC SCAN — Direct token lookups\n');
  
  const USDT = '0x55d398326f99059fF775485246999027B3197955';
  
  // Comprehensive list of BSC Alpha / meme / hot tokens
  const tokens = [
    // Known Binance Alpha
    '0x5EB323BD76D309c9916C942cfe8c813626467777', // AFOB
    '0x22fF10E0e88d582e8e50059cBeE5BAb36e703760', // FF
    '0xA26d1F29891253B78A64543A4a5B484E79921245', // TUT
    '0xD5664B890035B3c3187B97E982180786F7f398F5', // CREAM
    '0x46E04CaE45b62bF8B97986cEBE2f4B0b1d7a9436', // GICAT
    '0x4235ad74177C5e47c5e2DF62ab4b104e1e710845', // NECTAR
    '0x6Bd516637b9B8E1F4E2e6E0a8b981D4C5e39142D', // BNBCAT
    '0x1B27B90Db3A78c6D8b19b382BeDc80e6D1a77e8e', // Fly
    '0x73Ea708d048A55DBcF07E064885A30C3A61429db', // 果蝇
    '0x5DB83d4C4861d940141B82936aE5951e98876a33', // BinanceTown
    '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE
    // BSC meme coins
    '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', // DOGE
    '0x6894CDe390a3f51155ea41Ed24a33A4827d3063D', // CAT
    '0x3323402bEB077D8a6E357e0bE641b71c7C4c543e', // BABYDOGE
    '0x145ca6Aa1B8A3e287B3f36447B2E5F83c7A538e6', // KISHU
    '0x9b5C88f3e5c38a87c5860B5B82b5c6788e5fF068', // MOG
    '0xE53173Fe5816c7EB771dB7bC56bD1575E7D55702', // CHEEMS
    '0x1d75801d84746B9C70f17AF89d5bB2e33814d924', // WOJAK
    '0x6982508145454Ce325dDbE47a25d4ec3d2311933', // PEPE
    // More BSC tokens
    '0x47cEBb4e2b9B423c6f6Ba64F515526A0BE918a10', // XVS
    '0x79533B044BdE133D5172C7274825038755b6aC3', // BAKE
    '0xCCF26B1955E04356701899BE5f21D973E4C4b2D3', // BUNNY
    '0x019981415746e38de0a952e90035c10B7132F80d', // BELT
    '0xA0c3E7A28A1131b8048d88D8BbE2151b8D08208e', // LIT
    '0x5962106A85f2029De7bC3b7C22d4c18aDE3154d3', // XVS (alt)
    '0x87De7381F3ec900b1bF1a539c6Fc398c158a534c', // MBOX
    '0x1382887797d507132571917472046e8E57aEb7E', // ALICE
    '0x2222227E22102E3e197213A5D5c108122f3484B5', // HIGH
    '0x179f37C1A9C3BCb54fBc1d76B045E68fB6155870', // MC
    '0x1fA447552C4127D773048f3Be0E3fF2279202b45', // PSG
    '0xD63719902CDf1B6b181EE2B6d7a849B3B0b82F72', // OG (alt)
  ];
  
  const results = [];
  
  for (const addr of tokens) {
    process.stdout.write(`${addr.slice(0,8)}... `);
    
    try {
      const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
      if (data?.pairs?.length > 0) {
        const bsc = data.pairs.find(p => p.chainId === 'bsc') || data.pairs[0];
        if (bsc) {
          const buys = bsc.txns?.m5?.buys || 0;
          const sells = bsc.txns?.m5?.sells || 0;
          const h5 = bsc.priceChange?.m5 || 0;
          const h1 = bsc.priceChange?.h1 || 0;
          const h24 = bsc.priceChange?.h24 || 0;
          const vol5m = bsc.volume?.m5 || 0;
          
          if (buys + sells > 0 || h5 !== 0) {
            const sym = bsc.baseToken?.symbol || addr.slice(0,8);
            console.log(`${sym.padEnd(12)} 5m:${h5 > 0 ? '+' : ''}${h5}% ${buys}B/${sells}S`);
            results.push({
              symbol: sym,
              address: addr,
              price: bsc.priceUsd,
              h5, h1, h24,
              buys, sells,
              vol5m,
              vol24: bsc.volume?.h24 || 0,
              liq: bsc.liquidity?.usd || 0,
              fdv: bsc.fdv || 0,
            });
          } else {
            console.log(`${bsc.baseToken?.symbol || '?'} (quiet)`);
          }
        }
      } else {
        console.log('no pairs');
      }
    } catch(e) { console.log('error'); }
    await new Promise(r => setTimeout(r, 250));
  }
  
  // Score and rank
  const scored = results.map(r => {
    const bp = r.sells > 0 ? r.buys / r.sells : (r.buys > 0 ? 10 : 0);
    const score = r.h5 * 3 + r.h1 * 2 + bp * 5 + (r.buys > r.sells ? 15 : -5) + (r.vol5m > 5000 ? 10 : 0) + Math.min(r.buys, 20) * 0.5;
    return { ...r, score, bp };
  }).sort((a, b) => b.score - a.score);
  
  console.log('\n\n🏆 RANKED BY MOMENTUM + BUY PRESSURE:\n');
  scored.forEach((t, i) => {
    const emoji = t.h5 > 3 ? '🚀🚀' : t.h5 > 1 ? '🚀' : t.h5 > 0 ? '🟢' : t.h5 > -1 ? '🟡' : '🔴';
    console.log(`${emoji} #${i+1} ${t.symbol.padEnd(12)} Score: ${t.score.toFixed(1)}`);
    console.log(`   Price: $${t.price} | 5m: ${t.h5 > 0 ? '+' : ''}${t.h5}% | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24}%`);
    console.log(`   ${t.buys}B/${t.sells}S (${t.bp.toFixed(1)}x) | Vol5m: $${(t.vol5m/1000).toFixed(1)}k | Liq: $${(t.liq/1000).toFixed(1)}k`);
    console.log('');
  });
  
  // Tradeability check for top 10
  console.log('🔍 Tradeability check (top 10):\n');
  const tradeable = [];
  for (const t of scored.slice(0, 10)) {
    process.stdout.write(`${t.symbol.padEnd(12)} `);
    if (checkTradeability(t.address)) {
      tradeable.push(t);
      console.log('✅');
    } else {
      console.log('❌');
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  if (tradeable.length > 0) {
    console.log('\n🎯 BEST TRADEABLE OPTIONS:\n');
    tradeable.forEach((t, i) => {
      console.log(`#${i+1} ${t.symbol} — ${t.h5 > 0 ? '+' : ''}${t.h5}% 5m | ${t.buys}B/${t.sells}S | $${t.price}`);
    });
  }
  
  console.log('\n💰 Wallet: ~$10.58 USDT\n');
}

main();
