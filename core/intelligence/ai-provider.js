/**
 * MaurEdge 3.0 — AI Provider Abstraction
 * 15 providers. One interface. Never couple the core to one model.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ============================================
// DECISION SCHEMA
// ============================================

const DECISION_SCHEMA = {
  action: ['BUY', 'SELL', 'PARTIAL_BUY', 'PARTIAL_SELL', 'HOLD', 'ROTATE', 'WAIT', 'ESCALATE'],
  confidence: { min: 0, max: 1 },
  required_fields: ['action', 'confidence', 'reason'],
};

// ============================================
// PROVIDER REGISTRY
// ============================================

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini', 'o4-mini'],
    defaultModel: 'gpt-4o',
    format: 'openai',
    keyEnv: 'OPENAI_API_KEY',
    keyPlaceholder: 'sk-...',
  },
  anthropic: {
    name: 'Anthropic',
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    defaultModel: 'claude-sonnet-4-20250514',
    format: 'anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
    keyPlaceholder: 'sk-ant-...',
  },
  gemini: {
    name: 'Google Gemini',
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models/{model}:generateContent',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.5-flash',
    format: 'gemini',
    keyEnv: 'GEMINI_API_KEY',
    keyPlaceholder: 'AIza...',
  },
  mistral: {
    name: 'Mistral AI',
    hostname: 'api.mistral.ai',
    path: '/v1/chat/completions',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'open-mistral-nemo'],
    defaultModel: 'mistral-large-latest',
    format: 'openai',
    keyEnv: 'MISTRAL_API_KEY',
    keyPlaceholder: '',
  },
  groq: {
    name: 'Groq',
    hostname: 'api.groq.com',
    path: '/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    defaultModel: 'llama-3.3-70b-versatile',
    format: 'openai',
    keyEnv: 'GROQ_API_KEY',
    keyPlaceholder: 'gsk_...',
  },
  deepseek: {
    name: 'DeepSeek',
    hostname: 'api.deepseek.com',
    path: '/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    format: 'openai',
    keyEnv: 'DEEPSEEK_API_KEY',
    keyPlaceholder: 'sk-...',
  },
  openrouter: {
    name: 'OpenRouter',
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat'],
    defaultModel: 'openai/gpt-4o',
    format: 'openai',
    keyEnv: 'OPENROUTER_API_KEY',
    keyPlaceholder: 'sk-or-...',
  },
  together: {
    name: 'Together AI',
    hostname: 'api.together.xyz',
    path: '/v1/chat/completions',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen-2.5-72B-Instruct-Turbo', 'DeepSeek-V3', 'mistralai/Mistral-7B-Instruct-v0.3'],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    format: 'openai',
    keyEnv: 'TOGETHER_API_KEY',
    keyPlaceholder: '',
  },
  fireworks: {
    name: 'Fireworks AI',
    hostname: 'api.fireworks.ai',
    path: '/inference/v1/chat/completions',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/qwen-v2p5-72b-instruct', 'accounts/fireworks/models/deepseek-v3'],
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    format: 'openai',
    keyEnv: 'FIREWORKS_API_KEY',
    keyPlaceholder: 'fw_...',
  },
  xai: {
    name: 'xAI (Grok)',
    hostname: 'api.x.ai',
    path: '/v1/chat/completions',
    models: ['grok-3', 'grok-3-mini', 'grok-2', 'grok-2-mini'],
    defaultModel: 'grok-3',
    format: 'openai',
    keyEnv: 'XAI_API_KEY',
    keyPlaceholder: 'xai-...',
  },
  perplexity: {
    name: 'Perplexity',
    hostname: 'api.perplexity.ai',
    path: '/chat/completions',
    models: ['sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-reasoning'],
    defaultModel: 'sonar-pro',
    format: 'openai',
    keyEnv: 'PERPLEXITY_API_KEY',
    keyPlaceholder: 'pplx-...',
  },
  azure: {
    name: 'Azure OpenAI',
    hostname: '{your-resource}.openai.azure.com',
    path: '/openai/deployments/{deployment}/chat/completions?api-version=2024-08-01-preview',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-35-turbo'],
    defaultModel: 'gpt-4o',
    format: 'openai',
    keyEnv: 'AZURE_OPENAI_API_KEY',
    keyPlaceholder: '',
    needsEndpoint: true,
  },
  ollama: {
    name: 'Ollama (Local)',
    hostname: 'localhost',
    port: 11434,
    path: '/api/chat',
    models: ['llama3.3', 'mistral', 'qwen2.5:72b', 'deepseek-v3', 'codellama'],
    defaultModel: 'llama3.3',
    format: 'ollama',
    keyEnv: '',
    keyPlaceholder: 'not required',
    noKeyRequired: true,
  },
  opencode: {
    name: 'OpenCode',
    hostname: '{your-endpoint}',
    path: '/v1/chat/completions',
    models: ['custom-model'],
    defaultModel: 'custom-model',
    format: 'openai',
    keyEnv: 'OPENCODE_API_KEY',
    keyPlaceholder: '',
    needsEndpoint: true,
  },
  cohere: {
    name: 'Cohere',
    hostname: 'api.cohere.com',
    path: '/v2/chat',
    models: ['command-r-plus-08-2024', 'command-r-08-2024', 'command-light'],
    defaultModel: 'command-r-plus-08-2024',
    format: 'cohere',
    keyEnv: 'COHERE_API_KEY',
    keyPlaceholder: '',
  },
};

// ============================================
// GENERIC HTTP CLIENT
// ============================================

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.request(parsedUrl, { ...options, hostname: parsedUrl.hostname, port: parsedUrl.port, path: parsedUrl.pathname + parsedUrl.search }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, data: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ============================================
// FORMAT-SPECIFIC REQUEST BUILDERS
// ============================================

function buildOpenAIRequest(messages, model) {
  return JSON.stringify({
    model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 500,
  });
}

function buildAnthropicRequest(messages, model) {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsg = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n');
  return JSON.stringify({
    model,
    max_tokens: 502,
    system: systemMsg,
    messages: [{ role: 'user', content: userMsg }],
  });
}

function buildGeminiRequest(messages, model) {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsg = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n');
  return JSON.stringify({
    contents: [{ parts: [{ text: systemMsg + '\n\n' + userMsg }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 500 },
  });
}

function buildCohereRequest(messages, model) {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsg = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n');
  return JSON.stringify({
    model,
    messages: [{ role: 'User', content: userMsg }],
    preamble: systemMsg,
    response_format: { type: 'json_object' },
  });
}

function buildOllamaRequest(messages, model) {
  return JSON.stringify({
    model,
    messages,
    stream: false,
    format: 'json',
    options: { temperature: 0.3, num_predict: 500 },
  });
}

// ============================================
// FORMAT-SPECIFIC RESPONSE PARSERS
// ============================================

function parseOpenAIResponse(result) {
  const content = result?.choices?.[0]?.message?.content;
  if (!content) return null;
  try { return { decision: JSON.parse(content), usage: result.usage }; }
  catch { return null; }
}

function parseAnthropicResponse(result) {
  const content = result?.content?.[0]?.text;
  if (!content) return null;
  try { return { decision: JSON.parse(content), usage: result.usage }; }
  catch { return null; }
}

function parseGeminiResponse(result) {
  const content = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) return null;
  try { return { decision: JSON.parse(content), usage: result.usageMetadata }; }
  catch { return null; }
}

function parseCohereResponse(result) {
  const content = result?.message?.content?.[0]?.text;
  if (!content) return null;
  try { return { decision: JSON.parse(content), usage: result.meta }; }
  catch { return null; }
}

function parseOllamaResponse(result) {
  const content = result?.message?.content;
  if (!content) return null;
  try { return { decision: JSON.parse(content), usage: { eval_count: result.eval_count } }; }
  catch { return null; }
}

// ============================================
// GENERIC PROVIDER CLASS
// ============================================

class GenericProvider {
  constructor(providerKey, config = {}) {
    const reg = PROVIDERS[providerKey];
    if (!reg) throw new Error(`Unknown provider: ${providerKey}`);

    this.providerKey = providerKey;
    this.reg = reg;
    this.model = config.model || reg.defaultModel;
    this.apiKey = config.apiKey || '';
    this.customEndpoint = config.endpoint || '';
  }

  _getURL() {
    let hostname = this.reg.hostname;
    let path = this.reg.path;

    if (this.customEndpoint) {
      try {
        const u = new URL(this.customEndpoint);
        hostname = u.hostname;
        path = u.pathname + u.search;
      } catch {
        hostname = this.customEndpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
      }
    }

    if (this.providerKey === 'azure') path = path.replace('{deployment}', this.model);
    if (this.providerKey === 'gemini') path = path.replace('{model}', this.model);

    const port = this.reg.port || (this.reg.hostname === 'localhost' ? 11434 : undefined);
    const proto = this.reg.hostname === 'localhost' || this.customEndpoint?.startsWith('http://') ? 'http' : 'https';
    const portStr = port ? `:${port}` : '';

    if (this.customEndpoint && !this.customEndpoint.includes('://')) {
      return `${proto}://${hostname}${portStr}${path}`;
    }
    if (this.customEndpoint) return this.customEndpoint.replace(/\/$/, '') + path;

    return `${proto}://${hostname}${portStr}${path}`;
  }

  _getHeaders() {
    const headers = { 'Content-Type': 'application/json' };

    if (['openai', 'mistral', 'groq', 'deepseek', 'openrouter', 'together', 'fireworks', 'xai', 'perplexity', 'azure', 'opencode', 'cohere'].includes(this.providerKey)) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    else if (this.providerKey === 'anthropic') {
      headers['x-api-key'] = this.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }
    if (this.providerKey === 'azure') {
      headers['api-key'] = this.apiKey;
      delete headers['Authorization'];
    }

    return headers;
  }

  async decide(context, systemPrompt) {
    const messages = [
      { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(context, null, 2) },
    ];

    let url = this._getURL();
    if (this.providerKey === 'gemini' && this.apiKey) url += `?key=${this.apiKey}`;

    const headers = this._getHeaders();
    let body;

    switch (this.reg.format) {
      case 'openai': body = buildOpenAIRequest(messages, this.model); break;
      case 'anthropic': body = buildAnthropicRequest(messages, this.model); break;
      case 'gemini': body = buildGeminiRequest(messages, this.model); break;
      case 'cohere': body = buildCohereRequest(messages, this.model); break;
      case 'ollama': body = buildOllamaRequest(messages, this.model); break;
      default: body = buildOpenAIRequest(messages, this.model);
    }

    try {
      const result = await httpRequest(url, { method: 'POST', headers }, body);
      if (result.status >= 400) {
        const errMsg = result.data?.error?.message || result.data?.message || result.raw || `HTTP ${result.status}`;
        console.error(`❌ ${this.reg.name} error (${result.status}):`, errMsg.substring(0, 200));
        return null;
      }
      switch (this.reg.format) {
        case 'openai': return parseOpenAIResponse(result.data);
        case 'anthropic': return parseAnthropicResponse(result.data);
        case 'gemini': return parseGeminiResponse(result.data);
        case 'cohere': return parseCohereResponse(result.data);
        case 'ollama': return parseOllamaResponse(result.data);
        default: return parseOpenAIResponse(result.data);
      }
    } catch (err) {
      console.error(`❌ ${this.reg.name} connection error:`, err.message);
      return null;
    }
  }
}

// ============================================
// PROVIDER FACTORY
// ============================================

function createProvider(name, config = {}) {
  const key = name.toLowerCase().replace(/[\s-]/g, '');
  const aliases = {
    'gpt': 'openai', 'chatgpt': 'openai',
    'claude': 'anthropic',
    'google': 'gemini', 'bard': 'gemini',
    'mistralai': 'mistral',
    'llama': 'groq',
    'x': 'xai', 'grok': 'xai',
    'codex': 'opencode',
  };
  const resolved = aliases[key] || key;
  if (!PROVIDERS[resolved]) {
    console.warn(`⚠️  Unknown provider "${name}", defaulting to OpenAI`);
    return new GenericProvider('openai', config);
  }
  return new GenericProvider(resolved, config);
}

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
// DB-DRIVEN CONFIG LOADER
// ============================================

let _cachedConfig = null;
let _cacheTime = 0;
const CONFIG_CACHE_TTL = 30000; // 30 seconds

/**
 * Load AI config from database, with env var fallback.
 * Caches for 30s to avoid hammering DB every cycle.
 * Supports all 15 providers — fetches the right API key from DB.
 */
