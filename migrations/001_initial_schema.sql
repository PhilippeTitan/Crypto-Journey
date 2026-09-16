-- ============================================
-- MaurEdge 3.0 — Neon/PostgreSQL Schema
-- Authoritative persistent state for autonomous trading
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MISSIONS
-- Trading mission definitions
-- ============================================
CREATE TABLE missions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  starting_capital NUMERIC(12,2) NOT NULL,
  target_capital NUMERIC(12,2) NOT NULL,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MARKET SNAPSHOTS
-- Raw market data collected each cycle
-- ============================================
CREATE TABLE market_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT NOT NULL,
  address TEXT NOT NULL,
  chain TEXT DEFAULT 'bsc',
  price NUMERIC(20,10),
  momentum_5m NUMERIC(8,4),
  momentum_1h NUMERIC(8,4),
  momentum_6h NUMERIC(8,4),
  momentum_24h NUMERIC(8,4),
  buys_5m INTEGER DEFAULT 0,
  sells_5m INTEGER DEFAULT 0,
  buy_pressure NUMERIC(8,4),
  volume_5m NUMERIC(12,2),
  volume_1h NUMERIC(12,2),
  volume_24h NUMERIC(14,2),
  liquidity_usd NUMERIC(12,2),
  fdv_usd NUMERIC(14,2),
  pair_address TEXT,
  age_minutes INTEGER,
  raw_json JSONB,
  cycle_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MARKET REGIMES
-- Detected market conditions per cycle
-- ============================================
CREATE TABLE market_regimes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  heat_score NUMERIC(5,2) NOT NULL,
  regime TEXT NOT NULL CHECK (regime IN ('QUIET','COOL','ACTIVE','HOT','BANANAS','UNSTABLE','DEFENSIVE')),
  opportunity_count INTEGER DEFAULT 0,
  avg_momentum NUMERIC(8,4),
  buy_pressure_distribution NUMERIC(8,4),
  volume_acceleration NUMERIC(8,4),
  new_launch_count INTEGER DEFAULT 0,
  inputs_json JSONB,
  cycle_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OPPORTUNITIES
-- Discovered and scored trade candidates
-- ============================================
CREATE TABLE opportunities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT NOT NULL,
  address TEXT NOT NULL,
  chain TEXT DEFAULT 'bsc',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  score NUMERIC(6,2) NOT NULL,
  market_regime TEXT,
  features_json JSONB,
  tradeability_status TEXT DEFAULT 'pending' CHECK (tradeability_status IN ('pending','pass','fail','timeout')),
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered','qualified','rejected','selected','expired','traded')),
  rejection_reason TEXT,
  cycle_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI DECISIONS
