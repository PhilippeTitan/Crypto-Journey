# 🤖 AGENT.md — MaurEdge 2.0 Project Context

> **READ THIS FIRST** when starting a new session. This file contains all critical context.

## Project Overview
- **Name**: MaurEdge 2.0
- **Goal**: Grow USDT via crypto trading on BSC using Binance Agentic Wallet + Binance API
- **Strategy**: Find high-momentum Binance Alpha tokens, go ALL IN, auto-sell on TP/SL
- **Started**: ~$5 USDT → Current: **$12.35** (+145.6%)
- **Git**: `MaurEdge 2.0` repo at `C:\MAURINEX\Crypto Journey`

## 🔑 Credentials (in `.env`)
- `BINANCE_API_KEY` / `BINANCE_API_SECRET` — Binance REST API
- `WALLET_ADDRESS` — BSC Web3 wallet
- CLI: `baw` (Binance Agentic Wallet, npm `@binance/agentic-wallet`)

## 💰 Current Wallet (as of 4:44 PM ET, Sep 15 2026)
- **USDT**: $11.80
- **BNB**: $0.56 — gas money
- **Total**: ~$12.36
- **No active position** — waiting for next signal

## 📊 Today's Trade History
- **AFOB #1**: Bought $5.03 → Sold $5.54 (+10.1%) ✅
- **DOGE**: Bought $10.54 → Sold $10.48 (-0.6%) 🔴
- **AFOB #2**: Bought $10.58 → Sold $12.02 (+13.6%) ✅
- **Total PnL**: +$1.89 from $5.03 start (+145.7% total growth)

## 🏗️ Key Technical Details

### BSC Chain
- Chain ID: `56`
- Gas: ~$0.05-0.19/tx, requires BNB
- USDT (BSC): `0x55d398326f99059fF775485246999027B3197955`
- Web3 Wallet: `0x024f1F37Bd7f1b7f921aC4aC927548D3B9bfd96e`

### DexScreener API (free, no auth)
- Token data: `https://api.dexscreener.com/latest/dex/tokens/{address}`
- Token boosts: `https://api.dexscreener.com/token-boosts/top/v1`
- Search: `https://api.dexscreener.com/latest/dex/search?q={query}`

### Binance REST API (HMAC-SHA256 signed)
- Base: `https://api.binance.com`
- Headers: `X-MBX-APIKEY: {key}`, `Signature: sha256_hmac(secret, queryString)`
- Query string MUST be sorted alphabetically for signature
- Alpha tokens: Check `/sapi/v1/alpha/...` endpoints or spot pairs ending in `ALPHAUSDT`

### Baw CLI Commands
- Swap: `baw market-order swap --fromTokenQty QTY --fromToken ADDR --toToken ADDR --binanceChainId 56 --slippage 3 --mev true --gasLevel LOW --json`
- Quote: `baw market-order quote --fromTokenQty QTY --fromToken ADDR --toToken ADDR --binanceChainId 56 --json`
- Balance: `baw wallet balance --json`

