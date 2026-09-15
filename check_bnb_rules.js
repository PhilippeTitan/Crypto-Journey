const https = require('https');

// Check BNBUSDT trading rules
const options = {
  hostname: 'api.binance.com',
  path: '/api/v3/exchangeInfo?symbol=BNBUSDT',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const info = JSON.parse(data);
    const bnb = info.symbols[0];
    console.log('BNBUSDT filters:');
    bnb.filters.forEach(f => console.log(JSON.stringify(f)));
  });
});
req.end();
