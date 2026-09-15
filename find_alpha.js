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

function checkBawSupport(address) {
  return new Promise((resolve) => {
    const { execSync } = require('child_process');
    try {
      const result = execSync(`baw market-order quote --fromTokenQty 1 --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken ${address} --binanceChainId 56 --json`, { encoding: 'utf8', timeout: 10000 });
      const parsed = JSON.parse(result);
      resolve(parsed.success === true);
    } catch(e) {
      resolve(false);
    }
  });
}

async function main() {
  // Known Binance Alpha BSC tokens (recently listed)
  const alphaTokens = [
    { name: 'PARTI', address: '0x5D5A0B5F7bA808f0B4ADe298D8c2d21E79A67C2E' },
    { name: 'B2', address: '0x26A8e3E5a0a378C40b41B4b85c90cC49c85E0A86' },
    { name: 'NIL', address: '0x43E18864Ba59d4AB4C90bB5D30e7fC9f980f9e41' },
    { name: 'SHELL', address: '0xf9F83b1A806Be81e4C3B4F6C0B11b0E0F4B5b3E3' },
    { name: 'MYX', address: '0xd8218f0BE855e289E38b1ca5a2B52Bc1219519AF' },
    { name: 'SKYAI', address: '0x35E59238f0A55A9C3E8d661B8b580A0d836e13eB' },
    { name: 'AINTI', address: '0xAf78805367E03bE329d7d9c0C8b268023C999552' },
    { name: 'BANK', address: '0x61B172d1642b24B3aE1A8680e8886A04dBC08f86' },
    { name: 'BIDIZA', address: '0x3c116A81E70a8107C31F34b4e8A87A0d98A5bC83' },
    { name: 'XTER', address: '0x3AeAa3F704850Bc1A6c58fD24c4bDc88c2eC5616' },
    { name: 'SOON', address: '0xaCabAaB0F8a0a20b7248B4194b42f3Aa0A84b1d6' },
    { name: 'FORM', address: '0x2A8C6B4F53C725c1d82B80D22E3C712C5D3A2f60' },
    { name: 'BOOM', address: '0x7E9B24d1A6E8a5c21E3c89C68f1F4E0c93e85D5D' },
    { name: 'GPS', address: '0x新人玩家' },
    { name: 'DLC', address: '0xf460433E6F56B80b3c30a24A1e93D2c5C6B5e4F0' },
    { name: 'NIL', address: '0x769331B3C2F5b53C4c7e547C30C0b0b15C34D3C5' },
    { name: 'ALPACA', address: '0x8F55E2b3c9a55E08a81C49c0C3242D06C7e4f2A1' },
    { name: 'MANTA', address: '0xAa8b37D5A5d20B1b13C71906c4C1E8C97C55D6a2' },
    { name: 'MELANIA', address: '0x710B3b638a1Aa80c8d0E6e45C4E6E1F1B2e3f4A5' },
    { name: 'TST', address: '0x2136118A0F88c5cD0696B4f1A8A7E6C82D3e5F4b' },
  ];

  console.log('=== Checking Binance Alpha Tokens ===\n');
  
  const results = [];
  
  for (const t of alphaTokens) {
    // Check DexScreener for price data
    try {
      const info = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${t.address}`);
      if (info && info.pairs && info.pairs.length > 0) {
        const p = info.pairs[0];
        const h1 = p.priceChange?.h1;
        const h6 = p.priceChange?.h6;
        const h24 = p.priceChange?.h24;
        results.push({
          name: p.baseToken.symbol || t.name,
          address: t.address,
          price: p.priceUsd,
          h1, h6, h24,
          vol: p.volume?.h24 || 0,
          liq: p.liquidity?.usd || 0,
          fdv: p.fdv || 0
        });
      }
    } catch(e) {}
  }
  
  // Sort by 1h change (best performers first)
  results.sort((a, b) => (b.h1 || -999) - (a.h1 || -999));
  
  console.log('Alpha Tokens by 1h Performance:');
  results.forEach((t, i) => {
    const emoji = (t.h1 || 0) > 0 ? 'GREEN' : 'RED';
    console.log(`${i+1}. [${emoji}] ${t.name} | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1 || 'N/A'}% | 6h: ${t.h6 > 0 ? '+' : ''}${t.h6 || 'N/A'}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24 || 'N/A'}%`);
    console.log(`   Vol: $${(t.vol/1000).toFixed(1)}k | Liq: $${(t.liq/1000).toFixed(1)}k | FDV: $${(t.fdv/1000).toFixed(1)}k`);
    console.log(`   Price: $${t.price} | Address: ${t.address}`);
  });

  // Now check which ones the wallet actually supports
  console.log('\n=== Checking wallet support for top tokens ===');
  const supported = [];
  for (const t of results.slice(0, 8)) {
    const ok = await checkBawSupport(t.address);
    console.log(`${t.name}: ${ok ? 'SUPPORTED' : 'NOT supported'}`);
    if (ok) supported.push(t);
  }
  
  if (supported.length > 0) {
    console.log('\n=== SUPPORTED Alpha tokens ready to trade ===');
    supported.forEach((t, i) => {
      console.log(`${i+1}. ${t.name} | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1 || 'N/A'}% | Price: $${t.price}`);
    });
  }
}

main();
