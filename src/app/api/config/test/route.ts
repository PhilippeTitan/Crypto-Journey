import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = require('path');
    const { createProvider } = __non_webpack_require__(path.join(process.cwd(), 'core/intelligence/ai-provider'));

    const provider = createProvider(body.provider || 'openai', {
      apiKey: body.apiKey,
      model: body.model,
      endpoint: body.endpoint,
    });

    const result = await provider.decide(
      {
        mission: { name: 'test' },
        portfolio: { total_value: 10 },
        open_positions: [],
        market_regime: { regime: 'QUIET' },
        top_opportunities: [],
      },
      'Respond with exactly: {"action": "WAIT", "confidence": 0.5, "reason": "Connection test successful"}'
    );

    if (result && result.decision) {
      return NextResponse.json({
        ok: true,
        message: 'AI provider connected successfully',
        model: body.model,
        response: result.decision,
      });
    }

    return NextResponse.json(
      { ok: false, message: 'AI provider returned no valid response' },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Test failed' },
      { status: 400 }
    );
  }
}
