import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PROVIDERS } = require('../../../../core/intelligence/ai-provider') as { PROVIDERS: Record<string, any> };
    const list = Object.entries(PROVIDERS).map(([key, reg]) => ({
      key,
      name: reg.name as string,
      models: reg.models as string[],
      defaultModel: reg.defaultModel as string,
      keyPlaceholder: reg.keyPlaceholder as string,
      keyEnv: reg.keyEnv as string,
      noKeyRequired: (reg.noKeyRequired as boolean) || false,
      needsEndpoint: (reg.needsEndpoint as boolean) || false,
    }));
    return NextResponse.json(list);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load providers' },
      { status: 500 }
    );
  }
}