-- Every AI recommendation with full context
-- ============================================
CREATE TABLE ai_decisions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  opportunity_id UUID REFERENCES opportunities(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  context_json JSONB NOT NULL,
  decision_json JSONB NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY','SELL','PARTIAL_BUY','PARTIAL_SELL','HOLD','ROTATE','WAIT','ESCALATE')),
  confidence NUMERIC(4,3),
  requires_confirmation BOOLEAN DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POSITIONS
-- Active and historical positions
-- ============================================
CREATE TABLE positions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT NOT NULL,
  address TEXT NOT NULL,
  chain TEXT DEFAULT 'bsc',
  entry_price NUMERIC(20,10) NOT NULL,
  entry_value NUMERIC(10,2) NOT NULL,
  quantity NUMERIC(20,10) NOT NULL,
  current_price NUMERIC(20,10),
  current_value NUMERIC(10,2),
  realized_pnl NUMERIC(10,2) DEFAULT 0,
  unrealized_pnl NUMERIC(10,2) DEFAULT 0,
  high_water_mark NUMERIC(20,10),
  take_profit_pct NUMERIC(6,2),
  stop_loss_pct NUMERIC(6,2),
  trailing_stop_pct NUMERIC(6,2),
  trailing_active BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','partially_closed','closing','closed','error','reconciliation_required')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ============================================
-- ORDERS
-- Execution attempts
-- ============================================
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_id UUID REFERENCES positions(id),
  token TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY','SELL')),
  requested_qty NUMERIC(20,10),
  requested_value NUMERIC(10,2),
  quote_json JSONB,
  executed_qty NUMERIC(20,10),
  executed_price NUMERIC(20,10),
  executed_value NUMERIC(10,2),
  fee NUMERIC(10,4),
  tx_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','quoted','executed','verified','failed','reconciled')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRADES
-- Completed trade records (authoritative)
-- ============================================
CREATE TABLE trades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_id UUID REFERENCES positions(id),
  order_id UUID REFERENCES orders(id),
  token TEXT NOT NULL,
  token_address TEXT,
  action TEXT NOT NULL CHECK (action IN ('BUY','SELL')),
  price NUMERIC(20,10) NOT NULL,
  quantity NUMERIC(20,10) NOT NULL,
  value NUMERIC(10,2) NOT NULL,
  pnl NUMERIC(10,2),
  pnl_pct NUMERIC(8,4),
  fee NUMERIC(10,4),
  tx_hash TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PORTFOLIO SNAPSHOTS
-- Periodic portfolio state
-- ============================================
CREATE TABLE portfolio_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  total_value NUMERIC(10,2) NOT NULL,
  cash_usdt NUMERIC(10,2),
  bnb_balance NUMERIC(10,4),
  deployed_value NUMERIC(10,2),
  exposure_pct NUMERIC(5,2),
  unrealized_pnl NUMERIC(10,2),
  open_position_count INTEGER DEFAULT 0,
  mission_id UUID REFERENCES missions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WALLET SNAPSHOTS
-- On-chain wallet state for reconciliation
-- ============================================
CREATE TABLE wallet_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  usdt_balance NUMERIC(10,2),
  bnb_balance NUMERIC(10,6),
  token_balances JSONB,
  total_usdt_value NUMERIC(10,2),
  reconciled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SYSTEM EVENTS
-- Immutable audit trail
-- ============================================
CREATE TABLE system_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  message TEXT,
  data_json JSONB,
  cycle_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SYSTEM ERRORS
-- Error tracking
-- ============================================
CREATE TABLE system_errors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  component TEXT NOT NULL,
  error_type TEXT NOT NULL,
  message TEXT,
  stack_trace TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI PROVIDER CALLS
-- Track AI usage for cost/latency analysis
-- ============================================
CREATE TABLE ai_provider_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  cost_usd NUMERIC(8,6),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUTONOMY STATE
-- Current system autonomy configuration
-- ============================================
CREATE TABLE autonomy_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  mode TEXT DEFAULT 'normal' CHECK (mode IN ('soft','normal','aggressive','protect','preserve','emergency')),
  paused BOOLEAN DEFAULT false,
  last_decision_action TEXT,
  last_decision_at TIMESTAMPTZ,
  consecutive_losses INTEGER DEFAULT 0,
  daily_pnl NUMERIC(10,2) DEFAULT 0,
  daily_trades INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONFIGURATION
-- System configuration key-value store
-- ============================================
CREATE TABLE configuration (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_snapshots_token ON market_snapshots(token);
CREATE INDEX idx_snapshots_cycle ON market_snapshots(cycle_id);
CREATE INDEX idx_snapshots_created ON market_snapshots(created_at DESC);

CREATE INDEX idx_regimes_created ON market_regimes(created_at DESC);

CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_score ON opportunities(score DESC);
CREATE INDEX idx_opportunities_token ON opportunities(token);

CREATE INDEX idx_decisions_action ON ai_decisions(action);
CREATE INDEX idx_decisions_created ON ai_decisions(created_at DESC);

CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_token ON positions(token);

CREATE INDEX idx_orders_position ON orders(position_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_trades_token ON trades(token);
CREATE INDEX idx_trades_created ON trades(created_at DESC);

CREATE INDEX idx_events_type ON system_events(event_type);
CREATE INDEX idx_events_created ON system_events(created_at DESC);

CREATE INDEX idx_errors_resolved ON system_errors(resolved);
CREATE INDEX idx_errors_created ON system_errors(created_at DESC);

CREATE INDEX idx_ai_calls_provider ON ai_provider_calls(provider);
CREATE INDEX idx_ai_calls_created ON ai_provider_calls(created_at DESC);

-- ============================================
-- VIEWS
-- ============================================

-- Active positions with current P&L
CREATE VIEW active_positions AS
SELECT
  id, token, address, entry_price, entry_value, quantity,
  current_price, current_value, unrealized_pnl,
  take_profit_pct, stop_loss_pct, trailing_stop_pct,
  status, opened_at
FROM positions
WHERE status = 'open';

-- Trade performance summary
CREATE VIEW trade_performance AS
SELECT
  token,
  COUNT(*) FILTER (WHERE action = 'BUY') as buys,
  COUNT(*) FILTER (WHERE action = 'SELL') as sells,
  SUM(CASE WHEN action = 'SELL' THEN pnl ELSE 0 END) as total_pnl,
  AVG(CASE WHEN action = 'SELL' THEN pnl_pct ELSE NULL END) as avg_pnl_pct,
  MAX(CASE WHEN action = 'SELL' THEN pnl_pct ELSE NULL END) as best_trade,
  MIN(CASE WHEN action = 'SELL' THEN pnl_pct ELSE NULL END) as worst_trade,
  COUNT(*) FILTER (WHERE action = 'SELL' AND pnl > 0)::FLOAT /
    NULLIF(COUNT(*) FILTER (WHERE action = 'SELL'), 0) as win_rate
FROM trades WHERE status = 'completed'
GROUP BY token;

-- Recent system health
CREATE VIEW system_health AS
SELECT
  (SELECT COUNT(*) FROM positions WHERE status = 'open') as open_positions,
  (SELECT COUNT(*) FROM opportunities WHERE status = 'discovered' AND created_at > NOW() - INTERVAL '1 hour') as recent_opportunities,
  (SELECT COUNT(*) FROM ai_decisions WHERE created_at > NOW() - INTERVAL '1 hour') as recent_decisions,
  (SELECT COUNT(*) FROM system_errors WHERE resolved = false) as unresolved_errors,
  (SELECT mode FROM autonomy_state ORDER BY updated_at DESC LIMIT 1) as current_mode;

-- ============================================
-- SEED: Initial mission & configuration
-- ============================================
INSERT INTO missions (name, starting_capital, target_capital, deadline, status) VALUES
  ('Genesis Mission', 12.35, 10000, NOW() + INTERVAL '7 days', 'active');

INSERT INTO autonomy_state (mode, paused) VALUES ('normal', false);

INSERT INTO configuration (key, value, category, description) VALUES
  ('ai_provider', 'openai', 'ai', 'AI provider for decisions'),
  ('ai_model', 'gpt-4o', 'ai', 'AI model for decisions'),
  ('ai_endpoint', '', 'ai', 'Custom endpoint URL for provider'),
  ('scan_interval_ms', '30000', 'scanning', 'Milliseconds between scans'),
  ('max_position_pct', '80', 'risk', 'Max % of capital per position'),
  ('max_daily_loss_pct', '20', 'risk', 'Max daily loss before PROTECT mode'),
  ('min_liquidity_usd', '5000', 'scanning', 'Minimum liquidity to consider'),
  ('min_buy_pressure', '1.5', 'scanning', 'Minimum buy/sell ratio'),
  ('gas_reserve_usdt', '0.50', 'risk', 'Minimum USDT reserved for gas'),
  ('regime_thresholds', '{"quiet":20,"cool":40,"active":60,"hot":80,"bananas":100}', 'regime', 'Heat score thresholds'),
  ('tp_default_pct', '10', 'positions', 'Default take-profit %'),
  ('sl_default_pct', '5', 'positions', 'Default stop-loss %'),
  ('trailing_default_pct', '3', 'positions', 'Default trailing stop %');
