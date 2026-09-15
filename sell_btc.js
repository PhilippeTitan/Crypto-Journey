const crypto = require('crypto');
const https = require('https');

const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';

// Step 1: Sell BTC for USDT (BTCUSDT)
function sellBTC() {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const body = `symbol=BTCUSDT&side=SELL&type=MARKET&quantity=0.00001257&timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', API_SECRET).update(body).digest('hex');
    
    const options = {
      hostname: 'api.binance.com',
      path: '/api/v3/order?' + body + '&signature=' + signature,
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Sell BTC:', data);
        resolve(data);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

sellBTC().catch(console.error);
