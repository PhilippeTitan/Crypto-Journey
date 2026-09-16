# MaurEdge 3.0 — Architecture

> The UI is not a dashboard. It's a live projection of the agent's cognition.

## The Foundational Cycle

```
MISSION → STATE → CAPABILITIES → SKILLS → REASONING → 
DECISION → GUARDRAILS → ACTION → OUTCOME → MEMORY → STATE
```

---

## Loop 1: The Main Trading Loop

```
                              ┌──────────────────────────────┐
                              │        HUMAN OPERATOR        │
                              │                              │
                              │  Observe · Intervene        │
                              │  Take Control · Release     │
                              └──────────────┬───────────────┘
                                             │
                                    commands / overrides
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            MAUREDGE MISSION                                  │
│                                                                              │
│                         $12  ────────────►  $10,000                         │
│                                                                              │
│        Objective: maximize mission progress subject to system constraints   │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌────────────────────────────────┐
                    │       AUTONOMY CONTROLLER      │
                    │                                │
                    │ SOFT · NORMAL · AGGRESSIVE     │
                    │ PROTECT · PRESERVE · EMERGENCY │
                    └───────────────┬────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    OBSERVE MARKET    │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼─────────────────┐
                    ▼               ▼                 ▼
              ┌──────────┐   ┌────────────┐    ┌────────────┐
              │ Binance  │   │DexScreener │    │ On-chain   │
              │   API    │   │            │    │   state    │
              └────┬─────┘   └─────┬──────┘    └─────┬──────┘
                   │               │                  │
                   └───────────────┼──────────────────┘
                                   ▼
                     ┌──────────────────────────┐
                     │    MARKET NORMALIZATION  │
                     │                          │
                     │ raw → trusted market     │
                     │ state                    │
                     └─────────────┬────────────┘
                                   │
                                   ▼
                     ┌──────────────────────────┐
                     │      FEATURE ENGINE       │
                     │                          │
                     │ momentum                 │
                     │ buy pressure             │
                     │ volume acceleration      │
                     │ liquidity                │
                     │ volatility               │
                     │ FDV / liquidity          │
                     │ age / tradeability       │
                     └─────────────┬────────────┘
                                   │
                                   ▼
                   ┌────────────────────────────────┐
                   │      OPPORTUNITY ENGINE        │
                   │                                │
                   │ discover → filter → score      │
                   │ → rank → tradeability          │
                   └───────────────┬────────────────┘
                                   │
                         candidates / opportunity set
                                   │
                                   ▼
             ┌─────────────────────────────────────────────┐
             │             PORTFOLIO CONTEXT               │
             │                                             │
             │ current positions                           │
             │ available capital                           │
             │ exposure                                    │
             │ portfolio heat                              │
             │ market heat                                 │
             │ opportunity cost                            │
             │ mission progress                            │
             └─────────────────────┬───────────────────────┘
                                   │
                                   ▼
                     ┌──────────────────────────┐
                     │       AI REASONING       │
                     │                          │
                     │ "Given everything I know │
                     │  and the mission, what   │
                     │  should happen next?"    │
                     └─────────────┬────────────┘
                                   │
                        requests / uses capabilities
                                   │
                                   ▼
          ╔════════════════════════════════════════════════════╗
          ║                CAPABILITY REGISTRY                ║
          ║                                                    ║
          ║ MARKET                                             ║
          ║  scan · inspect token · liquidity · flow · regime ║
          ║                                                    ║
          ║ PORTFOLIO                                          ║
          ║  positions · capital · exposure · comparison      ║
          ║                                                    ║
          ║ EXECUTION                                          ║
          ║  quote · order · verify · reconcile               ║
          ║                                                    ║
          ║ RISK                                               ║
          ║  exposure · slippage · drawdown · circuit         ║
          ║                                                    ║
          ║ MEMORY                                             ║
          ║  prior trades · similar situations · outcomes     ║
          ╚════════════════════════════════════════════════════╝
                                   │
                                   ▼
              ┌─────────────────────────────────────────┐
              │              SKILL LAYER                │
              │                                         │
              │ EVALUATE OPPORTUNITY                    │
              │   inspect → compare → quote → risk      │
              │                                         │
              │ ROTATE CAPITAL                          │
              │   compare → partial sell → quote        │
              │   → partial buy → reconcile             │
              │                                         │
              │ MARKET SCAN                             │
              │   discover → normalize → filter         │
              │   → score → rank → tradeability         │
              │                                         │
              │ PROTECT CAPITAL                         │
              │   monitor → detect → reduce exposure    │
              │   → preserve optionality                │
              └───────────────────┬─────────────────────┘
                                  │
                                  ▼
                      ┌────────────────────────┐
                      │   STRUCTURED DECISION  │
                      │                        │
                      │ BUY                    │
                      │ SELL                   │
                      │ PARTIAL BUY            │
                      │ PARTIAL SELL           │
                      │ ROTATE                 │
                      │ HOLD                   │
                      │ WAIT                   │
                      │ ESCALATE               │
                      └────────────┬───────────┘
                                   │
                                   ▼
                   ┌────────────────────────────┐
                   │      AUTONOMY POLICY        │
                   │                            │
                   │ Is this action permitted   │
                   │ in the current regime?     │
                   └─────────────┬──────────────┘
                                 │
                                 ▼
                   ┌────────────────────────────┐
                   │       INDEPENDENT RISK     │
                   │            GATE             │
                   │                            │
                   │ exposure                   │
                   │ slippage                   │
                   │ drawdown                   │
                   │ liquidity                  │
                   │ execution reliability      │
                   │ circuit breakers           │
                   └─────────────┬──────────────┘
                                 │
                        ┌────────┴─────────┐
                        │                  │
                      REJECT             PASS
                        │                  │
                        ▼                  ▼
                   ┌─────────┐    ┌──────────────────┐
                   │  WAIT / │    │    EXECUTION     │
                   │ ESCALATE│    │                  │
                   └────┬────┘    │ quote            │
                        │         │ submit           │
                        │         │ verify           │
                        │         │ reconcile        │
                        │         └────────┬─────────┘
                        │                  │
                        │                  ▼
                        │       ┌────────────────────┐
                        │       │   POSITION STATE   │
                        │       │                    │
                        │       │ updated portfolio  │
                        │       │ updated capital    │
                        │       │ updated risk       │
                        │       └─────────┬──────────┘
                        │                 │
                        └─────────────────┤
                                          ▼
                              ┌────────────────────────┐
                              │   MISSION STATE UPDATE │
                              │                        │
                              │ progress               │
                              │ regime                 │
                              │ confidence             │
                              │ outcome                │
                              └────────────┬───────────┘
                                           │
                                           │
                                           ▼
                                      OBSERVE AGAIN
                                           │
                                           └───────────────► LOOP
```

