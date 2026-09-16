import { NextResponse } from 'next/server';
const path = require('path');
const db = __non_webpack_require__(path.join(process.cwd(), 'core/lib/db'));

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const decisions = await db.select('ai_decisions', {}, 'created_at DESC', 20);
    return NextResponse.json(decisions);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
