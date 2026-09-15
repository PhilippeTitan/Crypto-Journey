const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
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
  console.log('=== Scanning for BSC tokens with ACTIVE momentum ===\n');
  
  // DexScreener trending BSC pairs sorted by volume
  try {
    const pairs = await fetchJSON('https://api.dexscreener.com/latest/dex/search?q=trending%20bsc');
    if (pairs && pairs.pairs) {
      const bscPairs = pairs.pairs
        .filter(p => p.chainId === 'bsc')
        .filter(p => p.baseToken.address !== '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c')
        .filter(p => p.baseToken.address !== '0x55d398326f99059fF775485246999027B3197955')
        .filter(p => p.liquidity?.usd > 5000)
        .filter(p => p.volume?.h24 > 10000)
        .sort((a, b) => (b.priceChange?.h1 || 0) - (a.priceChange?.h1 || 0));
      
      console.log('Top trending BSC pairs by 1h momentum:');
      bscPairs.slice(0, 15).forEach((p, i) => {
        const h1 = p.priceChange?.h1;
        const h6 = p.priceChange?.h6;
        const h24 = p.priceChange?.h24;
        const growing = h1 > 0 && h6 > 0;
        const flag = growing ? '🟢 GROWING' : (h1 > 0 ? '🟡 1h green' : '🔴 red');
        console.log(`${i+1}. ${p.baseToken.symbol} | 1h: ${h1 > 0 ? '+' : ''}${h1}% | 6h: ${h6 > 0 ? '+' : ''}${h6}% | 24h: ${h24 > 0 ? '+' : ''}${h24}% | Vol: $${(p.volume?.h24/1000).toFixed(1)}k | Liq: $${(p.liquidity?.usd/1000).toFixed(1)}k | ${flag}`);
        console.log(`   Address: ${p.baseToken.address}`);
      });
    }
  } catch(e) { console.log('Error:', e.message); }
}

main();
