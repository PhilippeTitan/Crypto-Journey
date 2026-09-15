const crypto = require('crypto');
const https = require('https');

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
    const all = account.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
    console.log('=== Updated Spot Balances ===');
    all.forEach(b => console.log(b.asset + ': free=' + b.free + ' locked=' + b.locked));
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
