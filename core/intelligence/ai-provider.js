/**
 * MaurEdge 3.0 — AI Provider Abstraction
 * Never couple the core system to one model.
 * AI receives structured context, produces structured decisions.
 */

const https = require('https');

// ============================================
// AI DECISION SCHEMA
// ============================================

const DECISION_SCHEMA = {
  action: ['BUY', 'SELL', 'PARTIAL_BUY', 'PARTIAL_SELL', 'HOLD', 'ROTATE', 'WAIT', 'ESCALATE'],
  confidence: { min: 0, max: 1 },
  required_fields: ['action', 'confidence', 'reason'],
};

// ============================================
// CONTEXT BUILDER
// ============================================

/**
 * Build the structured context the AI receives.
 * Deliberate — no arbitrary logs dumped into prompt.
 */
function buildContext({ mission, portfolio, positions, regime, opportunities, recentTrades, recentFailures, health, autonomyPolicy }) {
  return {
    mission: mission || null,
    portfolio: portfolio || null,
    open_positions: positions || [],
    market_regime: regime || null,
    top_opportunities: (opportunities || []).slice(0, 5),
    recent_trades: (recentTrades || []).slice(0, 10),
    recent_failures: (recentFailures || []).slice(0, 5),
    system_health: health || null,
    autonomy_policy: autonomyPolicy || null,
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// AI PROVIDER ADAPTERS
// ============================================

class OpenAIProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || 'gpt-4o';
    this.baseURL = 'https://api.openai.com/v1';
  }

  async decide(context, systemPrompt) {
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(context, null, 2) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const result = await this._request('POST', '/chat/completions', body);
    if (!result) return null;

    const content = result.choices?.[0]?.message?.content;
    const usage = result.usage;

    try {
      const decision = JSON.parse(content);
      return { decision, usage };
    } catch {
      return null;
    }
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        path,
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

class AnthropicProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  async decide(context, systemPrompt) {
    // Anthropic uses different API format — implement if needed
    console.warn('⚠️  Anthropic provider not yet implemented');
    return null;
  }
}

// ============================================
// PROVIDER FACTORY
// ============================================

function createProvider(name, config = {}) {
  switch (name.toLowerCase()) {
    case 'openai': return new OpenAIProvider(config);
    case 'anthropic': return new AnthropicProvider(config);
    default: return new OpenAIProvider(config);
  }
}

// ============================================
// DB-DRIVEN CONFIG LOADER
// ============================================

let _cachedConfig = null;
let _cacheTime = 0;
const CONFIG_CACHE_TTL = 30000; // 30 seconds

/**
 * Load AI config from database, with env var fallback.
 * Caches for 30s to avoid hammering DB every cycle.
 */
async function loadAIConfig(dbPool) {
  const now = Date.now();
  if (_cachedConfig && (now - _cacheTime) < CONFIG_CACHE_TTL) {
    return _cachedConfig;
  }

  let dbConfig = {};
  try {
    if (dbPool && dbPool.query) {
      const result = await dbPool.query('SELECT key, value FROM configuration WHERE key IN ($1, $2, $3)',
        ['ai_provider', 'ai_model', 'openai_api_key']);
      for (const row of result.rows) {
        dbConfig[row.key] = row.value;
      }
    }
  } catch {
    // DB not available — fall through to env vars
  }

  const config = {
    provider: dbConfig.ai_provider || process.env.AI_PROVIDER || 'openai',
    model: dbConfig.ai_model || process.env.AI_MODEL || 'gpt-4o',
    apiKey: dbConfig.openai_api_key || process.env.OPENAI_API_KEY || '',
  };

  _cachedConfig = config;
  _cacheTime = now;
  return config;
}

/** Clear config cache (call after user updates settings) */
function clearConfigCache() {
  _cachedConfig = null;
  _cacheTime = 0;
}

// ============================================
// VALIDATION
// ============================================

function validateDecision(raw) {
  if (!raw || typeof raw !== 'object') return { valid: false, error: 'Empty decision' };
  if (!DECISION_SCHEMA.action.includes(raw.action)) return { valid: false, error: `Invalid action: ${raw.action}` };
  if (typeof raw.confidence !== 'number' || raw.confidence < 0 || raw.confidence > 1) {
    return { valid: false, error: `Invalid confidence: ${raw.confidence}` };
  }
  if (!raw.reason || typeof raw.reason !== 'string') return { valid: false, error: 'Missing reason' };
  return { valid: true };
}

// ============================================
// DEFAULT SYSTEM PROMPT
// ============================================

const DEFAULT_SYSTEM_PROMPT = `You are MaurEdge, an autonomous crypto trading AI on BSC.

You analyze market data, portfolio state, and opportunities to make trading decisions.

AVAILABLE ACTIONS:
- BUY: Enter a new position
- SELL: Exit an existing position completely
- PARTIAL_BUY: Add to an existing position
- PARTIAL_SELL: Reduce an existing position
- HOLD: Keep current position unchanged
- ROTATE: Move capital from one position to another
- WAIT: Do nothing — no opportunity justifies action
- ESCALATE: Request human approval for significant decisions

RULES:
1. You must explain your reasoning in "reason"
2. Confidence must reflect genuine uncertainty (0.0 - 1.0)
3. NEVER recommend trading without liquidity
4. WAIT is always valid — do not force trades
5. ESCALATE when capital becomes significant or conditions are uncertain
6. Consider opportunity cost — is capital better deployed elsewhere?
7. Risk management is not your job — the system validates your decision after

OUTPUT FORMAT (JSON):
{
  "action": "WAIT|BUY|SELL|...",
  "confidence": 0.75,
  "reason": "Clear explanation",
  "candidate": "TOKEN_SYMBOL (if applicable)",
  "allocation": { ... (if ROTATE/PARTIAL_*) },
  "position_plan": { "take_profit_pct": 10, "stop_loss_pct": 5, "trailing_stop_pct": 3 }
}`;

module.exports = {
  createProvider,
  loadAIConfig,
  clearConfigCache,
  validateDecision,
  buildContext,
  DEFAULT_SYSTEM_PROMPT,
  DECISION_SCHEMA,
};
