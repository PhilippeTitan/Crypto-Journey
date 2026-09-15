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

async function getToken1m(address) {
  try {
    const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (data && data.pairs && data.pairs[0]) {
      const p = data.pairs[0];
      return {
        symbol: p.baseToken.symbol,
        price: p.priceUsd,
        m5: p.priceChange?.m5,
        h1: p.priceChange?.h1,
        h6: p.priceChange?.h6,
        h24: p.priceChange?.h24,
        txns_m5_buys: p.txns?.m5?.buys || 0,
        txns_m5_sells: p.txns?.m5?.sells || 0,
        txns_h1_buys: p.txns?.h1?.buys || 0,
        txns_h1_sells: p.txns?.h1?.sells || 0,
        vol: p.volume?.m5 || 0,
        liq: p.liquidity?.usd || 0,
        fdv: p.fdv || 0,
        address: address
      };
    }
  } catch(e) {}
  return null;
}

async function main() {
  // Tradeable tokens from previous scan
  const tokens = [
    { name: 'Fly', address: '0x73805a46c4c3551574214c8C51813Af2182C7777' },
    { name: 'NECTAR', address: '0x1f88980913b5973bB18643c4f7663708ab9c7777' },
    { name: '果蝇', address: '0x2b90BB9683383B6A1440e116309Ba0187ef67777' },
    { name: 'BNBCAT', address: '0x3EFBfFf95576e1d23cF6Ead0AcD2E73F4d6A7777' },
    { name: 'AFOB', address: '0x5EB323BD76D309c9916C942cfe8c813626467777' },
    { name: 'BinanceTown', address: '0xe210C0583C1071714EDed2d8bEEab05Ab5bB7777' },
    { name: 'CREAM', address: '0x619c7479e44741cb5548b6d685291d3e594D8888' },
    { name: 'FF', address: '0xAC23B90A79504865D52B49B327328411a23d4dB2' },
    { name: 'TUT', address: '0xCAAE2A2F939F51d97CdFa9A86e79e3F085b799f3' },
  ];

  console.log('=== 1-MINUTE CHART SCAN ===');
  console.log('Market: BTC -4% | Scanning for tokens with 1m momentum\n');

  const results = [];
  
  for (const t of tokens) {
    const data = await getToken1m(t.address);
    if (data) results.push(data);
    await new Promise(r => setTimeout(r, 150));
  }

  // Sort by 5min change (closest to 1min we can get from DexScreener)
  results.sort((a, b) => (b.m5 || -999) - (a.m5 || -999));

  results.forEach((t, i) => {
    const m5 = t.m5;
    const buyRatio = t.txns_m5_buys / (t.txns_m5_buys + t.txns_m5_sells || 1);
    const emoji = m5 > 0 ? 'GREEN' : (m5 > -2 ? 'FLAT' : 'RED');
    const buyPressure = buyRatio > 0.6 ? 'BUY PRESSURE' : (buyRatio < 0.4 ? 'SELL PRESSURE' : 'NEUTRAL');
    
    console.log(`${i+1}. [${emoji}] ${t.symbol}`);
    console.log(`   5m: ${m5 > 0 ? '+' : ''}${m5}% | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24}%`);
    console.log(`   5m Txns: ${t.txns_m5_buys} buys / ${t.txns_m5_sells} sells → ${buyPressure} (${(buyRatio * 100).toFixed(0)}% buys)`);
    console.log(`   5m Vol: $${t.vol.toFixed(0)} | Liq: $${(t.liq/1000).toFixed(1)}k | FDV: $${(t.fdv/1000).toFixed(1)}k`);
    console.log(`   Price: $${t.price}`);
    console.log('');
  });

  // Highlight the best 1m candidates
  const green = results.filter(t => t.m5 > 0 && t.txns_m5_buys > t.txns_m5_sells);
  if (green.length > 0) {
    console.log('=== 🎯 BEST 1m CANDIDATES (green + buy pressure) ===');
    green.forEach(t => {
      console.log(`  ${t.symbol}: 5m +${t.m5}% | ${t.txns_m5_buys}B/${t.txns_m5_sells}S | $${t.price}`);
    });
  } else {
    console.log('=== ⚠️ NO green tokens with buy pressure right now ===');
    console.log('Market is dumping. Consider waiting for a bounce.');
  }
}

main();
