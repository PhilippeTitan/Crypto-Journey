/**
 * MaurEdge 3.0 — Board API
 * 
 * Serves the live cycle state for the Living Decision Board UI.
 * Returns the current state of every node in the runCycle() pipeline.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── CYCLE STATE (in-memory, updates each runCycle) ────────

let cycleState = {
  running: false,
  currentStep: null,
  lastCompleted: null,
  lastCycleAt: null,
  cycleCount: 0,
  nodes: {
    mission:   { status: 'idle', lastActive: null, data: null },
    state:     { status: 'idle', lastActive: null, data: null },
    breakers:  { status: 'idle', lastActive: null, data: null },
    positions: { status: 'idle', lastActive: null, data: null },
    discover:  { status: 'idle', lastActive: null, data: null },
    features:  { status: 'idle', lastActive: null, data: null },
    regime:    { status: 'idle', lastActive: null, data: null },
    context:   { status: 'idle', lastActive: null, data: null },
    ai:        { status: 'idle', lastActive: null, data: null },
    validate:  { status: 'idle', lastActive: null, data: null },
    risk:      { status: 'idle', lastActive: null, data: null },
    exec:      { status: 'idle', lastActive: null, data: null },
    outcome:   { status: 'idle', lastActive: null, data: null },
  },
  eventStream: [],
};

/**
 * Update a specific node's state (called by the backend cycle engine)
 */
function updateNode(nodeId, status, data = null) {
  cycleState.nodes[nodeId] = {
    status,
    lastActive: new Date().toISOString(),
    data,
  };
  cycleState.currentStep = nodeId;
  cycleState.eventStream.push({
    timestamp: new Date().toISOString(),
    node: nodeId,
    status,
    data,
  });

  // Keep last 100 events
  if (cycleState.eventStream.length > 100) {
    cycleState.eventStream = cycleState.eventStream.slice(-100);
  }
}

function startCycle() {
  cycleState.running = true;
  cycleState.cycleCount++;
  // Reset all nodes to idle
  for (const key of Object.keys(cycleState.nodes)) {
    cycleState.nodes[key].status = 'idle';
  }
}

function completeCycle() {
  cycleState.running = false;
  cycleState.currentStep = null;
  cycleState.lastCompleted = new Date().toISOString();
  cycleState.lastCycleAt = new Date().toISOString();
}

// ─── API ROUTE ─────────────────────────────────────────────

/**
 * GET /api/board — returns current board state
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'full';

    if (mode === 'events') {
      // Return just the event stream (for polling)
      return NextResponse.json({
        success: true,
        events: cycleState.eventStream,
        running: cycleState.running,
        currentStep: cycleState.currentStep,
      });
    }

    if (mode === 'nodes') {
      // Return just node states
      return NextResponse.json({
        success: true,
        nodes: cycleState.nodes,
        running: cycleState.running,
        cycleCount: cycleState.cycleCount,
      });
    }

    // Full board state
    return NextResponse.json({
      success: true,
      state: cycleState,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * POST /api/board — update board state (internal use)
 * Body: { action: 'start'|'complete'|'updateNode', nodeId?, status?, data? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, nodeId, status, data } = body;

    switch (action) {
      case 'start':
        startCycle();
        break;

      case 'complete':
        completeCycle();
        break;

      case 'updateNode':
        if (!nodeId || !status) {
          return NextResponse.json({
            success: false,
            error: 'nodeId and status required',
          }, { status: 400 });
        }
        updateNode(nodeId, status, data);
        break;

      case 'reset':
        cycleState = {
          running: false,
          currentStep: null,
          lastCompleted: null,
          lastCycleAt: cycleState.lastCycleAt,
          cycleCount: cycleState.cycleCount,
          nodes: Object.fromEntries(
            Object.keys(cycleState.nodes).map(k => [
              k, { status: 'idle', lastActive: null, data: null }
            ])
          ),
          eventStream: [],
        };
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      state: cycleState,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
