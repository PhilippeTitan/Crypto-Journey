/**
 * MaurEdge 3.0 — Memory / Experience Store
 * 
 * Session history with outcome tracking, pattern extraction, skill library.
 * The memory loop is what makes the agent learn over time.
 * 
 * Architecture position: OUTPUT → MEMORY → feeds back into STATE
 * 
 * This is a local in-memory store for now; it can persist to DB later.
 * The key principle: every decision + outcome is recorded, every pattern
 * is extracted, and the AI can recall similar situations in the future.
 */

// ─── IN-MEMORY STORE ───────────────────────────────────────

const memoryEntries = [];
const patternIndex = [];
const skillOutcomes = [];

const MAX_ENTRIES = 10000;
const MAX_PATTERNS = 500;

// ─── ENTRY TYPES ───────────────────────────────────────────

const ENTRY_TYPES = {
  DECISION: 'decision',
  TRADE: 'trade',
  EXIT: 'exit',
  REGIME_SHIFT: 'regime_shift',
  CIRCUIT_BREAK: 'circuit_break',
  SKILL_RESULT: 'skill_result',
  PATTERN: 'pattern',
};

// ─── CORE FUNCTIONS ────────────────────────────────────────

/**
 * Record a decision + outcome for future learning
 */
function recordOutcome(entry) {
  const record = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: entry.type || ENTRY_TYPES.DECISION,
    token: entry.token || null,
    address: entry.address || null,
    action: entry.action || 'unknown',
    confidence: entry.confidence || 0,
    reason: entry.reason || '',
    regime: entry.regime || null,
    portfolio_state: entry.portfolioState || null,
    outcome: {
      result: null,        // 'win', 'loss', 'breakeven', 'pending'
      pnl_pct: null,
      pnl_usd: null,
      duration_ms: null,
      exit_reason: null,
    },
    skill_used: entry.skillUsed || null,
    context_hash: hashContext(entry.context || {}),
  };

  memoryEntries.push(record);

  // Evict oldest if over limit
  if (memoryEntries.length > MAX_ENTRIES) {
    memoryEntries.splice(0, memoryEntries.length - MAX_ENTRIES);
  }

  return { id: record.id, stored: true };
}

/**
 * Update an existing entry with outcome data (when trade closes)
 */
function updateOutcome(entryId, outcome) {
  const entry = memoryEntries.find(e => e.id === entryId);
  if (!entry) return { found: false };

  entry.outcome = {
    ...entry.outcome,
    ...outcome,
    updated_at: new Date().toISOString(),
  };

  // Extract patterns from completed outcomes
  if (entry.outcome.result === 'win' || entry.outcome.result === 'loss') {
    extractPattern(entry);
  }

  return { found: true, updated: true };
}

/**
 * Find past situations similar to current context
 */
