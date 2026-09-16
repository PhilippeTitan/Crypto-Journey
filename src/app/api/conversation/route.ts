/**
 * MaurEdge 3.0 — Conversation API (LIVE)
 * 
 * Real conversational AI interface for planning and strategy discussion.
 * Maintains multi-turn conversation history per session.
 * Routes through the real AI provider abstraction.
 * 
 * POST /api/conversation
 *   Body: { message: string, sessionId?: string }
 *   Returns: { success, response, sessionId, planSuggestion? }
 * 
 * GET /api/conversation?sessionId=xxx
 *   Returns: { success, history, sessionId }
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── IN-MEMORY CONVERSATION STORE ─────────────────────────
// Per-session conversation history. Lost on server restart.
// Future: persist to DB for continuity.

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  createdAt: string;
  lastActiveAt: string;
  planState: PlanState | null;
}

interface PlanState {
  version: number;
  status: 'DRAFT' | 'READY' | 'ARMED' | 'SUPERSEDED';
  mission: {
    startCapital: number;
    targetCapital: number;
    deadline?: string;
    objective: string;
  };
  strategy: string;
  marketScope: string;
  riskParameters: {
    maxPositionPct: number;
    maxSlippagePct: number;
    maxDailyLossPct: number;
    circuitBreakerThreshold: number;
  };
  entryConditions: string[];
  exitConditions: string[];
  waitConditions: string[];
  escalationConditions: string[];
  behaviorByRegime: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const sessions = new Map<string, ConversationSession>();

function getOrCreateSession(sessionId?: string): ConversationSession {
  const id = sessionId || crypto.randomUUID();
  if (sessions.has(id)) {
    const s = sessions.get(id)!;
    s.lastActiveAt = new Date().toISOString();
    return s;
  }
  const session: ConversationSession = {
    id,
    messages: [],
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    planState: null,
  };
  sessions.set(id, session);
  return session;
}

// ─── AI PROVIDER MODULE (lazy load) ────────────────────────
let aiProviderModule: any = null;
let dbModule: any = null;

function getAI() {
  if (!aiProviderModule) {
    try { aiProviderModule = require('../../../../core/intelligence/ai-provider'); } catch { return null; }
  }
  return aiProviderModule;
}

function getDb() {
  if (!dbModule) {
    try { dbModule = require('../../../../core/lib/db'); } catch { return null; }
  }
  return dbModule;
}

// ─── PLANNING SYSTEM PROMPT ────────────────────────────────
const PLANNING_SYSTEM_PROMPT = `You are MaurEdge's AI planning partner — an autonomous crypto trading system on BSC.

Your role is NOT to execute trades directly. Your role is to:
1. DISCUSS strategy with the operator
2. DRAFT trading plans collaboratively
3. REVISE plans based on operator feedback
4. Present a FINALIZED plan for operator approval

IMPORTANT RULES:
- You do NOT execute trades. Only the operator can ARM a plan.
- You CAN analyze market conditions, discuss risk, compare strategies.
- You CAN produce structured plan updates (JSON) when the conversation reaches a planning milestone.
- You MUST WAIT for explicit operator approval before any plan becomes active.
- You MUST ESCALATE when conditions exceed your authority.

When producing a plan update, include a JSON block like:
\`\`\`plan
{
  "mission": { "startCapital": 12, "targetCapital": 10000, "objective": "Compound aggressively" },
  "strategy": "Momentum + liquidity rotation",
  "marketScope": "BSC Alpha / DEX",
  "riskParameters": { "maxPositionPct": 60, "maxSlippagePct": 3, "maxDailyLossPct": 15, "circuitBreakerThreshold": 5 },
  "entryConditions": ["Volume acceleration > 2x", "Buy pressure > 60%"],
  "exitConditions": ["Momentum reversal > 5%", "Stop loss triggered"],
  "waitConditions": ["Market regime UNSTABLE", "Liquidity < $5k"],
  "escalationConditions": ["Drawdown > 30%", "Consecutive losses > 5"],
  "behaviorByRegime": { "HOT": "Aggressive rotation", "COOL": "Conservative holding", "DEFENSIVE": "No new positions" }
}
\`\`\`

Be direct, strategic, and specific. Think like a quantitative portfolio manager, not a chatbot.`;

// ─── API HANDLERS ──────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required' }, { status: 400 });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ success: true, history: [], sessionId, planState: null });
    }

    return NextResponse.json({
      success: true,
      history: session.messages,
      sessionId: session.id,
      planState: session.planState,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, sessionId: requestedSessionId } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message required' }, { status: 400 });
    }

    // Get or create session
    const session = getOrCreateSession(requestedSessionId || undefined);

    // Add user message to history
    session.messages.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    });

    // Get AI provider
    const ai = getAI();
    const db = getDb();

    if (!ai) {
      const fallback = "I'm not connected to an AI provider yet. Please configure a provider in the settings.";
      session.messages.push({ role: 'assistant', content: fallback, timestamp: new Date().toISOString() });
      return NextResponse.json({
        success: true,
        response: fallback,
        sessionId: session.id,
        provider: null,
        model: null,
      });
    }

    // Load provider config
    let providerConfig: any = null;
    try {
      providerConfig = await ai.loadAIConfig(db?.getPool?.());
    } catch {
      // Fallback to env
      providerConfig = {
        provider: process.env.AI_PROVIDER || 'gemini',
        apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || '',
        model: process.env.AI_MODEL || 'gemini-2.5-flash',
      };
    }

    // Build context with conversation history
    const contextMessages = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Add current plan state to context if exists
    let planContext = '';
    if (session.planState) {
      planContext = `\n\nCURRENT PLAN STATE (v${session.planState.version}, status: ${session.planState.status}):\n${JSON.stringify(session.planState, null, 2)}`;
    }

    // Get board state for context
    let boardContext = '';
    try {
      const loop = require('../../../../core/autonomy/loop');
      const boardState = loop.getBoardState();
      if (boardState?.running !== undefined) {
        boardContext = `\n\nCURRENT BOARD STATE:\n- Running: ${boardState.running}\n- Cycle: ${boardState.cycleCount}\n- Current step: ${boardState.currentStep || 'idle'}`;
      }
    } catch {}

    // Build the full prompt
    const systemPrompt = PLANNING_SYSTEM_PROMPT + planContext + boardContext;

    // Call AI directly via HTTP (not through decide() which tries to parse JSON decisions)
    let aiResponse: string;
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
      ];

      // Build request based on provider
      const providerKey = providerConfig.provider?.toLowerCase() || 'openai';
      const apiKey = providerConfig.apiKey || '';
      const model = providerConfig.model || 'gpt-4o';

      let url = '';
      let headers: Record<string, string> = {};
      let requestBody: any = {};

      // Look up provider hostnames from registry
      const PROVIDER_HOSTS: Record<string, string> = {
        openai: 'https://api.openai.com',
        anthropic: 'https://api.anthropic.com',
        gemini: 'https://generativelanguage.googleapis.com',
        mistral: 'https://api.mistral.ai',
        groq: 'https://api.groq.com',
        deepseek: 'https://api.deepseek.com',
        openrouter: 'https://openrouter.ai',
        together: 'https://api.together.xyz',
        fireworks: 'https://api.fireworks.ai',
        xai: 'https://api.x.ai',
        perplexity: 'https://api.perplexity.ai',
        cohere: 'https://api.cohere.com',
      };

      const PROVIDER_PATHS: Record<string, string> = {
        groq: '/openai/v1/chat/completions',
        openrouter: '/api/v1/chat/completions',
        fireworks: '/inference/v1/chat/completions',
        perplexity: '/chat/completions',
        cohere: '/v2/chat',
        together: '/v1/chat/completions',
      };

      const hostBase = PROVIDER_HOSTS[providerKey] || 'https://api.openai.com';
      const path = PROVIDER_PATHS[providerKey] || '/v1/chat/completions';

      if (providerKey === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
        const systemInstruction = messages.find((m: any) => m.role === 'system');
        requestBody = {
          contents,
          ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } } : {}),
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
        };
      } else if (providerKey === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages';
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        };
        const systemMsg = messages.find((m: any) => m.role === 'system');
        const nonSystem = messages.filter((m: any) => m.role !== 'system');
        requestBody = {
          model,
          max_tokens: 2048,
          system: systemMsg?.content || '',
          messages: nonSystem,
        };
      } else if (providerKey === 'cohere') {
        url = `${hostBase}${path}`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        const systemMsg = messages.find((m: any) => m.role === 'system');
        requestBody = {
          model,
          message: messages.filter((m: any) => m.role !== 'system').pop()?.content || '',
          chat_history: messages.filter((m: any) => m.role !== 'system').slice(0, -1).map((m: any) => ({
            role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
            message: m.content,
          })),
          preamble: systemMsg?.content || '',
        };
      } else {
        // OpenAI-compatible: use correct provider hostname
        url = `${hostBase}${path}`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        requestBody = {
          model,
          messages,
          max_tokens: 2048,
          temperature: 0.7,
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data?.error?.message || data?.message || `HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      // Extract text from response based on provider
      if (providerKey === 'gemini') {
        aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';
      } else if (providerKey === 'anthropic') {
        aiResponse = data?.content?.[0]?.text || 'No response from Anthropic';
      } else if (providerKey === 'cohere') {
        aiResponse = data?.text || data?.message?.content || 'No response from Cohere';
      } else {
        // OpenAI-compatible
        aiResponse = data?.choices?.[0]?.message?.content || 'No response';
      }
    } catch (err: any) {
      console.error('[Conversation] AI call failed:', err?.message || err);
      aiResponse = `AI provider error: ${err?.message || 'Unknown error'}. Please check your provider configuration.`;
    }

    // Check for plan suggestion in AI response
    let planSuggestion: PlanState | null = null;
    const planMatch = aiResponse.match(/```plan\s*\n([\s\S]*?)\n```/);
    if (planMatch) {
      try {
        const parsed = JSON.parse(planMatch[1]);
        planSuggestion = {
          version: (session.planState?.version || 0) + 1,
          status: 'DRAFT',
          mission: parsed.mission || { startCapital: 0, targetCapital: 0, objective: '' },
          strategy: parsed.strategy || '',
          marketScope: parsed.marketScope || '',
          riskParameters: parsed.riskParameters || { maxPositionPct: 60, maxSlippagePct: 3, maxDailyLossPct: 15, circuitBreakerThreshold: 5 },
          entryConditions: parsed.entryConditions || [],
          exitConditions: parsed.exitConditions || [],
          waitConditions: parsed.waitConditions || [],
          escalationConditions: parsed.escalationConditions || [],
          behaviorByRegime: parsed.behaviorByRegime || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        session.planState = planSuggestion;
      } catch {
        // Plan JSON was malformed, ignore
      }
    }

    // Add assistant response to history
    session.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    });

    // Cap history at 50 messages to prevent context overflow
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      sessionId: session.id,
      planSuggestion,
      provider: providerConfig.provider,
      model: providerConfig.model,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
