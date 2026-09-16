-- ============================================
-- MaurEdge 2.0 — Supabase Schema
-- Run this in Supabase SQL Editor after creating project
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: trades
-- Every buy/sell trade executed by the system
-- ============================================
CREATE TABLE trades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT NOT NULL,                    -- AFOB, DOGE, ETH, etc.
  token_address TEXT,                     -- BSC contract address
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  price NUMERIC(20, 10) NOT NULL,        -- entry/exit price
  quantity NUMERIC(20, 10) NOT NULL,      -- tokens bought/sold
  value NUMERIC(10, 2) NOT NULL,          -- USD value
  pnl NUMERIC(10, 2),                     -- profit/loss (null for buys)
  pnl_pct NUMERIC(8, 4),                  -- percentage P&L
  order_id TEXT,                          -- baw order ID
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: portfolio_snapshots
-- Periodic portfolio value snapshots for charts
-- ============================================
CREATE TABLE portfolio_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  total_value NUMERIC(10, 2) NOT NULL,
  usdt_balance NUMERIC(10, 2),
  bnb_balance NUMERIC(10, 4),
  active_token TEXT,                      -- currently held token (null if cash)
  active_token_qty NUMERIC(20, 10),
  active_token_value NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: price_history
-- Token price snapshots from DexScreener
-- ============================================
CREATE TABLE price_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT NOT NULL,
  token_address TEXT,
  price NUMERIC(20, 10) NOT NULL,
  m5_change NUMERIC(8, 4),
  h1_change NUMERIC(8, 4),
  buys_5m INTEGER,
  sells_5m INTEGER,
  volume_5m NUMERIC(10, 2),
  liquidity NUMERIC(12, 2),
  fdv NUMERIC(15, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: scanner_alerts
-- Rising star scanner findings
-- ============================================
CREATE TABLE scanner_alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT NOT NULL,
  token_address TEXT,
  score INTEGER NOT NULL,
  signals TEXT[],                         -- array of signal strings
  price NUMERIC(20, 10),
  buy_pressure NUMERIC(8, 4),
  volume_5m NUMERIC(10, 2),
  liquidity NUMERIC(12, 2),
  fdv NUMERIC(15, 2),
  tradeable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: settings
-- Key-value store for system settings
-- ============================================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_trades_token ON trades(token);
CREATE INDEX idx_trades_created ON trades(created_at DESC);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_snapshots_created ON portfolio_snapshots(created_at DESC);
CREATE INDEX idx_price_history_token ON price_history(token);
CREATE INDEX idx_price_history_created ON price_history(created_at DESC);
CREATE INDEX idx_scanner_alerts_token ON scanner_alerts(token);
CREATE INDEX idx_scanner_alerts_score ON scanner_alerts(score DESC);

-- ============================================
-- SEED: Today's existing trades
-- ============================================
INSERT INTO trades (token, action, price, quantity, value, pnl, pnl_pct, order_id, created_at) VALUES
  ('AFOB', 'BUY',  0.0002770, 17240.57, 5.03, NULL, NULL, NULL, '2025-09-15 18:53:00+00'),
  ('AFOB', 'SELL', 0.0003223, 17240.57, 5.54, 0.51, 10.09, NULL, '2025-09-15 19:27:00+00'),
  ('DOGE', 'BUY',  0.08077,   130.505,  10.54, NULL, NULL, '26091500001889448592', '2025-09-15 19:55:00+00'),
  ('DOGE', 'SELL', 0.08033,   130.505,  10.48, -0.06, -0.57, '26091500001889485553', '2025-09-15 20:22:00+00'),
  ('AFOB', 'BUY',  0.0003186, 33205.14, 10.58, NULL, NULL, '26091500001889486332', '2025-09-15 20:22:00+00'),
  ('AFOB', 'SELL', 0.0003620, 33205.14, 12.02, 1.44, 13.61, '26091500001889513657', '2025-09-15 20:44:00+00');

-- Seed settings
INSERT INTO settings (key, value) VALUES
  ('start_value', '5.03'),
  ('starting_date', '2025-09-15'),
  ('project_name', 'MaurEdge 2.0');

-- ============================================
-- VIEWS
-- ============================================

-- Active trades summary
CREATE VIEW trade_summary AS
SELECT
  token,
  COUNT(*) FILTER (WHERE action = 'BUY') as buys,
  COUNT(*) FILTER (WHERE action = 'SELL') as sells,
  SUM(CASE WHEN action = 'SELL' THEN pnl ELSE 0 END) as total_pnl,
  AVG(CASE WHEN action = 'SELL' THEN pnl_pct ELSE NULL END) as avg_pnl_pct,
  MAX(CASE WHEN action = 'SELL' THEN pnl_pct ELSE NULL END) as best_trade,
  MIN(CASE WHEN action = 'SELL' THEN pnl_pct ELSE NULL END) as worst_trade,
  MAX(created_at) as last_trade
FROM trades
WHERE status = 'completed'
GROUP BY token;

-- Today's performance
CREATE VIEW today_performance AS
SELECT
  COUNT(*) FILTER (WHERE action = 'SELL') as trades_closed,
  SUM(CASE WHEN action = 'SELL' THEN pnl ELSE 0 END) as total_pnl,
  COUNT(*) FILTER (WHERE action = 'SELL' AND pnl > 0) as wins,
  COUNT(*) FILTER (WHERE action = 'SELL' AND pnl <= 0) as losses,
  ROUND(COUNT(*) FILTER (WHERE action = 'SELL' AND pnl > 0)::NUMERIC / 
    NULLIF(COUNT(*) FILTER (WHERE action = 'SELL'), 0) * 100, 0) as win_rate
FROM trades
WHERE created_at >= CURRENT_DATE
  AND status = 'completed';

-- ============================================
-- RLS Policies (Row Level Security)
-- Enable RLS but allow all for now (can restrict later)
-- ============================================
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anon (update with auth later)
CREATE POLICY "Allow all for anon" ON trades FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON portfolio_snapshots FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON price_history FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON scanner_alerts FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON settings FOR ALL USING (true);
