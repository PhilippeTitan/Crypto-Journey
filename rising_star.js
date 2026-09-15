/**
 * 🔭 RISING STAR SNIPER v2.0
 * 
 * Detects NEWLY CREATED BSC tokens, tracks their first moments of life,
 * and identifies which ones are about to explode.
 * 
 * Strategy: Catch tokens in their FIRST HOUR — the 3% → 30% plays.
 * Focus: New pairs, fresh launches, volume explosions, insider buying patterns.
 */

const https = require('https');
const { execSync } = require('child_process');
require('dotenv').config();

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const SCAN_INTERVAL = 30000; // 30 seconds between scans
const MAX_AGE_HOURS = 24;    // Only tokens created in last 24h
const MIN_LIQUIDITY = 5000;  // Min $5k liquidity to be real
const MIN_VOLUME_5M = 500;   // Min $500 5m volume

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function checkTradeability(address) {
  try {
    const result = execSync(
      `baw market-order quote --fromTokenQty 1 --fromToken ${USDT} --toToken ${address} --binanceChainId 56 --json`,
      { encoding: 'utf8', timeout: 15000 }
    );
    return JSON.parse(result).success === true;
  } catch(e) { return false; }
}

function ageString(pairCreatedAt) {
  if (!pairCreatedAt) return 'unknown';
  const mins = Math.floor((Date.now() - pairCreatedAt) / 60000);
  if (mins < 60) return `${mins}m old`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m old`;
}

// ═══════════════════════════════════════════════════════════
// RISING STAR DETECTION ENGINE
// ═══════════════════════════════════════════════════════════

/**
 * Score a token for "rising star" potential.
 * 
 * HIGH SCORE signals:
 * - Very new (created < 6h ago)
 * - High buy pressure (buyers >> sellers)
 * - Volume explosion (5m vol > 1h vol / 12)
 * - Growing liquidity (pool getting bigger)
 * - Sweet spot FDV ($10k - $5M = room to grow, not a rug)
 */
function scoreRisingStar(token) {
  let score = 0;
  let signals = [];
  
  // 1. NEWNESS — younger = higher score (exponential)
  if (token.ageMs) {
    const hoursOld = token.ageMs / 3600000;
    if (hoursOld < 1) { score += 50; signals.push('🔥 <1h OLD!'); }
    else if (hoursOld < 3) { score += 40; signals.push('⚡ <3h old'); }
    else if (hoursOld < 6) { score += 30; signals.push('🌟 <6h old'); }
    else if (hoursOld < 12) { score += 20; signals.push('📅 <12h old'); }
    else { score += 10; }
  }
  
  // 2. BUY PRESSURE — the #1 signal for "about to pump"
  const buyRatio = token.sells > 0 ? token.buys / token.sells : (token.buys > 0 ? 10 : 0);
  if (buyRatio >= 5) { score += 40; signals.push(`🔥🔥 ${buyRatio.toFixed(1)}x BUY PRESSURE`); }
  else if (buyRatio >= 3) { score += 30; signals.push(`🔥 ${buyRatio.toFixed(1)}x buy pressure`); }
  else if (buyRatio >= 2) { score += 20; signals.push(`📈 ${buyRatio.toFixed(1)}x buy pressure`); }
  else if (buyRatio >= 1.5) { score += 10; signals.push(`📊 ${buyRatio.toFixed(1)}x buy pressure`); }
  
  // 3. VOLUME EXPLOSION — 5m volume vs expected
  if (token.vol5m > 0 && token.volH1 > 0) {
    const expected5m = token.volH1 / 12;
    const volMultiple = expected5m > 0 ? token.vol5m / expected5m : 0;
    if (volMultiple > 3) { score += 30; signals.push(`🚀 ${(volMultiple).toFixed(1)}x volume spike!`); }
    else if (volMultiple > 2) { score += 20; signals.push(`📈 ${(volMultiple).toFixed(1)}x volume surge`); }
    else if (volMultiple > 1.5) { score += 10; signals.push(`📊 ${(volMultiple).toFixed(1)}x volume uptick`); }
  }
  
  // 4. PRICE MOMENTUM — 5m candle
  if (token.h5 > 10) { score += 35; signals.push(`🚀🚀 +${token.h5}% 5m!`); }
  else if (token.h5 > 5) { score += 25; signals.push(`🚀 +${token.h5}% 5m`); }
  else if (token.h5 > 2) { score += 15; signals.push(`📈 +${token.h5}% 5m`); }
  else if (token.h5 > 0.5) { score += 5; }
  
  // 5. SWEET SPOT FDV — not too small (rug), not too big (no upside)
  if (token.fdv > 0) {
    if (token.fdv > 10000 && token.fdv < 500000) { score += 15; signals.push(`💎 Sweet FDV: $${(token.fdv/1000).toFixed(0)}k`); }
    else if (token.fdv > 500000 && token.fdv < 5000000) { score += 10; signals.push(`💰 Good FDV: $${(token.fdv/1000).toFixed(0)}k`); }
    else if (token.fdv > 5000000) { score += 5; }
  }
  
  // 6. LIQUIDITY HEALTH — enough to trade in/out
  if (token.liq > 50000) { score += 5; } // Good liquidity
  if (token.liq > 10000 && token.liq < 100000) { score += 10; } // Sweet spot
  
  // 7. TRADE COUNT — active market
  if (token.buys + token.sells > 50) { score += 10; signals.push('🎯 Very active market'); }
  else if (token.buys + token.sells > 20) { score += 5; }
  
  return { score, signals };
}

/**
 * Detect "insider buying" pattern:
 * - Many small buys, few sells
 * - Volume increasing candle by candle
 * - Price slowly creeping up (not pumping yet)
 */
function detectInsiderPattern(token) {
  let insiderScore = 0;
  let patterns = [];
  
  // Pattern 1: Buy wall building — buys increasing each period
  if (token.buys > 10 && token.sells < token.buys * 0.3) {
    insiderScore += 20;
    patterns.push('BUILDING: Buy wall forming');
  }
  
  // Pattern 2: Low sells despite rising price
  if (token.h5 > 0.5 && token.sells < 3) {
    insiderScore += 15;
    patterns.push('STEALTH: Rising price, no sellers');
  }
  
  // Pattern 3: Volume increasing but price still low
  if (token.vol5m > token.volH1 / 8 && token.h5 < 2) {
    insiderScore += 15;
    patterns.push('PRE-PUMP: Volume up but price quiet');
  }
  
  return { insiderScore, patterns };
}

// ═══════════════════════════════════════════════════════════
// DATA COLLECTION
// ═══════════════════════════════════════════════════════════

async function getNewBSCPairs() {
  const pairs = [];
  
  // DexScreener new pairs endpoint
  try {
    const data = await fetchJSON('https://api.dexscreener.com/latest/dex/pairs/bsc?sort=pairCreatedAt&order=desc');
    if (Array.isArray(data)) {
      data.forEach(p => {
        const ageMs = p.pairCreatedAt ? Date.now() - p.pairCreatedAt : Infinity;
        if (ageMs < MAX_AGE_HOURS * 3600000) {
          pairs.push(p);
        }
      });
    }
  } catch(e) {}
  
  // Also try the search for "new" tokens
  const searches = ['new', 'launch', 'fair', 'stealth', 'presale'];
  for (const q of searches) {
    try {
      const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/search?q=${q}`);
      if (data?.pairs) {
        data.pairs.forEach(p => {
          if (p.chainId === 'bsc') {
            const ageMs = p.pairCreatedAt ? Date.now() - p.pairCreatedAt : Infinity;
            if (ageMs < MAX_AGE_HOURS * 3600000) {
              pairs.push(p);
            }
          }
        });
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  
  return pairs;
}

