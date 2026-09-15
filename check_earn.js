const crypto = require('crypto');
const https = require('https');

const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';

const timestamp = Date.now();
const queryString = 'timestamp=' + timestamp;
const signature = crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');

const options = {
  hostname: 'api.binance.com',
  path: '/sapi/v1/simple-earn/flexible/position?' + queryString + '&signature=' + signature,
  method: 'GET',
  headers: { 'X-MBX-APIKEY': API_KEY }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.rows && parsed.rows.length > 0) {
        console.log('=== Flexible Earn Products ===');
        parsed.rows.forEach(r => {
          console.log('Asset:', r.asset, '| Amount:', r.totalAmount, '| Value:', r.totalAmount);
        });
      } else {
        console.log('Flexible Earn: Empty');
      }
    } catch(e) {
      console.log('Response:', data.substring(0, 2000));
    }
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
