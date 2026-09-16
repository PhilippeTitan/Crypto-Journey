/**
 * MaurEdge 3.0 — Capability Registry
 * 
 * The formal registry of what the agent CAN do.
 * The AI reasons over these capabilities; it doesn't invent new ones at runtime.
 * New capabilities go through the engineering layer (Loop 3).
 * 
 * Architecture position: Between AI REASONING and SKILL LAYER
 */

const CAPABILITIES = {
  // ─── MARKET CAPABILITIES ───────────────────────────────────
  scan_new_pairs: {
    id: 'scan_new_pairs',
    category: 'market',
    name: 'Scan New Pairs',
    description: 'Discover new BSC token pairs from DexScreener with liquidity ≥ $5K',
    module: 'core/discovery/opportunity.js',
    function: 'discover',
    params: {},
    returns: 'Array<{token, address, features, score}>',
    cost: { time_ms: 2000, api_calls: 2 },
    reliability: 0.95,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  inspect_token: {
    id: 'inspect_token',
    category: 'market',
    name: 'Inspect Token',
    description: 'Get detailed snapshot of a specific token from DexScreener',
    module: 'core/lib/dexscreener.js',
    function: 'getSnapshot',
    params: { address: 'string' },
    returns: 'Snapshot',
    cost: { time_ms: 500, api_calls: 1 },
    reliability: 0.98,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  compute_features: {
    id: 'compute_features',
    category: 'market',
    name: 'Compute Features',
    description: 'Derive momentum, flow, volume, liquidity, volatility from raw snapshot',
    module: 'core/market/features.js',
    function: 'computeFeatures',
    params: { snapshot: 'Snapshot' },
    returns: 'Features',
    cost: { time_ms: 10, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  detect_regime: {
    id: 'detect_regime',
    category: 'market',
    name: 'Detect Market Regime',
    description: 'Classify market heat into QUIET/COOL/ACTIVE/HOT/BANANAS/UNSTABLE/DEFENSIVE',
    module: 'core/intelligence/regime.js',
    function: 'detectRegime',
    params: { opportunities: 'Array' },
    returns: '{regime, heat_score, details}',
    cost: { time_ms: 50, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  check_tradeability: {
    id: 'check_tradeability',
    category: 'market',
    name: 'Check Tradeability',
    description: 'Verify if a token can be swapped via Binance Agentic Wallet',
    module: 'core/lib/baw.js',
    function: 'checkTradeability',
    params: { address: 'string' },
    returns: '{tradeable, reason}',
    cost: { time_ms: 1000, api_calls: 1 },
    reliability: 0.90,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  // ─── PORTFOLIO CAPABILITIES ────────────────────────────────
  get_positions: {
    id: 'get_positions',
    category: 'portfolio',
    name: 'Get Positions',
    description: 'Retrieve all open positions with current P&L',
    module: 'core/positions/engine.js',
    function: 'getOpenPositions',
    params: {},
    returns: 'Array<Position>',
    cost: { time_ms: 100, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  monitor_positions: {
    id: 'monitor_positions',
    category: 'portfolio',
    name: 'Monitor Positions',
    description: 'Check TP/SL/trailing stop on all open positions',
    module: 'core/positions/engine.js',
    function: 'monitorPositions',
    params: {},
    returns: 'Array<{positionId, action, reason}>',
    cost: { time_ms: 200, api_calls: 0 },
    reliability: 0.99,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  get_portfolio_state: {
    id: 'get_portfolio_state',
    category: 'portfolio',
    name: 'Get Portfolio State',
    description: 'Compute total value, exposure, allocation breakdown',
    module: 'core/positions/engine.js',
    function: 'getPortfolioState',
    params: {},
    returns: '{total_value, exposure_pct, allocations[], cash_available}',
    cost: { time_ms: 100, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  // ─── EXECUTION CAPABILITIES ────────────────────────────────
  get_quote: {
    id: 'get_quote',
    category: 'execution',
    name: 'Get Quote',
    description: 'Get a swap quote from Binance Agentic Wallet',
    module: 'core/lib/baw.js',
    function: 'getQuote',
    params: { from: 'string', to: 'string', amount: 'number' },
    returns: '{price, amount_out, fee, path}',
    cost: { time_ms: 800, api_calls: 1 },
    reliability: 0.95,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  execute_swap: {
    id: 'execute_swap',
    category: 'execution',
    name: 'Execute Swap',
    description: 'Execute a token swap via Binance Agentic Wallet',
    module: 'core/execution/engine.js',
    function: 'execute',
    params: { token: 'string', address: 'string', action: 'string', amount: 'number' },
    returns: '{success, tx_hash, amount_out}',
    cost: { time_ms: 5000, api_calls: 2 },
    reliability: 0.85,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  // ─── RISK CAPABILITIES ─────────────────────────────────────
  validate_risk: {
    id: 'validate_risk',
    category: 'risk',
    name: 'Validate Risk',
    description: 'Independent risk gate check on a proposed decision',
    module: 'core/risk/engine.js',
    function: 'validateDecision',
    params: { decision: 'Decision', state: 'State', limits: 'Limits' },
    returns: '{approved, reason, action_override}',
    cost: { time_ms: 10, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  check_circuit_breakers: {
    id: 'check_circuit_breakers',
    category: 'risk',
    name: 'Check Circuit Breakers',
    description: 'Check 5 breaker conditions (tx failures, wallet mismatch, data health, etc)',
    module: 'core/risk/engine.js',
    function: 'checkCircuitBreakers',
    params: { state: 'State' },
    returns: '{tripped: Array, shouldEmergency: boolean}',
    cost: { time_ms: 10, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  // ─── AI CAPABILITIES ───────────────────────────────────────
  ai_decide: {
    id: 'ai_decide',
    category: 'ai',
    name: 'AI Decision',
    description: 'Ask the AI provider to reason over context and return a structured decision',
    module: 'core/intelligence/ai-provider.js',
    function: 'decide',
    params: { context: 'Context', systemPrompt: 'string' },
    returns: '{action, confidence, reason, details}',
    cost: { time_ms: 3000, api_calls: 1 },
    reliability: 0.90,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  build_context: {
    id: 'build_context',
    category: 'ai',
    name: 'Build Context',
    description: 'Assemble portfolio, regime, opportunities into AI-ready context',
    module: 'core/intelligence/ai-provider.js',
    function: 'buildContext',
    params: { mission: 'Mission', positions: 'Array', regime: 'Regime', opportunities: 'Array' },
    returns: 'Context',
    cost: { time_ms: 10, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  // ─── MEMORY CAPABILITIES ───────────────────────────────────
  record_outcome: {
    id: 'record_outcome',
    category: 'memory',
    name: 'Record Outcome',
    description: 'Store a decision + outcome for future learning',
    module: 'core/memory/store.js',
    function: 'recordOutcome',
    params: { decision: 'Decision', outcome: 'Outcome' },
    returns: '{id, stored}',
    cost: { time_ms: 50, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },

  recall_similar: {
    id: 'recall_similar',
    category: 'memory',
    name: 'Recall Similar',
    description: 'Find past situations similar to current context',
    module: 'core/memory/store.js',
    function: 'recallSimilar',
    params: { context: 'Context', limit: 'number' },
    returns: 'Array<MemoryEntry>',
    cost: { time_ms: 100, api_calls: 0 },
    reliability: 1.0,
    lastUsed: null,
    successCount: 0,
    failCount: 0,
  },
};

const CATEGORIES = {
  market: { label: 'MARKET', color: 'cyan', icon: '📊' },
  portfolio: { label: 'PORTFOLIO', color: 'green', icon: '💰' },
  execution: { label: 'EXECUTION', color: 'violet', icon: '⚡' },
  risk: { label: 'RISK', color: 'amber', icon: '🛡️' },
  ai: { label: 'AI', color: 'blue', icon: '🧠' },
  memory: { label: 'MEMORY', color: 'purple', icon: '📝' },
};

/**
 * Get all capabilities, optionally filtered by category
 */
function getCapabilities(category = null) {
  const all = Object.values(CAPABILITIES);
  if (category) return all.filter(c => c.category === category);
  return all;
}

/**
 * Get a single capability by ID
 */
function getCapability(id) {
  return CAPABILITIES[id] || null;
}

/**
 * Record a capability use (success or failure)
 */
function recordUse(id, success) {
  const cap = CAPABILITIES[id];
  if (!cap) return;
  cap.lastUsed = new Date().toISOString();
  if (success) cap.successCount++;
  else cap.failCount++;
}

/**
 * Get capability stats for a category
 */
function getCategoryStats(category) {
  const caps = getCapabilities(category);
  return {
    total: caps.length,
    used: caps.filter(c => c.lastUsed).length,
    avgReliability: caps.reduce((s, c) => s + c.reliability, 0) / caps.length,
    totalCalls: caps.reduce((s, c) => s + c.successCount + c.failCount, 0),
  };
}

/**
 * Export as a snapshot for the UI (includes runtime stats)
 */
function getRegistrySnapshot() {
  const categories = {};
  for (const [cat, meta] of Object.entries(CATEGORIES)) {
    categories[cat] = {
      ...meta,
      capabilities: getCapabilities(cat),
      stats: getCategoryStats(cat),
    };
  }
  return {
    timestamp: new Date().toISOString(),
    total_capabilities: Object.keys(CAPABILITIES).length,
    categories,
  };
}

module.exports = {
  CAPABILITIES,
  CATEGORIES,
  getCapabilities,
  getCapability,
  recordUse,
  getCategoryStats,
  getRegistrySnapshot,
};