async function loadAIConfig(dbPool) {
  const now = Date.now();
  if (_cachedConfig && (now - _cacheTime) < CONFIG_CACHE_TTL) {
    return _cachedConfig;
  }

  let dbConfig = {};
  try {
    if (dbPool && dbPool.query) {
      const result = await dbPool.query(
        `SELECT key, value FROM configuration WHERE key LIKE '%api_key' OR key IN ('ai_provider','ai_model','ai_endpoint')`
      );
      for (const row of result.rows) dbConfig[row.key] = row.value;
    }
  } catch {
    // DB not available — fall through to env vars
  }

  const provider = dbConfig.ai_provider || process.env.AI_PROVIDER || 'openai';
  const providerReg = PROVIDERS[provider] || PROVIDERS.openai;

  // Resolve API key: DB key (lowercase env name) → env var
  const keyEnvName = providerReg.keyEnv;
  const dbKeyName = keyEnvName ? keyEnvName.toLowerCase() : '';

  const config = {
    provider,
    model: dbConfig.ai_model || process.env.AI_MODEL || providerReg.defaultModel,
    apiKey: dbConfig[dbKeyName] || process.env[keyEnvName] || '',
    endpoint: dbConfig.ai_endpoint || process.env.AI_ENDPOINT || '',
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
  PROVIDERS,
  DEFAULT_SYSTEM_PROMPT,
  DECISION_SCHEMA,
};
