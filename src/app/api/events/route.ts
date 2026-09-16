import { NextResponse } from 'next/server';
const path = require('path');
const db = __non_webpack_require__(path.join(process.cwd(), 'core/lib/db'));

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
