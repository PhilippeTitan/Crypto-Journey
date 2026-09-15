const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');
require('dotenv').config();

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

function sign(queryString) {
  return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
}

function binanceGet(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    params.timestamp = Date.now();
    const qs = Object.entries(params).map(([k,v]) => `${k}=${v}`).join('&');
    const signature = sign(qs);
    
    const options = {
      hostname: 'api.binance.com',
      path: `${endpoint}?${qs}&signature=${signature}`,
      headers: { 'X-MBX-APIKEY': API_KEY },
    };
    
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
  });
}

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

function getKlines(symbol, interval, limit = 6) {
  return new Promise((resolve, reject) => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.map(k => ({
            open: parseFloat(k[1]),
            close: parseFloat(k[2]),
            high: parseFloat(k[3]),
            low: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            quoteVol: parseFloat(k[7]),
            trades: parseInt(k[8]),
            change: ((parseFloat(k[2]) - parseFloat(k[1])) / parseFloat(k[1]) * 100),
          })));
        } catch(e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
  });
}

function checkTradeability(address) {
  try {
    const result = execSync(
      `baw market-order quote --fromTokenQty 1 --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken ${address} --binanceChainId 56 --json`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const parsed = JSON.parse(result);
    return parsed.success === true;
  } catch(e) {
    return false;
  }
}

async function getDexScreener(address) {
  try {
    const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (data?.pairs?.length > 0) {
      return data.pairs.find(p => p.chainId === 'bsc') || data.pairs[0];
    }
  } catch(e) {}
  return null;
}

// Known BSC Alpha token addresses
const ALPHA_TOKENS = [
  { symbol: 'AFOB', address: '0x5EB323BD76D309c9916C942cfe8c813626467777', cex: null },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', cex: 'CAKEUSDT' },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', cex: 'ETHUSDT' },
  { symbol: 'BNX', address: '0x7F6f1E61c2281f4127394fE878b5E7e4c0F6376e', cex: 'BNXUSDT' },
  { symbol: 'ALPINE', address: '0x2C7D8fC9d5795213089E8bf46a8a1AF43D9c3c45', cex: 'ALPINEUSDT' },
  { symbol: 'LAZIO', address: '0x82632D6C46C5B462C9957Ab1b499320343c20D52', cex: 'LAZIOUSDT' },
  { symbol: 'PORTO', address: '0x49f217555129171689C283b7b0E6650802292d42', cex: 'PORTOUSDT' },
  { symbol: 'SANTOS', address: '0xA64455a451c7424b9AD09Ed1D131586111387Ec7', cex: 'SANTOSUSDT' },
  { symbol: 'JUV', address: '0xc62C7d12524B6C2a92075F9517F3B40Cbb49bf75', cex: 'JUVUSDT' },
  { symbol: 'BAR', address: '0x408ED6354d4973f662A020984831991561B50865', cex: 'BARUSDT' },
  { symbol: 'OG', address: '0x75235DB2CC622F83643C2218A00F57c4A2d12c6F', cex: 'OGUSDT' },
  { symbol: '1INCH', address: '0x111111111117dC0aa78b770fA6A738034120C302', cex: '1INCHUSDT' },
  { symbol: 'BLUR', address: '0x31c64A40F481c1252B386716399246F3d50B80E3', cex: 'BLURUSDT' },
  { symbol: 'ARKM', address: '0x6C6ee5E31D828De241282B9606C8e98Ea48580e7', cex: 'ARKMUSDT' },
  { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', cex: 'DOGEUSDT' },
  { symbol: 'SUI', address: '0xd87E37264dBBc0C495D8E7071D6d566506cC0c48', cex: 'SUIUSDT' },
  { symbol: 'FF', address: '0x22fF10E0e88d582e8e50059cBeE5BAb36e703760', cex: null },
  { symbol: 'TUT', address: '0xA26d1F29891253B78A64543A4a5B484E79921245', cex: null },
  { symbol: 'CREAM', address: '0xD5664B890035B3c3187B97E982180786F7f398F5', cex: null },
  { symbol: 'GICAT', address: '0x46E04CaE45b62bF8B97986cEBE2f4B0b1d7a9436', cex: null },
  { symbol: 'NECTAR', address: '0x4235ad74177C5e47c5e2DF62ab4b104e1e710845', cex: null },
  { symbol: 'BNBCAT', address: '0x6Bd516637b9B8E1F4E2e6E0a8b981D4C5e39142D', cex: null },
  { symbol: 'PNT', address: '0x673eAf2F1b20c2fC9F0957E8e4C431B209e0Ac59', cex: 'PNTUSDT' },
];

async function main() {
  console.log('🔥🔥🔥 BINANCE ALPHA LIVE SCANNER 🔥🔥🔥');
  console.log(`⏰ ${new Date().toLocaleTimeString()}\n`);
  
  // Phase 1: Get 5m + 1h klines from Binance for all CEX-listed alpha tokens
  console.log('📡 Phase 1: Binance klines for Alpha tokens...\n');
  
  const results = [];
  
  for (const token of ALPHA_TOKENS) {
    process.stdout.write(`${token.symbol.padEnd(10)} `);
    
    let klines5m = [], klines1h = [];
    let dex = null;
    
    if (token.cex) {
      [klines5m, klines1h] = await Promise.all([
        getKlines(token.cex, '5m', 6),
        getKlines(token.cex, '1h', 3),
      ]);
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Also get DexScreener for on-chain buy/sell data
    dex = await getDexScreener(token.address);
    await new Promise(r => setTimeout(r, 200));
    
    // Calculate 5m momentum from latest candle
    const h5 = klines5m.length > 0 ? klines5m[klines5m.length - 1].change : 0;
    const h1 = klines1h.length > 0 ? klines1h[klines1h.length - 1].change : 0;
    const h5Vol = klines5m.reduce((s, k) => s + k.quoteVol, 0);
    const h5Trades = klines5m.reduce((s, k) => s + k.trades, 0);
    
    const buys5m = dex?.txns?.m5?.buys || dex?.txns?.h5?.buys || 0;
    const sells5m = dex?.txns?.m5?.sells || dex?.txns?.h5?.sells || 0;
    const buyPressure = sells5m > 0 ? buys5m / sells5m : (buys5m > 0 ? 10 : 0);
    const price = dex?.priceUsd || (klines5m.length > 0 ? klines5m[klines5m.length-1].close : 0);
    const vol24 = dex?.volume?.h24 || 0;
    
    results.push({
      symbol: token.symbol,
      address: token.address,
      price,
      h5, h1,
      h24: dex?.priceChange?.h24 || 0,
      vol5m: h5Vol,
      h5Trades,
      vol24,
      buys5m, sells5m,
      buyPressure,
      liq: dex?.liquidity?.usd || 0,
    });
    
    const h5Str = `${h5 > 0 ? '+' : ''}${h5.toFixed(2)}%`;
    const h1Str = `${h1 > 0 ? '+' : ''}${h1.toFixed(2)}%`;
    const bsStr = `${buys5m}B/${sells5m}S`;
    console.log(`5m:${h5Str.padEnd(8)} 1h:${h1Str.padEnd(8)} ${bsStr}`);
  }
  
  // Phase 2: Also scan top BSC boosts from DexScreener
  console.log('\n📡 Phase 2: DexScreener top BSC boosts...\n');
  
  try {
    const boosts = await fetchJSON('https://api.dexscreener.com/token-boosts/top/v1');
    if (Array.isArray(boosts)) {
      const bscBoosts = boosts.filter(t => t.chainId === 'bsc').slice(0, 10);
      for (const t of bscBoosts) {
        process.stdout.write(`${t.tokenAddress.slice(0,8)}... `);
        const dex = await getDexScreener(t.tokenAddress);
        await new Promise(r => setTimeout(r, 200));
        
        if (dex) {
          const buys = dex.txns?.m5?.buys || 0;
          const sells = dex.txns?.m5?.sells || 0;
          const bp = sells > 0 ? buys / sells : (buys > 0 ? 10 : 0);
          const h5 = dex.priceChange?.m5 || dex.priceChange?.h5 || 0;
          
          results.push({
            symbol: dex.baseToken?.symbol || t.tokenAddress.slice(0,8),
            address: t.tokenAddress,
            price: dex.priceUsd,
            h5, h1: dex.priceChange?.h1 || 0,
            h24: dex.priceChange?.h24 || 0,
            vol5m: dex.volume?.m5 || 0,
            h5Trades: buys + sells,
            vol24: dex.volume?.h24 || 0,
            buys5m: buys, sells5m: sells,
            buyPressure: bp,
            liq: dex.liquidity?.usd || 0,
          });
          
          console.log(`${dex.baseToken?.symbol?.padEnd(10)} 5m:${h5 > 0 ? '+' : ''}${h5.toFixed(2)}% ${buys}B/${sells}S`);
        } else {
          console.log('no data');
        }
      }
    }
  } catch(e) {
    console.log('Boost scan failed:', e.message);
  }
  
  // Phase 3: Score and rank everything
  const scored = results
    .map(r => {
      const bp = Math.min(r.buyPressure, 10);
      const score = (
        r.h5 * 3.0 +           // 5m price action
        r.h1 * 2.0 +           // 1h trend
        bp * 5.0 +             // buy pressure
        (r.buys5m > r.sells5m ? 15 : -5) + // buy dominance
        (r.vol5m > 10000 ? 10 : r.vol5m > 1000 ? 5 : 0) +
        Math.min(r.h5Trades, 20) * 0.5
      );
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);
  
  // Phase 4: Check tradeability of top candidates
  console.log('\n\n🔍 Phase 3: Checking baw tradeability for top 10...\n');
  
  const USDT = '0x55d398326f99059fF775485246999027B3197955';
  const tradeable = [];
  
  for (const t of scored.slice(0, 10)) {
    process.stdout.write(`${t.symbol.padEnd(12)} `);
    if (checkTradeability(t.address)) {
      tradeable.push(t);
      console.log('✅ TRADEABLE!');
    } else {
      console.log('❌ no');
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Final output
  console.log('\n' + '🏆'.repeat(30));
  console.log('FINAL RANKINGS — ALL TRADEABLE TOKENS');
  console.log('🏆'.repeat(30) + '\n');
  
  const finalList = tradeable.length > 0 ? tradeable : scored.slice(0, 5);
  
  finalList.forEach((t, i) => {
    const emoji = t.h5 > 3 ? '🚀🚀🚀' : t.h5 > 1 ? '🚀' : t.h5 > 0 ? '🟢' : t.h5 > -1 ? '🟡' : '🔴';
    console.log(`${emoji} #${i+1} ${t.symbol} (Score: ${t.score.toFixed(1)})`);
    console.log(`   Price: $${t.price}`);
    console.log(`   5m: ${t.h5 > 0 ? '+' : ''}${t.h5.toFixed(2)}% | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1.toFixed(2)}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24.toFixed(2)}%`);
    console.log(`   5m Trades: ${t.buys5m}B / ${t.sells5m}S (${t.buyPressure.toFixed(1)}x)`);
    console.log(`   Vol: 5m=$${(t.vol5m/1000).toFixed(1)}k | 24h=$${(t.vol24/1000).toFixed(1)}k`);
    console.log(`   Liquidity: $${(t.liq/1000).toFixed(1)}k`);
    console.log(`   Address: ${t.address}`);
    console.log('');
  });
  
  console.log('💰 Wallet: ~$10.58 USDT + $0.72 BNB');
  console.log('🎯 Ready to GO BIGGER!\n');
}

main();
