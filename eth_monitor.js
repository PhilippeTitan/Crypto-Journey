const https = require('https');
const { execSync } = require('child_process');

const CHECK_INTERVAL_MS = 10000;
const STARTING_TOTAL = 10.09; // After gas fees

function getEthPrice() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.binance.com',
      path: '/api/v3/ticker/price?symbol=ETHUSDT',
      method: 'GET'
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(parseFloat(JSON.parse(data).price)));
    });
    req.on('error', reject);
    req.end();
  });
}

function getWalletBalance() {
  try {
    const output = execSync('baw wallet balance', { encoding: 'utf8', timeout: 15000 });
    const lines = output.trim().split('\n').filter(l => l.trim() && !l.includes('──'));
    let usdt = 0, eth = 0, bnb = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'USDT') usdt = parseFloat(parts[2]);
      if (parts[0] === 'BNB') bnb = parseFloat(parts[2]);
      if (parts[0] === 'BSC_ETH') eth = parseFloat(parts[2]);
    }
    return { usdt, eth, bnb };
  } catch (e) {
    return null;
  }
}

async function monitor() {
  console.log('🤖 ETH TRADING BOT');
  console.log('========================');
  console.log('Monitoring: ETH position ($2.00)');
  console.log('Target: +$0.50 profit / -$1.00 stop loss');
  console.log('========================\n');
  
  while (true) {
    try {
      const ethPrice = await getEthPrice();
      const balance = getWalletBalance();
      
      if (!balance) {
        await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
        continue;
      }
      
      const ethValue = balance.eth * ethPrice;
      const totalValue = balance.usdt + ethValue + balance.bnb;
      const pnl = totalValue - STARTING_TOTAL;
      
      console.log(`[${new Date().toLocaleTimeString()}] ETH: $${ethPrice.toFixed(2)} | ${balance.eth.toFixed(6)} ETH ($${ethValue.toFixed(2)}) + $${balance.usdt.toFixed(2)} USDT | Total: $${totalValue.toFixed(2)} | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
      
      // Take profit: +$0.50
      if (totalValue >= STARTING_TOTAL + 0.50) {
        console.log('\n🎉 TAKE PROFIT HIT!');
        try {
          const qty = balance.eth.toFixed(6);
          const result = execSync(`baw market-order swap --fromTokenQty ${qty} --fromToken 0x2170Ed0880ac9A755fd29B2688956BD959F933F8 --toToken 0x55d398326f99059fF775485246999027B3197955 --binanceChainId 56 --slippage 1 --mev true --gasLevel LOW --json`, { encoding: 'utf8', timeout: 30000 });
          console.log('SELL:', result);
        } catch (e) { console.log('Error:', e.message); }
        break;
      }
      
      // Stop loss: -$1.00
      if (totalValue <= STARTING_TOTAL - 1.00) {
        console.log('\n🛑 STOP LOSS HIT!');
        try {
          const qty = balance.eth.toFixed(6);
          const result = execSync(`baw market-order swap --fromTokenQty ${qty} --fromToken 0x2170Ed0880ac9A755fd29B2688956BD959F933F8 --toToken 0x55d398326f99059fF775485246999027B3197955 --binanceChainId 56 --slippage 1 --mev true --gasLevel LOW --json`, { encoding: 'utf8', timeout: 30000 });
          console.log('SELL:', result);
        } catch (e) { console.log('Error:', e.message); }
        break;
      }
      
    } catch (err) {
      console.error('Error:', err.message);
    }
    
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
  
  console.log('\nBot stopped.');
}

monitor();