## Loop 2: Memory / Experience

```
                 EXPERIENCE / MEMORY
                         │
                         ▼
              ┌─────────────────────┐
              │ SESSION HISTORY     │
              │                     │
              │ observations        │
              │ tool calls          │
              │ decisions           │
              │ failures            │
              │ successful sequences│
              │ outcomes            │
              └──────────┬──────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ SKILL EXTRACTION │
                │                  │
                │ "When X happens, │
                │  this sequence   │
                │  worked."        │
                └─────────┬────────┘
                          │
                          ▼
                    SKILL LIBRARY
                          │
                          └──────► AI
```

## Loop 3: Capability Growth

```
           AI encounters a capability gap
                        │
                        ▼
              "Can existing tools
                solve this?"
                  /          \
                YES            NO
                 │              │
                 ▼              ▼
            compose skill   CAPABILITY REQUEST
                                │
                                ▼
                         engineering process
                                │
                         tests + simulation
                                │
                         human/system review
                                │
                                ▼
                         NEW CAPABILITY
                                │
                                ▼
                       CAPABILITY REGISTRY
```

### Hard Boundary

```
             AI
              │
              │ capability request
              ▼
       ┌───────────────────┐
       │ ENGINEERING LAYER │
       └─────────┬─────────┘
                 │
           tests / simulation
                 │
                 ▼
       ┌───────────────────┐
       │ PRODUCTION SYSTEM │
       └───────────────────┘

       NEVER:

       AI ───────X──────► production self-modification
```

## Latent UI Principle

The UI starts minimal. It reveals architecture nodes as the agent activates them.

**Idle state:**
```
                     ●

                 $12 → $10K

              AUTONOMOUS
                 WAITING
```

**After "scan market":**
```
MISSION
   │
   ├──── Binance
   ├──── DexScreener
   ├──── Market State
   │
   └──── Feature Engine
              │
           candidates
          ╱     │     ╲
        AFOB   DOGE    X
          ╲      │     ╱
           └── AI ───┘
               │
            decision
               │
             risk
               │
           execution
```

> The diagram is not the product's architecture diagram.
> It's a live projection of the architecture while the agent is actually using it.

---

## Module Map: What's Built vs What's Missing

### ✅ BUILT (core/ modules exist)

