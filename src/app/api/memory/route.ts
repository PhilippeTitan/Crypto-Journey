/**
 * MaurEdge 3.0 — Memory API
 * 
 * Serves memory/experience data to the UI.
 * Shows the agent's learning history, patterns, and timeline.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const memory = require('@/../../core/memory/store');

/**
 * GET /api/memory — returns memory data
 * Query params:
 *   ?action=stats    — overall memory stats
 *   ?action=recent   — recent entries
 *   ?action=patterns — learned patterns
 *   ?action=timeline — timeline data
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats':
        return NextResponse.json({
          success: true,
          stats: memory.getMemoryStats(),
        });

      case 'recent': {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        return NextResponse.json({
          success: true,
          entries: memory.getRecentEntries(limit),
        });
      }

      case 'patterns': {
        const filter = {};
        if (url.searchParams.get('regime')) filter.regime = url.searchParams.get('regime');
        if (url.searchParams.get('action')) filter.action = url.searchParams.get('action');
        if (url.searchParams.get('min_samples')) filter.min_samples = parseInt(url.searchParams.get('min_samples'));
        return NextResponse.json({
          success: true,
          patterns: memory.getPatterns(filter),
        });
      }

      case 'timeline': {
        const hours = parseInt(url.searchParams.get('hours') || '24');
        return NextResponse.json({
          success: true,
          timeline: memory.getTimeline(hours),
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * POST /api/memory — record a new memory entry
 * Body: { type, token, action, confidence, reason, regime, portfolioState }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = memory.recordOutcome(body);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
