const https = require('https');

const options = {
  hostname: 'api.binance.com',
  path: '/api/v3/exchangeInfo?symbol=BTCUSDT',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const info = JSON.parse(data);
    const btc = info.symbols[0];
    console.log('BTCUSDT filters:');
    btc.filters.forEach(f => console.log(JSON.stringify(f)));
  });
});
req.end();
