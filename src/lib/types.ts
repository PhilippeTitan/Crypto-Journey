// ─── Mission ───
export interface Mission {
  id: string;
  name: string;
  start_value: number;
  target_value: number;
  status: string;
  started_at: string;
}

// ─── Position ───
export interface Position {
  id: string;
  token_symbol: string;
  token_address: string;
  chain: string;
  entry_price: number;
  current_price: number;
  quantity: number;
  value_usd: number;
  pnl_usd: number;
  pnl_percent: number;
  status: string;
}

// ─── Trade ───
export interface Trade {
  id: string;
  token_symbol: string;
  token_address: string;
  chain: string;
  action: string;
  price: number;
  quantity: number;
  value_usd: number;
  pnl_usd: number;
  pnl_percent: number;
  reason: string;
  created_at: string;
}

// ─── Opportunity ───
export interface Opportunity {
  id: string;
  token_symbol: string;
  token_address: string;
  chain: string;
  score: number;
  price: number;
  volume_24h: number;
  liquidity: number;
  change_5m: number;
  change_1h: number;
  created_at: string;
}

// ─── AI Decision ───
export interface AIDecision {
  id: string;
  provider: string;
  model: string;
  action: string;
  confidence: number;
  reason: string;
  token_symbol: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  created_at: string;
}

// ─── System Event ───
export interface SystemEvent {
  id: string;
  level: string;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Market Regime ───
export interface MarketRegime {
  id: string;
  regime: string;
  confidence: number;
  features: Record<string, unknown>;
  created_at: string;
}

// ─── Autonomy State ───
export interface AutonomyState {
  mode: string;
  risk_level: string;
  max_position_usd: number;
  daily_loss_limit: number;
  current_daily_pnl: number;
}

// ─── Provider Registry ───
export interface ProviderInfo {
  key: string;
  name: string;
  models: string[];
  defaultModel: string;
  keyPlaceholder: string;
  keyEnv?: string;
  noKeyRequired?: boolean;
  needsEndpoint?: boolean;
}

// ─── Configuration ───
export interface AppConfig {
  ai_provider?: string;
  ai_model?: string;
  ai_endpoint?: string;
  scan_interval_ms?: string;
  [key: string]: string | undefined;
}

// ─── Portfolio ───
export interface PortfolioSummary {
  totalValue: number;
  startValue: number;
  totalReturn: number;
  totalPnl: number;
  balance: { symbol: string; value: number }[];
}

// ─── Status Response ───
export interface StatusResponse {
  mission: Mission | null;
  positions: Position[];
  autonomy: AutonomyState | null;
  recentEvents: SystemEvent[];
  health: Record<string, unknown> | null;
}