| Architecture Layer | Module | LOC | Status |
|---|---|---|---|
| **Autonomy Controller** | `core/autonomy/engine.js` | ~190 | ✅ 6 modes, policy gate, temperature |
| **Main Loop** | `core/autonomy/loop.js` | ~310 | ✅ runCycle() orchestration |
| **Observe Market** | `core/lib/dexscreener.js` | ~80 | ✅ DexScreener REST |
| **Observe Market** | `core/lib/binance.js` | ~60 | ✅ Binance API |
| **Observe Market** | `core/lib/baw.js` | ~120 | ✅ Binance Agentic Wallet CLI |
| **Feature Engine** | `core/market/features.js` | ~130 | ✅ 7 feature groups |
| **Opportunity Engine** | `core/discovery/opportunity.js` | ~140 | ✅ 6-phase pipeline |
| **Scoring** | `core/discovery/scoring.js` | ~200 | ✅ 8-factor scoring + insider detection |
| **AI Reasoning** | `core/intelligence/ai-provider.js` | ~530 | ✅ 15 providers, context builder |
| **Regime** | `core/intelligence/regime.js` | ~110 | ✅ 7 regimes, heat score |
| **Execution** | `core/execution/engine.js` | ~100 | ✅ Quote→Execute→Log |
| **Risk Gate** | `core/risk/engine.js` | ~130 | ✅ Validation + 5 circuit breakers |
| **Position Management** | `core/positions/engine.js` | ~150 | ✅ TP/SL/trailing/monitoring |
| **Database** | `core/lib/db.js` | ~100 | ✅ PostgreSQL (Neon/Render) |
| **HTTP Fetch** | `core/lib/fetch.js` | ~60 | ✅ Retry + timeout |

### ❌ MISSING (architecture layers not yet implemented)

| Architecture Layer | What's Needed | Priority |
|---|---|---|
| **Capability Registry** | `core/capabilities/registry.js` — formal registry of what the agent CAN do, with metadata, parameters, success rates | 🔴 CRITICAL |
| **Skill Layer** | `core/skills/executor.js` — named skill sequences (EVALUATE_OPPORTUNITY, ROTATE_CAPITAL, MARKET_SCAN, PROTECT_CAPITAL) that compose capabilities | 🔴 CRITICAL |
| **Memory / Experience** | `core/memory/store.js` — structured session memory with outcome tracking, pattern extraction, skill library | 🟡 HIGH |
| **Skill Extraction** | `core/memory/extractor.js` — "When X happens, this sequence worked" — turns history into reusable skills | 🟡 HIGH |
| **Capability Growth** | `core/capabilities/growth.js` — detects capability gaps, generates capability requests | 🟢 MEDIUM |
| **Market Normalization** | `core/market/normalizer.js` — raw → trusted market state (unify Binance/DexScreener/on-chain into common schema) | 🟡 HIGH |
| **Live Event Stream** | WebSocket/SSE endpoint for real-time board updates | 🟡 HIGH |
| **Board API** | `src/app/api/board/route.ts` — serves live cycle state for UI visualization | 🟡 HIGH |
| **AI Provider Switching** | Runtime provider swap from command bar / UI | 🟢 MEDIUM |

---

## The Loop (what runCycle actually does)

```
runCycle() {
  1. LOAD STATE        → db.getActiveMission(), getPositions(), getAutonomy()
  2. CHECK BREAKERS    → risk.checkCircuitBreakers()
  3. MONITOR POSITIONS → positions.monitorPositions()  [TP/SL/trailing]
  4. DISCOVER          → discovery.discover()           [6-phase pipeline]
  5. REGIME            → regime.detectRegime()          [heat score → regime]
  6. BUILD CONTEXT     → ai.buildContext()              [portfolio + regime + candidates]
  7. AI DECISION       → provider.decide(context)       [BUY/SELL/ROTATE/WAIT/...]
  8. VALIDATE          → ai.validateDecision()          [schema check]
  9. POLICY            → autonomy.applyPolicy()         [mode-based override]
  10. RISK GATE        → risk.validateDecision()        [independent validation]
  11. EXECUTE          → execution.execute()            [quote → swap → log]
  12. RECONCILE        → update positions, log event, mission state
}
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `missions` | Active mission (start, target, status) |
| `positions` | Open/closed positions with P&L |
| `trades` | Individual trade records |
| `orders` | Order history |
| `opportunities` | Discovered opportunities with scores |
| `ai_decisions` | AI reasoning log (action, confidence, provider) |
| `system_events` | Event log for UI stream |
| `market_regimes` | Regime history |
| `config` | Runtime config (provider, model, API keys) |
| `provider_registry` | AI provider definitions |
| `circuit_breakers` | Breaker state |
| `autonomy_state` | Current mode + overrides |
| `portfolio_snapshots` | Periodic portfolio state |
| `feature_cache` | Computed features cache |
| `memory_entries` | Experience/memory store (MISSING) |
| `skill_library` | Extracted skills (MISSING) |
