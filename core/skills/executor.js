/**
 * MaurEdge 3.0 — Skill Layer
 * 
 * Named skill sequences that compose capabilities into higher-level behaviors.
 * The AI requests a skill; the skill executor chains the right capabilities.
 * 
 * Architecture position: Below CAPABILITY REGISTRY, above STRUCTURED DECISION
 */

const { getCapability, recordUse, CAPABILITIES } = require('../capabilities/registry');

// ─── SKILL DEFINITIONS ──────────────────────────────────────

const SKILLS = {
  // ─── MARKET SCAN ───────────────────────────────────────
  MARKET_SCAN: {
    id: 'MARKET_SCAN',
    name: 'Market Scan',
    description: 'Discover → Normalize → Filter → Score → Rank → Tradeability',
    category: 'market',
    steps: [
      { capability: 'scan_new_pairs', label: 'Scanning new BSC pairs' },
      { capability: 'compute_features', label: 'Computing feature field' },
      { capability: 'detect_regime', label: 'Classifying market heat' },
      { capability: 'check_tradeability', label: 'Checking tradeability' },
    ],
    onSuccess: 'returns candidate set with scores',
    onFailure: 'returns empty set, logs error',
  },

  // ─── EVALUATE OPPORTUNITY ──────────────────────────────
  EVALUATE_OPPORTUNITY: {
    id: 'EVALUATE_OPPORTUNITY',
    name: 'Evaluate Opportunity',
    description: 'Inspect → Compare → Quote → Risk check a specific token',
    category: 'market',
    steps: [
      { capability: 'inspect_token', label: 'Inspecting token data' },
      { capability: 'compute_features', label: 'Computing features' },
      { capability: 'get_quote', label: 'Getting swap quote' },
      { capability: 'validate_risk', label: 'Running risk check' },
    ],
    onSuccess: 'returns evaluation with quote and risk verdict',
    onFailure: 'returns rejection reason',
  },

  // ─── ROTATE CAPITAL ────────────────────────────────────
  ROTATE_CAPITAL: {
    id: 'ROTATE_CAPITAL',
    name: 'Rotate Capital',
    description: 'Compare → Partial sell → Quote → Partial buy → Reconcile',
    category: 'execution',
    steps: [
      { capability: 'get_positions', label: 'Checking current positions' },
      { capability: 'get_portfolio_state', label: 'Computing portfolio state' },
      { capability: 'get_quote', label: 'Quoting exit from current' },
      { capability: 'execute_swap', label: 'Executing sell' },
      { capability: 'get_quote', label: 'Quoting entry to new' },
      { capability: 'execute_swap', label: 'Executing buy' },
      { capability: 'record_outcome', label: 'Recording rotation' },
    ],
    onSuccess: 'returns new position state',
    onFailure: 'reverts partial, logs failure',
  },

  // ─── BUY POSITION ──────────────────────────────────────
  BUY_POSITION: {
    id: 'BUY_POSITION',
    name: 'Buy Position',
    description: 'Quote → Validate → Execute → Record',
    category: 'execution',
    steps: [
      { capability: 'get_portfolio_state', label: 'Checking available capital' },
      { capability: 'get_quote', label: 'Getting buy quote' },
      { capability: 'validate_risk', label: 'Risk gate check' },
      { capability: 'execute_swap', label: 'Executing buy' },
      { capability: 'record_outcome', label: 'Recording trade' },
    ],
    onSuccess: 'returns new position',
    onFailure: 'logs failure, no position opened',
  },

  // ─── SELL POSITION ─────────────────────────────────────
  SELL_POSITION: {
    id: 'SELL_POSITION',
    name: 'Sell Position',
    description: 'Quote exit → Execute → Reconcile → Record',
    category: 'execution',
    steps: [
      { capability: 'get_positions', label: 'Identifying position to sell' },
      { capability: 'get_quote', label: 'Getting sell quote' },
      { capability: 'execute_swap', label: 'Executing sell' },
      { capability: 'record_outcome', label: 'Recording trade' },
    ],
    onSuccess: 'returns closed position with P&L',
    onFailure: 'logs failure, position remains open',
  },

  // ─── PROTECT CAPITAL ───────────────────────────────────
  PROTECT_CAPITAL: {
    id: 'PROTECT_CAPITAL',
    name: 'Protect Capital',
    description: 'Monitor → Detect threat → Reduce exposure → Preserve optionality',
    category: 'risk',
    steps: [
      { capability: 'monitor_positions', label: 'Scanning positions for threats' },
      { capability: 'check_circuit_breakers', label: 'Checking circuit breakers' },
      { capability: 'validate_risk', label: 'Running risk assessment' },
    ],
    onSuccess: 'returns protection actions (if any)',
    onFailure: 'escalates to human',
  },

  // ─── CONTEXT BUILD ─────────────────────────────────────
  BUILD_CONTEXT: {
    id: 'BUILD_CONTEXT',
    name: 'Build Context',
    description: 'Assemble everything the AI needs to reason',
    category: 'ai',
    steps: [
      { capability: 'get_positions', label: 'Loading positions' },
      { capability: 'get_portfolio_state', label: 'Computing portfolio state' },
      { capability: 'detect_regime', label: 'Getting market regime' },
      { capability: 'build_context', label: 'Assembling AI context' },
      { capability: 'recall_similar', label: 'Recalling similar past situations' },
    ],
    onSuccess: 'returns structured context for AI',
    onFailure: 'returns partial context',
  },

  // ─── AI REASON ─────────────────────────────────────────
  AI_REASON: {
    id: 'AI_REASON',
    name: 'AI Reason',
    description: 'Ask the AI to reason and return a decision',
    category: 'ai',
    steps: [
      { capability: 'ai_decide', label: 'AI reasoning in progress' },
      { capability: 'record_outcome', label: 'Logging decision' },
    ],
    onSuccess: 'returns structured decision',
    onFailure: 'returns WAIT with fallback reason',
  },

  // ─── FULL CYCLE ────────────────────────────────────────
  FULL_CYCLE: {
    id: 'FULL_CYCLE',
    name: 'Full Autonomous Cycle',
    description: 'The complete runCycle() pipeline: observe → decide → execute → reconcile',
    category: 'orchestration',
    steps: [
      { skill: 'PROTECT_CAPITAL', label: 'Step 1: Monitor & protect' },
      { skill: 'MARKET_SCAN', label: 'Step 2: Discover opportunities' },
      { skill: 'BUILD_CONTEXT', label: 'Step 3: Build AI context' },
      { skill: 'AI_REASON', label: 'Step 4: AI decision' },
      // Steps 5-6 are decision-dependent (BUY/SELL/ROTATE/WAIT)
    ],
    onSuccess: 'returns cycle result',
    onFailure: 'returns cycle error',
  },
};