function recallSimilar(context, limit = 5) {
  const contextHash = hashContext(context);

  // Score each entry by similarity
  const scored = memoryEntries
    .filter(e => e.type === ENTRY_TYPES.TRADE || e.type === ENTRY_TYPES.DECISION)
    .map(entry => ({
      ...entry,
      similarity: computeSimilarity(context, entry),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

/**
 * Record a skill execution result
 */
function recordSkillResult(skillId, result) {
  const record = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    skill_id: skillId,
    success: result.success,
    steps: result.steps,
    duration_ms: result.total_duration_ms,
    context: result.context || null,
  };

  skillOutcomes.push(record);

  // Keep last 1000 skill results
  if (skillOutcomes.length > 1000) {
    skillOutcomes.splice(0, skillOutcomes.length - 1000);
  }

  return record;
}

/**
 * Get skill performance stats
 */
function getSkillStats(skillId) {
  const results = skillOutcomes.filter(r => r.skill_id === skillId);
  if (results.length === 0) {
    return { skill_id: skillId, calls: 0, success_rate: 0, avg_duration_ms: 0 };
  }

  const successes = results.filter(r => r.success).length;
  return {
    skill_id: skillId,
    calls: results.length,
    success_rate: successes / results.length,
    avg_duration_ms: results.reduce((s, r) => s + r.duration_ms, 0) / results.length,
    last_used: results[results.length - 1].timestamp,
  };
}

// ─── PATTERN EXTRACTION ───────────────────────────────────

/**
 * Extract a reusable pattern from a completed trade/decision
 */
function extractPattern(entry) {
  const pattern = {
    id: generateId(),
    extracted_at: new Date().toISOString(),
    token_pattern: entry.token ? categorizeToken(entry.token) : null,
    regime: entry.regime,
    action: entry.action,
    confidence_range: categorizeConfidence(entry.confidence),
    outcome: entry.outcome.result,
    pnl_range: categorizePnl(entry.outcome.pnl_pct),
    key_factors: extractKeyFactors(entry),
  };

  // Check if similar pattern already exists
  const existing = patternIndex.find(p =>
    p.token_pattern === pattern.token_pattern &&
    p.regime === pattern.regime &&
    p.action === pattern.action
  );

  if (existing) {
    // Update existing pattern with new data point
    existing.sample_count++;
    existing.win_rate = existing.outcome === 'win'
      ? (existing.win_rate * (existing.sample_count - 1) + 1) / existing.sample_count
      : (existing.win_rate * (existing.sample_count - 1)) / existing.sample_count;
    existing.last_seen = new Date().toISOString();
  } else {
    pattern.sample_count = 1;
    pattern.win_rate = entry.outcome.result === 'win' ? 1 : 0;
    patternIndex.push(pattern);
  }

  // Evict if over limit
  if (patternIndex.length > MAX_PATTERNS) {
    patternIndex.splice(0, patternIndex.length - MAX_PATTERNS);
  }

  return pattern;
}

/**
 * Get learned patterns, optionally filtered
 */
function getPatterns(filter = {}) {
  let patterns = [...patternIndex];

  if (filter.regime) patterns = patterns.filter(p => p.regime === filter.regime);
  if (filter.action) patterns = patterns.filter(p => p.action === filter.action);
  if (filter.min_samples) patterns = patterns.filter(p => p.sample_count >= filter.min_samples);
  if (filter.min_win_rate !== undefined) patterns = patterns.filter(p => p.win_rate >= filter.min_win_rate);

  return patterns.sort((a, b) => b.sample_count - a.sample_count);
}

// ─── STATISTICS ────────────────────────────────────────────

/**
 * Get overall memory stats
 */
function getMemoryStats() {
  const trades = memoryEntries.filter(e => e.type === ENTRY_TYPES.TRADE);
  const decisions = memoryEntries.filter(e => e.type === ENTRY_TYPES.DECISION);
  const completed = trades.filter(e => e.outcome.result !== 'pending' && e.outcome.result !== null);

  const wins = completed.filter(e => e.outcome.result === 'win');
  const losses = completed.filter(e => e.outcome.result === 'loss');

  return {
    total_entries: memoryEntries.length,
    total_decisions: decisions.length,
    total_trades: trades.length,
    completed_trades: completed.length,
    pending_trades: trades.length - completed.length,
    win_rate: completed.length > 0 ? wins.length / completed.length : 0,
    avg_win_pct: wins.length > 0
      ? wins.reduce((s, e) => s + (e.outcome.pnl_pct || 0), 0) / wins.length
      : 0,
    avg_loss_pct: losses.length > 0
      ? losses.reduce((s, e) => s + (e.outcome.pnl_pct || 0), 0) / losses.length
      : 0,
    patterns_extracted: patternIndex.length,
    skill_executions: skillOutcomes.length,
    memory_utilization: memoryEntries.length / MAX_ENTRIES,
  };
}

/**
 * Get recent entries for the event stream
 */
function getRecentEntries(limit = 20) {
  return memoryEntries.slice(-limit).reverse();
}

/**
 * Get timeline data for UI visualization
 */
function getTimeline(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  return memoryEntries
    .filter(e => e.timestamp >= cutoff)
    .map(e => ({
      timestamp: e.timestamp,
      type: e.type,
      action: e.action,
      token: e.token,
      outcome: e.outcome.result,
      pnl_pct: e.outcome.pnl_pct,
    }));
}

// ─── HELPERS ───────────────────────────────────────────────

let idCounter = 0;
function generateId() {
  return `mem_${Date.now()}_${++idCounter}`;
}

function hashContext(context) {
  // Simple hash of key context features for similarity matching
  const key = JSON.stringify({
    regime: context.regime,
    token_category: context.token ? categorizeToken(context.token) : null,
    portfolio_exposure: context.portfolioState?.exposure_pct,
    action: context.action,
  });
  return key;
}

function computeSimilarity(a, b) {
  let score = 0;
  let factors = 0;

  if (a.regime && b.regime) {
    factors++;
    if (a.regime === b.regime) score += 0.3;
  }

  if (a.action && b.action) {
    factors++;
    if (a.action === b.action) score += 0.25;
  }

  if (a.token && b.token) {
    factors++;
    if (categorizeToken(a.token) === categorizeToken(b.token)) score += 0.2;
  }

  if (a.portfolioState && b.portfolio_state) {
    factors++;
    const exposureDiff = Math.abs(
      (a.portfolioState.exposure_pct || 0) - (b.portfolio_state.exposure_pct || 0)
    );
    score += Math.max(0, 0.25 - exposureDiff / 200);
  }

  return factors > 0 ? score / factors : 0;
}

function categorizeToken(token) {
  if (!token) return 'unknown';
  const lower = token.toLowerCase();
  if (lower.includes('pepe') || lower.includes('doge') || lower.includes('shib') || lower.includes('bonk')) return 'meme';
  if (lower.includes('safe') || lower.includes('moon') || lower.includes('inu')) return 'meme';
  return 'other';
}

function categorizeConfidence(confidence) {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function categorizePnl(pnlPct) {
  if (pnlPct === null || pnlPct === undefined) return 'unknown';
  if (pnlPct > 20) return 'big_win';
  if (pnlPct > 5) return 'win';
  if (pnlPct > -5) return 'breakeven';
  if (pnlPct > -20) return 'loss';
  return 'big_loss';
}

function extractKeyFactors(entry) {
  const factors = [];
  if (entry.confidence > 0.8) factors.push('high_confidence');
  if (entry.confidence < 0.3) factors.push('low_confidence');
  if (entry.regime) factors.push(`regime_${entry.regime}`);
  if (entry.reason) factors.push(entry.reason.slice(0, 50));
  return factors;
}

module.exports = {
  ENTRY_TYPES,
  recordOutcome,
  updateOutcome,
  recallSimilar,
  recordSkillResult,
  getSkillStats,
  getPatterns,
  getMemoryStats,
  getRecentEntries,
  getTimeline,
  extractPattern,
};
