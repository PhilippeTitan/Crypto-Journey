/**
 * MaurEdge — Cron Cycle Endpoint
 * Single-cycle trading engine triggered by external cron (cronjobs.com)
 * 
 * GET /api/cron/cycle?secret=xxx
 *   Runs one full trading cycle: scan → score → decide → execute
 *   Returns cycle result JSON.
 * 
 * Security: CRON_SECRET env var must match query param.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Lazy-load core modules (CommonJS)
let loopModule: any = null;
let dbModule: any = null;
let aiProviderModule: any = null;

function getLoop() {
  if (!loopModule) {
    try { loopModule = require('../../../../../core/autonomy/loop'); } catch (e) { console.error('[Cron] loop load failed:', e); }
  }
  return loopModule;
}

function getDb() {
  if (!dbModule) {
    try { dbModule = require('../../../../../core/lib/db'); } catch (e) { console.error('[Cron] db load failed:', e); }
  }
  return dbModule;
}

function getAI() {
  if (!aiProviderModule) {
    try { aiProviderModule = require('../../../../../core/intelligence/ai-provider'); } catch (e) { console.error('[Cron] ai-provider load failed:', e); }
  }
  return aiProviderModule;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // ─── SECURITY CHECK ─────────────────────────────────
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    // ─── LOAD MODULES ──────────────────────────────────
    const loop = getLoop();
    const db = getDb();
    const ai = getAI();

    if (!loop || !db) {
      return NextResponse.json({ error: 'Core modules failed to load' }, { status: 500 });
    }

    // ─── LOAD AI PROVIDER CONFIG ───────────────────────
    let provider = null;
    if (ai) {
      try {
        const config = await ai.loadAIConfig(db?.getPool?.());
        if (config && config.apiKey) {
          provider = ai.createProvider(config.provider, config);
        }
      } catch (err: any) {
        console.error('[Cron] AI provider load failed:', err?.message);
      }
    }

    // ─── RUN SINGLE CYCLE ──────────────────────────────
    console.log(`[Cron] Cycle triggered at ${new Date().toISOString()}`);
    const result = await loop.runCycle(provider);
    const duration = Date.now() - startTime;

    // ─── LOG CYCLE COMPLETION ──────────────────────────
    if (db?.logEvent) {
      await db.logEvent(
        'CRON_CYCLE_COMPLETE',
        `Cycle ${result?.cycleId?.slice(0, 8) || 'unknown'} completed in ${duration}ms`,
        { result, duration },
        result?.status === 'circuit_breaker' ? 'warning' : 'info',
        result?.cycleId
      ).catch(() => {});
    }

    console.log(`[Cron] Cycle complete in ${duration}ms — status: ${result?.status || 'ok'}`);

    return NextResponse.json({
      success: true,
      cycleId: result?.cycleId,
      status: result?.status || 'ok',
      duration,
      timestamp: new Date().toISOString(),
      boardState: loop.getBoardState?.() || null,
    });

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[Cron] Cycle failed in ${duration}ms:`, err?.message || err);

    return NextResponse.json({
      success: false,
      error: err?.message || 'Cycle failed',
      duration,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// POST also works (some cron services send POST)
export async function POST(request: Request) {
  return GET(request);
}
