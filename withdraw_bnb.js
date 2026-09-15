const crypto = require('crypto');
const https = require('https');

const API_KEY = 'Zzw4ERaOHtB8eIf9CHylcMkprWvJgT3yWkDJRnaJBAde3FYOeRHcQQeYJRE5glwm';
const API_SECRET = '7wKTFvYQ8h2FIEG0f7tADzY1gtUDCEmTqRN5nKMkN1pGxw2WMaxCbiMhx79ThJhE';

const timestamp = Date.now();
const walletAddress = '0x024f1F37Bd7f1b7f921aC4aC927548D3B9bfd96e';
const network = 'BSC'; // BNB Smart Chain (BEP20)

const body = `coin=BNB&network=${network}&address=${walletAddress}&amount=0.00344&timestamp=${timestamp}`;
const signature = crypto.createHmac('sha256', API_SECRET).update(body).digest('hex');

const options = {
  hostname: 'api.binance.com',
  path: '/sapi/v1/capital/withdraw/apply?' + body + '&signature=' + signature,
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
    console.log('Withdraw BNB to Web3 wallet:', data);
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
