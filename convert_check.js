const crypto = require('crypto');
const https = require('https');

const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';

function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const sep = path.includes('?') ? '&' : '?';
    const fullUrl = path + sep + 'timestamp=' + timestamp;
    
    let signStr = fullUrl.split('?')[1];
    if (body) signStr = body + '&' + signStr;
    const signature = crypto.createHmac('sha256', API_SECRET).update(signStr).digest('hex');
    
    const options = {
      hostname: 'api.binance.com',
      path: fullUrl + '&signature=' + signature,
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
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Check BTCUSDT convert quote
  console.log('=== Checking BTC → USDT Convert ===');
  const quote1 = await apiRequest(
    '/sapi/v1/convert/getQuote?fromAsset=BTC&toAsset=USDT&fromAmount=0.00001257&walletType=SPOT'
  );
  console.log(JSON.stringify(quote1, null, 2));
  
  // Check if we can convert OPN → USDT
  console.log('\n=== Checking OPN → USDT Convert ===');
  const quote2 = await apiRequest(
    '/sapi/v1/convert/getQuote?fromAsset=OPN&toAsset=USDT&fromAmount=0.03586725&walletType=SPOT'
  );
  console.log(JSON.stringify(quote2, null, 2));
}

main().catch(console.error);
