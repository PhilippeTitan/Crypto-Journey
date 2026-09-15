const https = require('https');
const { execSync } = require('child_process');

const DOGE_ADDRESS = '0xbA2aE424d960c26247Dd6c32edC70B295c744C43';
const ENTRY_PRICE = 0.08077;
const ENTRY_VALUE = 10.54;
const TOKENS_HELD = 130.505;
const TAKE_PROFIT = 0.53;   // +5% = +$0.53 (more realistic target)
const STOP_LOSS = 0.32;     // -3% = -$0.32 (tight protection)
const CHECK_INTERVAL = 8000; // 8 seconds

function getDogeData() {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://api.dexscreener.com/latest/dex/tokens/${DOGE_ADDRESS}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.pairs && json.pairs[0]) {
            const p = json.pairs[0];
            resolve({
              price: parseFloat(p.priceUsd),
              m5: p.priceChange?.m5,
              h1: p.priceChange?.h1,
              buys5m: p.txns?.m5?.buys || 0,
              sells5m: p.txns?.m5?.sells || 0,
              vol5m: p.volume?.m5 || 0,
            });
          } else { resolve(null); }
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function monitor() {
  console.log('🐕 DOGE LIVE MONITOR');
  console.log('========================');
  console.log(`Entry: $${ENTRY_PRICE} | Holding: ${TOKENS_HELD} tokens ($${ENTRY_VALUE})`);
  console.log(`Take Profit: +$${TAKE_PROFIT.toFixed(2)} (sell at $${(ENTRY_VALUE + TAKE_PROFIT).toFixed(2)})`);
  console.log(`Stop Loss: -$${STOP_LOSS.toFixed(2)} (sell at $${(ENTRY_VALUE - STOP_LOSS).toFixed(2)})`);
  console.log(`Updates: every ${CHECK_INTERVAL/1000}s`);
  console.log('========================\n');

  let highWaterMark = ENTRY_VALUE;
  
  while (true) {
    try {
      const data = await getDogeData();
      if (!data) { await new Promise(r => setTimeout(r, CHECK_INTERVAL)); continue; }
      
      const currentPrice = data.price;
      const currentValue = TOKENS_HELD * currentPrice;
      const pnl = currentValue - ENTRY_VALUE;
      const pnlPct = (pnl / ENTRY_VALUE * 100).toFixed(2);
      
      if (currentValue > highWaterMark) highWaterMark = currentValue;
      
      const buyRatio = data.buys5m / (data.buys5m + data.sells5m || 1);
      const pressure = buyRatio > 0.6 ? 'BUY' : (buyRatio < 0.4 ? 'SELL' : 'NEUTRAL');
      const time = new Date().toLocaleTimeString();
      
      console.log(`[${time}] $${currentPrice.toFixed(8)} | $${currentValue.toFixed(2)} | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct}%) | 5m: ${data.m5 > 0 ? '+' : ''}${data.m5}% | ${data.buys5m}B/${data.sells5m}S [${pressure}]`);
      
      // TAKE PROFIT — +10%
      if (pnl >= TAKE_PROFIT) {
        console.log(`\n🎉🎉🎉 TAKE PROFIT HIT! +$${pnl.toFixed(2)} (${pnlPct}%)`);
        console.log('Auto-selling DOGE → USDT...');
        try {
          const qty = (TOKENS_HELD - 0.001).toFixed(2); // slight buffer for decimals
          const result = execSync(`baw market-order swap --fromTokenQty ${qty} --fromToken ${DOGE_ADDRESS} --toToken 0x55d398326f99059fF775485246999027B3197955 --binanceChainId 56 --slippage 3 --mev true --gasLevel LOW --json`, { encoding: 'utf8', timeout: 30000 });
          console.log('SELL:', result);
        } catch(e) { console.log('Sell error:', e.message); }
        break;
      }
      
      // STOP LOSS — -5%
      if (pnl <= -STOP_LOSS) {
        console.log(`\n🛑🛑🛑 STOP LOSS HIT! -$${Math.abs(pnl).toFixed(2)} (${pnlPct}%)`);
        console.log('Auto-selling DOGE → USDT...');
        try {
          const qty = (TOKENS_HELD - 0.001).toFixed(2);
          const result = execSync(`baw market-order swap --fromTokenQty ${qty} --fromToken ${DOGE_ADDRESS} --toToken 0x55d398326f99059fF775485246999027B3197955 --binanceChainId 56 --slippage 3 --mev true --gasLevel LOW --json`, { encoding: 'utf8', timeout: 30000 });
          console.log('SELL:', result);
        } catch(e) { console.log('Sell error:', e.message); }
        break;
      }
      
      // TRAILING STOP — if we hit +2% but then drop 1.5% from peak
      if (highWaterMark > ENTRY_VALUE * 1.02) {
        const trailingStop = highWaterMark * 0.985;
        if (currentValue <= trailingStop) {
          console.log(`\n📉 TRAILING STOP! Peaked at $${highWaterMark.toFixed(2)}, now $${currentValue.toFixed(2)}`);
          console.log('Auto-selling DOGE → USDT...');
          try {
            const qty = (TOKENS_HELD - 0.001).toFixed(2);
            const result = execSync(`baw market-order swap --fromTokenQty ${qty} --fromToken ${DOGE_ADDRESS} --toToken 0x55d398326f99059fF775485246999027B3197955 --binanceChainId 56 --slippage 3 --mev true --gasLevel LOW --json`, { encoding: 'utf8', timeout: 30000 });
            console.log('SELL:', result);
          } catch(e) { console.log('Sell error:', e.message); }
          break;
        }
      }
      
    } catch(err) {
      console.error('Error:', err.message);
    }
    
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
  
  console.log('\nMonitor stopped. Check wallet balance.');
  try {
    const bal = execSync('baw wallet balance --json', { encoding: 'utf8' });
    console.log(bal);
  } catch(e) {}
}

monitor();
