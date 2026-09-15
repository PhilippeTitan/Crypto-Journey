const https = require('https');

// Configuration
const ENTRY_USDT = 2.00;           // How much USDT we spent
const TAKE_PROFIT_USD = 0.50;      // Target profit
const STOP_LOSS_USD = 1.00;        // Max loss
const CHECK_INTERVAL_MS = 10000;   // Check every 10 seconds

let running = true;

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
        const price = JSON.parse(data);
        resolve(parseFloat(price.price));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getBalance() {
  return new Promise((resolve, reject) => {
    const crypto = require('crypto');
    const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
    const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';
    const timestamp = Date.now();
    const queryString = 'timestamp=' + timestamp;
    const signature = crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
    const options = {
      hostname: 'api.binance.com',
      path: '/api/v3/account?' + queryString + '&signature=' + signature,
      method: 'GET',
      headers: { 'X-MBX-APIKEY': API_KEY }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const account = JSON.parse(data);
        const bnb = account.balances.find(b => b.asset === 'BNB');
        const usdt = account.balances.find(b => b.asset === 'USDT');
        resolve({
          bnb: parseFloat(bnb?.free || 0),
          usdt: parseFloat(usdt?.free || 0)
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function monitor() {
  console.log('🤖 TRADING BOT STARTED');
  console.log('========================');
  console.log(`Entry: $${ENTRY_USDT} USDT → BNB`);
  console.log(`Take Profit: +$${TAKE_PROFIT_USD}`);
  console.log(`Stop Loss: -$${STOP_LOSS_USD}`);
  console.log(`Checking every ${CHECK_INTERVAL_MS/1000}s`);
  console.log('========================\n');
  
  // Get initial BNB amount from the swap (approximately)
  const initialBnbValue = ENTRY_USDT;
  
  while (running) {
    try {
      const bnbPrice = await getBnbPrice();
      const balance = await getBalance();
      
      const currentBnbValue = balance.bnb * bnbPrice;
      const totalValue = balance.usdt + currentBnbValue;
      const pnl = totalValue - 10.93; // Starting total
      
      const time = new Date().toLocaleTimeString();
      
      console.log(`[${time}] BNB: $${bnbPrice.toFixed(2)} | BNB: ${balance.bnb.toFixed(6)} ($${currentBnbValue.toFixed(2)}) | USDT: $${balance.usdt.toFixed(2)} | Total: $${totalValue.toFixed(2)} | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
      
      // Check take profit (total value >= $11.43 = $10.93 + $0.50)
      if (totalValue >= 10.93 + TAKE_PROFIT_USD) {
        console.log('\n🎉 TAKE PROFIT HIT! Total value: $' + totalValue.toFixed(2));
        console.log('Selling BNB for USDT...');
        // We'll signal this to the user
        running = false;
        break;
      }
      
      // Check stop loss (total value <= $9.93 = $10.93 - $1.00)
      if (totalValue <= 10.93 - STOP_LOSS_USD) {
        console.log('\n🛑 STOP LOSS HIT! Total value: $' + totalValue.toFixed(2));
        console.log('Selling BNB for USDT...');
        running = false;
        break;
      }
      
    } catch (err) {
      console.error('Error:', err.message);
    }
    
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

monitor();
