import { NextResponse } from 'next/server';
const db = require('../../../../core/lib/db');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const opps = await db.select('opportunities', {}, 'created_at DESC', 20);
    return NextResponse.json(opps);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
