import { NextResponse } from 'next/server';
const db = require('../../../../core/lib/db');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await db.select('system_events', {}, 'created_at DESC', 50);
    return NextResponse.json(events);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