async function getTokenDetail(address) {
  try {
    const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (data?.pairs?.length > 0) {
      return (data.pairs.find(p => p.chainId === 'bsc') || data.pairs[0]);
    }
  } catch(e) {}
  return null;
}

// ═══════════════════════════════════════════════════════════
// KNOWN ALPHA TOKENS (always monitor these too)
// ═══════════════════════════════════════════════════════════

const KNOWN_ALPHA = [
  { symbol: 'AFOB', address: '0x5EB323BD76D309c9916C942cfe8c813626467777' },
  { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43' },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
  { symbol: 'BNX', address: '0x7F6f1E61c2281f4127394fE878b5E7e4c0F6376e' },
  { symbol: 'ALPINE', address: '0x2C7D8fC9d5795213089E8bf46a8a1AF43D9c3c45' },
  { symbol: 'LAZIO', address: '0x82632D6C46C5B462C9957Ab1b499320343c20D52' },
  { symbol: 'PORTO', address: '0x49f217555129171689C283b7b0E6650802292d42' },
  { symbol: 'SANTOS', address: '0xA64455a451c7424b9AD09Ed1D131586111387Ec7' },
  { symbol: 'JUV', address: '0xc62C7d12524B6C2a92075F9517F3B40Cbb49bf75' },
  { symbol: 'BAR', address: '0x408ED6354d4973f662A020984831991561B50865' },
  { symbol: '1INCH', address: '0x111111111117dC0aa78b770fA6A738034120C302' },
  { symbol: 'ARKM', address: '0x6C6ee5E31D828De241282B9606C8e98Ea48580e7' },
  { symbol: 'PNT', address: '0x673eAf2F1b20c2fC9F0957E8e4C431B209e0Ac59' },
  { symbol: 'CAT', address: '0x6894CDe390a3f51155ea41Ed24a33A4827d3063D' },
  { symbol: 'CREAM', address: '0xD5664B890035B3c3187B97E982180786F7f398F5' },
  { symbol: 'FF', address: '0x22fF10E0e88d582e8e50059cBeE5BAb36e703760' },
  { symbol: 'TUT', address: '0xA26d1F29891253B78A64543A4a5B484E79921245' },
];

// ═══════════════════════════════════════════════════════════
// MAIN SCAN
// ═══════════════════════════════════════════════════════════

async function runScan() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🔭 RISING STAR SCAN — ${timestamp}`);
  console.log(`${'═'.repeat(70)}\n`);
  
  // PHASE 1: Find NEWLY CREATED BSC pairs
  console.log('📡 Phase 1: Scanning for NEW BSC token launches...\n');
  const newPairs = await getNewBSCPairs();
  console.log(`Found ${newPairs.length} new pairs\n`);
  
  // Process new pairs
  const newTokens = [];
  for (const pair of newPairs.slice(0, 30)) {
    const addr = pair.baseToken?.address;
    if (!addr) continue;
    
    const buys = pair.txns?.m5?.buys || pair.txns?.h5?.buys || 0;
    const sells = pair.txns?.m5?.sells || pair.txns?.h5?.sells || 0;
    const vol5m = pair.volume?.m5 || 0;
    const liq = pair.liquidity?.usd || 0;
    const h5 = pair.priceChange?.m5 || pair.priceChange?.h5 || 0;
    const h1 = pair.priceChange?.h1 || 0;
    const fdv = pair.fdv || 0;
    const ageMs = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : Infinity;
    
    if (liq < MIN_LIQUIDITY) continue;
    if (vol5m < MIN_VOLUME_5M && buys + sells < 3) continue;
    
    const token = {
      symbol: pair.baseToken?.symbol || addr.slice(0, 8),
      address: addr,
      price: pair.priceUsd,
      h5, h1,
      h24: pair.priceChange?.h24 || 0,
      buys, sells,
      vol5m,
      vol24: pair.volume?.h24 || 0,
      liq, fdv,
      ageMs,
      ageStr: ageString(pair.pairCreatedAt),
      source: 'new_pair',
    };
    
    newTokens.push(token);
  }
  
  // PHASE 2: Monitor known Alpha tokens for surges
  console.log('📡 Phase 2: Monitoring known Alpha tokens...\n');
  const alphaTokens = [];
  
  for (const alpha of KNOWN_ALPHA) {
    const detail = await getTokenDetail(alpha.address);
    if (detail) {
      const buys = detail.txns?.m5?.buys || 0;
      const sells = detail.txns?.m5?.sells || 0;
      const vol5m = detail.volume?.m5 || 0;
      
      alphaTokens.push({
        symbol: alpha.symbol,
        address: alpha.address,
        price: detail.priceUsd,
        h5: detail.priceChange?.m5 || 0,
        h1: detail.priceChange?.h1 || 0,
        h24: detail.priceChange?.h24 || 0,
        buys, sells,
        vol5m,
        vol24: detail.volume?.h24 || 0,
        liq: detail.liquidity?.usd || 0,
        fdv: detail.fdv || 0,
        ageMs: null, // Known tokens aren't new
        source: 'known_alpha',
      });
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // PHASE 3: Score everything
  console.log('🧠 Phase 3: Scoring tokens...\n');
  
  const allTokens = [...newTokens, ...alphaTokens];
  const scored = allTokens.map(t => {
    const { score, signals } = scoreRisingStar(t);
    const { insiderScore, patterns } = detectInsiderPattern(t);
    return { ...t, score, signals, insiderScore, patterns, totalScore: score + insiderScore };
  }).sort((a, b) => b.totalScore - a.totalScore);
  
  // PHASE 4: Print results
  console.log(`${'🏆'.repeat(35)}`);
  console.log('RISING STARS — RANKED BY EXPLOSION POTENTIAL');
  console.log(`${'🏆'.repeat(35)}\n`);
  
  const topTokens = scored.filter(t => t.totalScore > 0).slice(0, 15);
  
  if (topTokens.length === 0) {
    console.log('😴 No rising stars detected right now. Market is quiet.\n');
  }
  
  topTokens.forEach((t, i) => {
    const rank = i + 1;
    const emoji = t.totalScore > 60 ? '🌟🌟🌟' : t.totalScore > 40 ? '🌟🌟' : t.totalScore > 20 ? '🌟' : '·';
    const sourceTag = t.source === 'new_pair' ? '🆕 NEW' : '📌 KNOWN';
    
    console.log(`${emoji} #${rank} ${t.symbol} [${sourceTag}] — Score: ${t.totalScore}`);
    console.log(`   Price: $${t.price} | Age: ${t.ageStr || 'N/A'}`);
    console.log(`   5m: ${t.h5 > 0 ? '+' : ''}${t.h5}% | 1h: ${t.h1 > 0 ? '+' : ''}${t.h1}% | 24h: ${t.h24 > 0 ? '+' : ''}${t.h24}%`);
    console.log(`   Trades: ${t.buys}B / ${t.sells}S | Vol5m: $${(t.vol5m/1000).toFixed(1)}k | Liq: $${(t.liq/1000).toFixed(1)}k | FDV: $${(t.fdv/1000).toFixed(1)}k`);
    console.log(`   Address: ${t.address}`);
    if (t.signals.length > 0) console.log(`   Signals: ${t.signals.join(' | ')}`);
    if (t.patterns.length > 0) console.log(`   Insider: ${t.patterns.join(' | ')}`);
    console.log('');
  });
  
  // PHASE 5: Check tradeability of top picks
  console.log('🔍 Phase 5: Checking baw tradeability...\n');
  const tradeable = [];
  
  for (const t of topTokens.slice(0, 8)) {
    process.stdout.write(`${t.symbol.padEnd(14)} `);
    if (checkTradeability(t.address)) {
      tradeable.push(t);
      console.log('✅ TRADEABLE');
    } else {
      console.log('❌ no');
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  if (tradeable.length > 0) {
    console.log('\n' + '🎯'.repeat(25));
    console.log('TOP TRADEABLE RISING STARS');
    console.log('🎯'.repeat(25) + '\n');
    
    tradeable.slice(0, 5).forEach((t, i) => {
      console.log(`#${i+1} ${t.symbol} — Score: ${t.totalScore}`);
      console.log(`   ${t.signals.join(' | ')}`);
      console.log(`   Price: $${t.price} | 5m: ${t.h5 > 0 ? '+' : ''}${t.h5}%`);
      console.log(`   ${t.buys}B/${t.sells}S | Vol5m: $${(t.vol5m/1000).toFixed(1)}k | Liq: $${(t.liq/1000).toFixed(1)}k`);
      console.log(`   Address: ${t.address}\n`);
    });
  }
  
  console.log(`💰 Wallet: ~$10.58 USDT + $0.72 BNB\n`);
  
  return { scored: topTokens, tradeable };
}

// ═══════════════════════════════════════════════════════════
// CONTINUOUS MODE
// ═══════════════════════════════════════════════════════════

async function continuousMode() {
  console.log('🔄 CONTINUOUS MODE — Scanning every 30s until we find a rising star!\n');
  
  let scanCount = 0;
  let bestCatch = null;
  
  while (true) {
    scanCount++;
    const result = await runScan();
    
    // Track the best opportunity
    if (result.tradeable.length > 0) {
      const top = result.tradeable[0];
      if (!bestCatch || top.totalScore > bestCatch.totalScore) {
        bestCatch = top;
        console.log(`\n🎯 NEW BEST CATCH: ${top.symbol} (Score: ${top.totalScore})`);
        console.log(`   ${top.signals.join(' | ')}\n`);
      }
    }
    
    // If we find something with score > 50, alert!
    const hot = result.tradeable.find(t => t.totalScore > 50);
    if (hot) {
      console.log('\n' + '🔥'.repeat(40));
      console.log(`🚨 ALERT: ${hot.symbol} is a RISING STAR! Score: ${hot.totalScore}`);
      console.log(`   Signals: ${hot.signals.join(' | ')}`);
      console.log(`   Address: ${hot.address}`);
      console.log('🔥'.repeat(40) + '\n');
    }
    
    if (scanCount < 20) {
      console.log(`⏳ Next scan in ${SCAN_INTERVAL/1000}s... (Scan #${scanCount})`);
      await new Promise(r => setTimeout(r, SCAN_INTERVAL));
    } else {
      console.log('\n📊 20 scans complete. Summary:');
      if (bestCatch) {
        console.log(`Best catch: ${bestCatch.symbol} (Score: ${bestCatch.totalScore})`);
      }
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════

const mode = process.argv[2] || 'once';
if (mode === 'continuous') {
  continuousMode();
} else {
  runScan();
}
