const crypto = require('crypto');
const https = require('https');

const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';

function sign(body) {
  return crypto.createHmac('sha256', API_SECRET).update(body).digest('hex');
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const fullBody = body + '&timestamp=' + timestamp;
    const signature = sign(fullBody);
    const options = {
      hostname: 'api.binance.com',
      path: path + '?' + fullBody + '&signature=' + signature,
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
    req.end();
  });
}

async function main() {
  // Convert 2.5 USDT to BNB (keep some USDT for later)
  console.log('Getting USDT → BNB quote (2.5 USDT)...');
  const quote = await apiPost('/sapi/v1/convert/getQuote', 'fromAsset=USDT&toAsset=BNB&fromAmount=2.5&walletType=SPOT');
  console.log('Quote:', JSON.stringify(quote));
  
  if (quote.quoteId) {
    console.log('Accepting quote immediately...');
    const accept = await apiPost('/sapi/v1/convert/acceptQuote', 'quoteId=' + quote.quoteId);
    console.log('Result:', JSON.stringify(accept));
  }
}

main().catch(console.error);
