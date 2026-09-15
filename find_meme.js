const https = require('https');

// Try to find trending BSC tokens via public APIs
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
  // Try BSCScan trending tokens API
  console.log('=== Trying to find BSC tokens via DexScreener ===');
  try {
    const dex = await fetchJSON('https://api.dexscreener.com/token-boosts/top/v1');
    if (Array.isArray(dex)) {
      const bscTokens = dex.filter(t => t.chainId === 'bsc');
      console.log('Top BSC boosted tokens:');
      bscTokens.slice(0, 10).forEach(t => {
        console.log(`  ${t.tokenAddress} (boosted)`);
      });
    }
  } catch(e) { console.log('DexScreener error:', e.message); }

  // Also try to get hot pairs on BSC
  console.log('\n=== Hot BSC pairs on DexScreener ===');
  try {
    const pairs = await fetchJSON('https://api.dexscreener.com/latest/dex/search?q=trending%20bsc');
    if (pairs && pairs.pairs) {
      const bscPairs = pairs.pairs.filter(p => p.chainId === 'bsc');
      bscPairs.slice(0, 10).forEach(p => {
        console.log(`  ${p.baseToken.symbol}/${p.quoteToken.symbol} | Vol: $${(p.volume?.h24 || 0).toFixed(0)} | Price: $${p.priceUsd || 'N/A'} | Address: ${p.baseToken.address}`);
      });
    }
  } catch(e) { console.log('Pairs error:', e.message); }
}

main();
