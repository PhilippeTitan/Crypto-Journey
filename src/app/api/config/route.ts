import { NextRequest, NextResponse } from 'next/server';
const db = require('../../../../core/lib/db');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allConfig = await db.select('configuration');
    const safe: Record<string, string> = {};
    for (const row of allConfig) {
      if (row.key.includes('api_key') || row.key.includes('secret')) {
        safe[row.key] = row.value ? '••••••' + row.value.slice(-4) : '';
      } else {
        safe[row.key] = row.value;
      }
    }
    return NextResponse.json(safe);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated: string[] = [];

    for (const [key, value] of Object.entries(body) as [string, string][]) {
      if (key.includes('api_key') || key.includes('secret')) {
        if (value && !value.startsWith('•••')) {
          await db.setConfig(key, value);
          updated.push(key);
        }
      } else {
        await db.setConfig(key, String(value));
        updated.push(key);
      }
    }

    // Clear AI config cache so changes take effect immediately
    const { clearConfigCache } = require('../../../../core/intelligence/ai-provider');
    clearConfigCache();

    return NextResponse.json({ ok: true, updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
