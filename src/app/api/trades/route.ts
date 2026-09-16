import { NextResponse } from 'next/server';
const db = require('../../../../core/lib/db');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const trades = await db.select('trades', {}, 'created_at DESC', 50);
    return NextResponse.json(trades);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
