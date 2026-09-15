# 🚀 MaurEdge 2.0

> Aggressive BSC crypto trading system — automated scanning, sniping, and profit-taking on Binance Alpha tokens.

![Dashboard](https://img.shields.io/badge/Dashboard-Live-00d4ff?style=for-the-badge)
![Profit](https://img.shields.io/badge/Today-+145.6%25-00ff88?style=for-the-badge)
![Chain](https://img.shields.io/badge/Chain-BSC-F3BA2F?style=for-the-badge)

## 📊 Performance

| Metric | Value |
|--------|-------|
| Starting Capital | $5.03 |
| Current Portfolio | **$12.35** |
| Total Return | **+145.6%** |
| Win Rate | 67% (2W / 1L) |
| Best Trade | +13.6% (AFOB) |
| Trades Today | 3 |

## 🏗️ Architecture

```
MaurEdge 2.0/
├── 🔭 Scanners
│   ├── rising_star.js        — Rising Star Sniper v2 (continuous mode)
│   ├── binance_alpha_live.js — Binance API + DexScreener scanner
│   ├── scan_alpha.js         — Alpha token momentum scanner
│   ├── scan_market.js        — Market scanner v1
│   ├── scan_market_v2.js     — Market scanner v2
│   ├── hot_scan.js           — Quick token health check
│   ├── deep_scan.js          — Deep DexScreener scan
│   └── monster_hunt.js       — Broad token discovery
│
├── 🤖 Monitors (Auto-Sell Bots)
│   ├── afob_monitor_v2.js    — AFOB TP/SL monitor (ACTIVE)
│   ├── doge_monitor.js       — DOGE TP/SL monitor
│   ├── afob_monitor.js       — AFOB monitor v1
│   ├── trade_monitor.js      — Generic trade monitor v1
│   └── trade_monitor_v2.js   — Generic trade monitor v2
│
├── 📊 Dashboard
│   ├── dashboard.js          — Node.js server (port 3456)
│   └── dashboard.html        — Live trading terminal UI
│
├── 🔧 Tools
│   ├── convert_btc_now.js    — BTC conversion
│   ├── convert_usdt_to_bnb.js — USDT → BNB swap
│   ├── sell_btc.js           — BTC sell
│   ├── withdraw_bnb.js       — BNB withdrawal
│   ├── check_earn.js         — Earn products check
│   ├── redeem_earn.js        — Earn redemption
│   └── redeem_all.js         — Redeem all earnings
│
├── 📋 Context
│   ├── agent.md              — Session recovery & full context
│   ├── trade_log.json        — Trade history
│   └── .env                  — API credentials (gitignored)
│
└── 📦 Config
    ├── package.json
    └── .gitignore
```

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/MaurEdge-2.0.git
cd MaurEdge-2.0

# Install
npm install

# Setup credentials
cp .env.example .env
# Edit .env with your Binance API keys

# Start Dashboard
node dashboard.js
# Open http://localhost:3456

# Start Scanner (continuous)
node rising_star.js continuous
```

## 🔑 Environment Variables

```env
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
WALLET_ADDRESS=0xYourBSCWalletAddress
```

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Blockchain**: BSC (Binance Smart Chain)
- **Trading**: Binance Agentic Wallet CLI (`baw`)
- **Data**: DexScreener API (free, real-time on-chain data)
- **Charts**: Chart.js
- **Auth**: HMAC-SHA256 (Binance REST API)

## 📈 Strategy

1. **Scan** — Rising Star Sniper finds new/active BSC tokens every 30s
2. **Score** — Multi-factor scoring: buy pressure, volume, momentum, FDV, insider patterns
3. **Snipe** — All-in on the best rising star via `baw market-order swap`
4. **Monitor** — Auto-sell bot watches TP/SL/trailing stop every 8s
5. **Rotate** — Cut losers fast, rotate into winners

## ⚠️ Disclaimer

This is for educational purposes. Crypto trading is extremely risky. Never trade more than you can afford to lose. The authors are not responsible for any financial losses.

## 📄 License

MIT