// ─── SKILL EXECUTOR ───────────────────────────────────────

/**
 * Execute a skill by chaining its capabilities
 * @param {string} skillId - The skill to execute
 * @param {object} initialContext - Starting context (opportunities, positions, etc.)
 * @param {object} deps - Injected dependencies (db, baw, etc.)
 * @returns {{ success, result, steps, timeline }}
 */
async function executeSkill(skillId, initialContext = {}, deps = {}) {
  const skill = SKILLS[skillId];
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);

  const startTime = Date.now();
  const stepResults = [];
  let context = { ...initialContext };
  let success = true;

  for (const step of skill.steps) {
    const stepStart = Date.now();
    const stepResult = {
      label: step.label,
      capability: step.capability || step.skill,
      type: step.skill ? 'skill' : 'capability',
      startTime: new Date().toISOString(),
    };

    try {
      if (step.skill) {
        // Nested skill execution
        const subResult = await executeSkill(step.skill, context, deps);
        stepResult.success = subResult.success;
        stepResult.result = subResult.result;
        stepResult.duration_ms = Date.now() - stepStart;
        if (subResult.success) {
          context = { ...context, ...subResult.result };
        } else {
          stepResult.error = 'Sub-skill failed';
          success = false;
        }
      } else {
        // Direct capability execution
        const cap = getCapability(step.capability);
        if (!cap) throw new Error(`Unknown capability: ${step.capability}`);

        // In real execution, this would call the actual module function
        // For now, we record the intent
        stepResult.module = cap.module;
        stepResult.function = cap.function;
        stepResult.params = cap.params;
        stepResult.duration_ms = Date.now() - stepStart;
        stepResult.success = true;

        recordUse(step.capability, true);
      }
    } catch (err) {
      stepResult.success = false;
      stepResult.error = err.message;
      stepResult.duration_ms = Date.now() - stepStart;
      recordUse(step.capability, false);
      success = false;
    }

    stepResults.push(stepResult);
  }

  return {
    skill: skillId,
    success,
    steps: stepResults,
    total_duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get a skill definition
 */
function getSkill(id) {
  return SKILLS[id] || null;
}

/**
 * List all skills, optionally by category
 */
function getSkills(category = null) {
  const all = Object.values(SKILLS);
  if (category) return all.filter(s => s.category === category);
  return all;
}

/**
 * Export snapshot for UI
 */
function getSkillLibrarySnapshot() {
  return {
    timestamp: new Date().toISOString(),
    total_skills: Object.keys(SKILLS).length,
    skills: Object.values(SKILLS).map(s => ({
      ...s,
      step_count: s.steps.length,
      has_nested: s.steps.some(st => st.skill),
    })),
  };
}

module.exports = {
  SKILLS,
  executeSkill,
  getSkill,
  getSkills,
  getSkillLibrarySnapshot,
};
