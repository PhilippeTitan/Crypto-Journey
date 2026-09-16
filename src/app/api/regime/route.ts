import { NextResponse } from 'next/server';
const path = require('path');
const db = __non_webpack_require__(path.join(process.cwd(), 'core/lib/db'));

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const regimes = await db.select('market_regimes', {}, 'created_at DESC', 10);
    return NextResponse.json(regimes);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
