import { NextResponse } from 'next/server';
const db = require('../../../../core/lib/db');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mission = await db.getActiveMission();
    const positions = await db.getOpenPositions();
    const autonomy = await db.getAutonomyState();
    const recentEvents = await db.select('system_events', {}, 'created_at DESC', 10);
    const health = await db.query('SELECT * FROM system_health');
    return NextResponse.json({
      mission,
      positions,
      autonomy,
      recentEvents,
      health: health.rows?.[0] ?? null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