## ✅ Known Tradeable Binance Alpha Tokens (BSC)
| Symbol | Address |
|--------|---------|
| AFOB | `0x5EB323BD76D309c9916C942cfe8c813626467777` |
| CAKE | `0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82` |
| ETH | `0x2170Ed0880ac9A755fd29B2688956BD959F933F8` |
| BNB (sentinel) | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` |
| FF | `0x22fF10E0e88d582e8e50059cBeE5BAb36e703760` |
| TUT | `0xA26d1F29891253B78A64543A4a5B484E79921245` |
| CREAM | `0xD5664B890035B3c3187B97E982180786F7f398F5` |
| GICAT | `0x46E04CaE45b62bF8B97986cEBE2f4B0b1d7a9436` |
| NECTAR | `0x4235ad74177C5e47c5e2DF62ab4b104e1e710845` |
| BNBCAT | `0x6Bd516637b9B8E1F4E2e6E0a8b981D4C5e39142D` |
| BinanceTown | `0x5DB83d4C4861d940141B82936aE5951e98876a33` |
| Fly | `0x1B27B90Db3A78c6D8b19b382BeDc80e6D1a77e8e` |
| 果蝇 | `0x73Ea708d048A55DBcF07E064885A30C3A61429db` |
| SAGA | `0x1466f357F40b2C4e6b8D3C3A28C01e5e8B7b1289` |
| PNT | `0x673eAf2F1b20c2fC9F0957E8e4C431B209e0Ac59` |
| DOGE | `0xbA2aE424d960c26247Dd6c32edC70B295c744C43` |
| CAT | `0x6894CDe390a3f51155ea41Ed24a33A4827d3063D` |

> ⚠️ Many BSC tokens (SHIB, BabyDoge, etc.) are NOT tradeable via baw — they get rejected.

## 📊 Scripts Overview

| Script | Purpose | Status |
|--------|---------|--------|
| `rising_star.js` | **MAIN TOOL** — Rising Star Sniper v2. Detects new BSC launches, scores explosion potential, finds insider patterns. Run with `node rising_star.js` (once) or `node rising_star.js continuous` (auto-scan every 30s) | ✅ ACTIVE |
| `afob_monitor.js` | TP/SL auto-sell bot. Edit TP/SL/token amounts to reuse for any token | ✅ REUSABLE |
| `binance_alpha_live.js` | Full Alpha scanner using Binance API key (klines) + DexScreener (on-chain data) | ✅ READY |
| `hot_scan.js` | Quick scan of known BSC tokens for momentum | ✅ READY |
| `deep_scan.js` | Deep DexScreener scan for trending tokens | ✅ READY |
| `alpha_warrior.js` | Scans Alpha tokens via DexScreener for momentum + buy pressure | ✅ READY |
| `monster_hunt.js` | Broader DexScreener search for hot BSC tokens | ✅ READY |
| `binance_alpha_scan.js` | Uses Binance REST API to scan all USDT pairs | ✅ READY |
| `trade_monitor.js` | Earlier version of trade monitor | ⚠️ LEGACY |

## 🎯 Trading Strategy

### Primary: Rising Star Hunting
1. **Scan for NEW tokens** — focus on tokens < 6h old on BSC
2. **Score by**: newness, buy pressure, volume explosion, insider patterns
3. **Sweet spot FDV**: $10k - $5M (room to grow, not a rug)
4. **Look for**: 3x+ buy pressure, volume spikes, low sells despite rising price
5. **ALL IN** with full USDT balance on highest-scoring tradeable token
6. **Auto-sell**: Edit `afob_monitor.js` with new token address, set TP/SL
7. **Monitor**: Use `rising_star.js continuous` for ongoing detection

### Position Sizing
- **ALL IN** — user prefers aggressive bets (>$5 per trade)
- **TP**: +10-15% ($1-1.50) | **SL**: -15-20% ($1.50-2.00)
- **Ride winners** — if up 5%+ with strong buy pressure, consider holding for bigger move

## ⚠️ Lessons Learned
- **BNB gas is mandatory** for ALL BSC transactions — always keep some BNB
- **Binance Convert** is better than spot for small amounts (no minimum order)
- **Baw wallet** rejects many tokens — always test with a $1 quote first
- **Quote expiration** — get quote and accept quickly
- **DexScreener 5m data** is best for short-term momentum trading
- **Buy/sell ratio** from DexScreener shows real-time pressure (e.g., 5B/1S = strong buying)
- **AFOB trade**: Bought $5.03 → Sold $5.54 (+10.09%) in ~5 minutes. TP hit $0.0003212
- **The real money is in NEW launches** — user wants to catch "just came out" tokens (like IPOs/market listings)
- **Sunday afternoon = quiet market** — better plays happen Mon-Fri during active hours
- **Insider pattern**: Many buys + few sells + volume up + price still low = someone accumulating

## 📈 Rising Star Detection Signals
The `rising_star.js` scores tokens on these factors:
1. **Newness** (50 pts): <1h = 50pts, <3h = 40pts, <6h = 30pts
2. **Buy Pressure** (40 pts): 5x+ = 40pts, 3x = 30pts, 2x = 20pts
3. **Volume Explosion** (30 pts): 3x spike = 30pts, 2x = 20pts
4. **Price Momentum** (35 pts): >10% 5m = 35pts, >5% = 25pts, >2% = 15pts
5. **Sweet FDV** (15 pts): $10k-$500k = 15pts (room to grow)
6. **Insider Detection**: Buy walls forming, stealth rises, pre-pump volume

## 📝 User Preferences
- **Risk tolerance**: HIGH — "go big or go home"
- **Timezone**: Haiti Standard Time (UTC-5)
- **Style**: Aggressive meme/Alpha coin trading, all-in bets
- **Goal**: Keep growing past $8, currently at $11.30
