const https = require('https');
const { execSync } = require('child_process');

// Configuration
const ENTRY_USDT = 2.00;
const TAKE_PROFIT_USD = 0.50;
const STOP_LOSS_USD = 1.00;
const CHECK_INTERVAL_MS = 15000;
const STARTING_TOTAL = 10.93;

function getBnbPrice() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.binance.com',
      path: '/api/v3/ticker/price?symbol=BNBUSDT',
      method: 'GET'
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve(parseFloat(JSON.parse(data).price));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getWalletBalance() {
  try {
    const output = execSync('baw wallet balance', { encoding: 'utf8', timeout: 15000 });
    const lines = output.trim().split('\n').filter(l => l.trim() && !l.includes('──'));
    let usdt = 0, bnb = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'USDT') usdt = parseFloat(parts[2]);
      if (parts[0] === 'BNB') bnb = parseFloat(parts[2]);
    }
    return { usdt, bnb };
  } catch (e) {
    return null;
  }
}

async function monitor() {
  console.log('🤖 TRADING BOT ACTIVE');
  console.log('========================');
  console.log(`Position: $${ENTRY_USDT} USDT → BNB`);
  console.log(`Take Profit: +$${TAKE_PROFIT_USD} (total ≥ $${(STARTING_TOTAL + TAKE_PROFIT_USD).toFixed(2)})`);
  console.log(`Stop Loss: -$${STOP_LOSS_USD} (total ≤ $${(STARTING_TOTAL - STOP_LOSS_USD).toFixed(2)})`);
  console.log(`Update every: ${CHECK_INTERVAL_MS/1000}s`);
  console.log('========================\n');
  
  while (true) {
    try {
      const bnbPrice = await getBnbPrice();
      const balance = getWalletBalance();
      
      if (!balance) {
        console.log(`[${new Date().toLocaleTimeString()}] Could not read wallet balance, retrying...`);
        await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
        continue;
      }
      
      const bnbValue = balance.bnb * bnbPrice;
      const totalValue = balance.usdt + bnbValue;
      const pnl = totalValue - STARTING_TOTAL;
      const pnlPct = (pnl / STARTING_TOTAL * 100).toFixed(2);
      
      console.log(`[${new Date().toLocaleTimeString()}] BNB: $${bnbPrice.toFixed(2)} | ${balance.bnb.toFixed(6)} BNB ($${bnbValue.toFixed(2)}) + $${balance.usdt.toFixed(2)} USDT = $${totalValue.toFixed(2)} | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct}%)`);
      
      if (totalValue >= STARTING_TOTAL + TAKE_PROFIT_USD) {
        console.log('\n🎉🎉🎉 TAKE PROFIT HIT! 🎉🎉🎉');
        console.log(`Total: $${totalValue.toFixed(2)} (Profit: +$${pnl.toFixed(2)})`);
        console.log('Auto-selling BNB → USDT...');
        try {
          const result = execSync(`baw market-order swap --fromTokenQty ${balance.bnb.toFixed(6)} --fromToken 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE --toToken 0x55d398326f99059fF775485246999027B3197955 --binanceChainId 56 --slippage 1 --mev true --gasLevel LOW --json`, { encoding: 'utf8', timeout: 30000 });
          console.log('Sell order:', result);
        } catch (e) {
          console.log('Sell failed:', e.message);
        }
        break;
      }
      
      if (totalValue <= STARTING_TOTAL - STOP_LOSS_USD) {
        console.log('\n🛑🛑🛑 STOP LOSS HIT! 🛑🛑🛑');
        console.log(`Total: $${totalValue.toFixed(2)} (Loss: -$${Math.abs(pnl).toFixed(2)})`);
        console.log('Auto-selling BNB → USDT...');
        try {
          const result = execSync(`baw market-order swap --fromTokenQty ${balance.bnb.toFixed(6)} --fromToken 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE --toToken 0x55d398326f99059fF775485246999027B3197955 --binanceChainId 56 --slippage 1 --mev true --gasLevel LOW --json`, { encoding: 'utf8', timeout: 30000 });
          console.log('Sell order:', result);
        } catch (e) {
          console.log('Sell failed:', e.message);
        }
        break;
      }
      
    } catch (err) {
      console.error('Error:', err.message);
    }
    
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
  
  console.log('\nBot stopped. Check wallet balance for final result.');
}

monitor();
