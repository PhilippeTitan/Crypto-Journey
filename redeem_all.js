const crypto = require('crypto');
const https = require('https');

const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';

function redeem(productId, asset, amount) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const body = `asset=${asset}&productId=${productId}&amount=${amount}&redeemAll=false&timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', API_SECRET).update(body).digest('hex');
    
    const options = {
      hostname: 'api.binance.com',
      path: '/sapi/v1/simple-earn/flexible/redeem?' + body + '&signature=' + signature,
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
        console.log(`Redeem ${asset} (${productId}):`, data);
        resolve(data);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Redeem USDT first (most important)
  await redeem('USDT001', 'USDT', '2.01914681');
  // Redeem BTC
  await redeem('BTC001', 'BTC', '0.00001257');
  // Redeem OPN
  await redeem('OPN001', 'OPN', '0.03586725');
}

main().catch(console.error);
