const https = require('https');

const options = {
  hostname: 'api.binance.com',
  path: '/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=30',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const klines = JSON.parse(data);
    console.log('ETH Daily Prices (Last 30 Days):');
    console.log('Date       | Open     | Close    | Change');
    console.log('-----------|----------|----------|--------');
    
    let prevClose = null;
    for (const k of klines) {
      const date = new Date(k[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const open = parseFloat(k[1]);
      const close = parseFloat(k[4]);
      const change = prevClose ? ((close - prevClose) / prevClose * 100).toFixed(1) : 'N/A';
      console.log(`${date.padEnd(10)} | $${open.toFixed(0).padStart(6)} | $${close.toFixed(0).padStart(6)} | ${change === 'N/A' ? 'N/A' : (parseFloat(change) >= 0 ? '+' : '') + change + '%'}`);
      prevClose = close;
    }
    
    const firstOpen = parseFloat(klines[0][1]);
    const lastClose = parseFloat(klines[klines.length - 1][4]);
    const totalChange = ((lastClose - firstOpen) / firstOpen * 100).toFixed(1);
    console.log(`\n30-day change: $${firstOpen.toFixed(0)} → $${lastClose.toFixed(0)} = +${totalChange}%`);
    console.log(`Avg daily change: ~${(parseFloat(totalChange) / 30).toFixed(2)}%/day`);
    
    const targetPrice = 3037;
    const currentPrice = lastClose;
    const neededChange = ((targetPrice - currentPrice) / currentPrice * 100).toFixed(1);
    const daysNeeded = Math.ceil(parseFloat(neededChange) / (parseFloat(totalChange) / 30));
    console.log(`\nTarget: $${targetPrice} (+${neededChange}% needed)`);
    console.log(`At current pace: ~${daysNeeded} days`);
  });
});
req.end();
