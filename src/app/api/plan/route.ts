/**
 * MaurEdge 3.0 — Plan & Authorization API
 * 
 * Manages trading plan lifecycle and operator authorization.
 * 
 * Plan states: DRAFT → READY → ARMED → SUPERSEDED
 * Authorization: Only ARMED plans can enter autonomous execution.
 * 
 * POST /api/plan
 *   Actions:
 *     create   - Create a new plan from conversation
 *     update   - Update an existing draft plan
 *     ready    - Mark plan as ready for review
 *     arm      - Operator explicitly arms the plan (starts autonomous execution)
 *     revoke   - Operator revokes an armed plan (stops execution)
 *     supersede - Replace current armed plan with a new version
 * 
 * GET /api/plan
 *   Returns current plan state and authorization status
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── PLAN STATE ────────────────────────────────────────────
interface Plan {
  id: string;
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
  allocationRules: string;
  rotationRules: string;
  riskParameters: {
    maxPositionPct: number;
    maxSlippagePct: number;
    maxDailyLossPct: number;
    maxConsecutiveLosses: number;
    circuitBreakerThreshold: number;
    minLiquidityUsd: number;
    gasReserveUsdt: number;
  };
  entryConditions: string[];
  exitConditions: string[];
  waitConditions: string[];
  escalationConditions: string[];
  behaviorByRegime: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface Authorization {
  armed: boolean;
  armedAt: string | null;
  armedBy: string | null;
  planId: string | null;
  planVersion: number | null;
  autonomyMode: string;
  expiresAt: string | null;
}

// ─── IN-MEMORY STORE ──────────────────────────────────────
let currentPlan: Plan | null = null;
let authorization: Authorization = {
  armed: false,
  armedAt: null,
  armedBy: null,
  planId: null,
  planVersion: null,
  autonomyMode: 'normal',
  expiresAt: null,
};
let planHistory: Plan[] = [];

// ─── LAZY MODULES ─────────────────────────────────────────
let dbModule: any = null;
function getDb() {
  if (!dbModule) {
    try { dbModule = require('../../../core/lib/db'); } catch { return null; }
  }
  return dbModule;
}

// ─── API HANDLERS ──────────────────────────────────────────

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      plan: currentPlan,
      authorization,
      historyCount: planHistory.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, plan: planData } = body;
    const db = getDb();

    switch (action) {
      case 'create': {
        if (!planData) {
          return NextResponse.json({ success: false, error: 'Plan data required' }, { status: 400 });
        }

        const newPlan: Plan = {
          id: crypto.randomUUID(),
          version: (currentPlan?.version || 0) + 1,
          status: 'DRAFT',
          mission: planData.mission || { startCapital: 0, targetCapital: 0, objective: '' },
          strategy: planData.strategy || '',
          marketScope: planData.marketScope || 'BSC Alpha / DEX',
          allocationRules: planData.allocationRules || '',
          rotationRules: planData.rotationRules || '',
          riskParameters: {
            maxPositionPct: planData.riskParameters?.maxPositionPct || 60,
            maxSlippagePct: planData.riskParameters?.maxSlippagePct || 3,
            maxDailyLossPct: planData.riskParameters?.maxDailyLossPct || 15,
            maxConsecutiveLosses: planData.riskParameters?.maxConsecutiveLosses || 5,
            circuitBreakerThreshold: planData.riskParameters?.circuitBreakerThreshold || 5,
            minLiquidityUsd: planData.riskParameters?.minLiquidityUsd || 5000,
            gasReserveUsdt: planData.riskParameters?.gasReserveUsdt || 0.5,
          },
          entryConditions: planData.entryConditions || [],
          exitConditions: planData.exitConditions || [],
          waitConditions: planData.waitConditions || [],
          escalationConditions: planData.escalationConditions || [],
          behaviorByRegime: planData.behaviorByRegime || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // If there's an existing armed plan, supersede it
        if (currentPlan?.status === 'ARMED') {
          currentPlan.status = 'SUPERSEDED';
          planHistory.push({ ...currentPlan });
          authorization.armed = false;
          authorization.armedAt = null;
          authorization.planId = null;
          authorization.planVersion = null;
        }

        currentPlan = newPlan;
        return NextResponse.json({ success: true, plan: newPlan, authorization });
      }

      case 'update': {
        if (!currentPlan) {
          return NextResponse.json({ success: false, error: 'No active plan to update' }, { status: 400 });
        }
        if (currentPlan.status === 'ARMED') {
          return NextResponse.json({ success: false, error: 'Cannot update an armed plan. Revoke first.' }, { status: 400 });
        }

        // Merge updates
        const updated = { ...currentPlan, ...planData, updatedAt: new Date().toISOString() };
        if (planData.riskParameters) {
          updated.riskParameters = { ...currentPlan.riskParameters, ...planData.riskParameters };
        }
        currentPlan = updated;
        return NextResponse.json({ success: true, plan: currentPlan, authorization });
      }

      case 'ready': {
        if (!currentPlan) {
          return NextResponse.json({ success: false, error: 'No plan to mark ready' }, { status: 400 });
        }
        if (currentPlan.status !== 'DRAFT') {
          return NextResponse.json({ success: false, error: `Plan is ${currentPlan.status}, not DRAFT` }, { status: 400 });
        }
        currentPlan.status = 'READY';
        currentPlan.updatedAt = new Date().toISOString();
        return NextResponse.json({ success: true, plan: currentPlan, authorization });
      }

      case 'arm': {
        if (!currentPlan) {
          return NextResponse.json({ success: false, error: 'No plan to arm' }, { status: 400 });
        }
        if (currentPlan.status !== 'READY' && currentPlan.status !== 'DRAFT') {
          return NextResponse.json({ success: false, error: `Plan is ${currentPlan.status}, must be READY or DRAFT to arm` }, { status: 400 });
        }

        // ARM the plan — this authorizes autonomous execution
        currentPlan.status = 'ARMED';
        currentPlan.updatedAt = new Date().toISOString();

        authorization = {
          armed: true,
          armedAt: new Date().toISOString(),
          armedBy: 'operator',
          planId: currentPlan.id,
          planVersion: currentPlan.version,
          autonomyMode: body.autonomyMode || 'normal',
          expiresAt: body.expiresAt || null,
        };

        // Persist to DB if available
        if (db) {
          try {
            // Update mission with plan details
            await db.query(
              "UPDATE missions SET target_capital = $1, updated_at = NOW() WHERE status = 'active'",
              [currentPlan.mission.targetCapital]
            );
            // Set autonomy mode
            await db.updateAutonomyState({ mode: authorization.autonomyMode }).catch(() => {});
          } catch {}
        }

        return NextResponse.json({
          success: true,
          plan: currentPlan,
          authorization,
          message: `Plan v${currentPlan.version} ARMED. Autonomous execution authorized.`,
        });
      }

      case 'revoke': {
        if (!currentPlan) {
          return NextResponse.json({ success: false, error: 'No plan to revoke' }, { status: 400 });
        }
        if (!authorization.armed) {
          return NextResponse.json({ success: false, error: 'Plan is not armed' }, { status: 400 });
        }

        currentPlan.status = 'SUPERSEDED';
        currentPlan.updatedAt = new Date().toISOString();
        planHistory.push({ ...currentPlan });

        authorization = {
          armed: false,
          armedAt: null,
          armedBy: null,
          planId: null,
          planVersion: null,
          autonomyMode: 'normal',
          expiresAt: null,
        };

        return NextResponse.json({
          success: true,
          plan: currentPlan,
          authorization,
          message: `Plan v${currentPlan.version} REVOKED. Autonomous execution halted.`,
        });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
