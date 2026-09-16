import { NextResponse } from 'next/server';
const db = require('../../../../core/lib/db');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const positions = await db.getOpenPositions();
    return NextResponse.json(positions);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
