/**
 * MaurEdge 3.0 — Capabilities API
 * 
 * Serves the capability registry snapshot to the Living Decision Board UI.
 * Shows what the agent CAN do, with runtime usage stats.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Import capabilities (CommonJS in Next.js API route)
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const capabilities: any = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__(path.join(process.cwd(), 'core/capabilities/registry'))
  : require(path.join(process.cwd(), 'core/capabilities/registry'));


/**
 * GET /api/capabilities — returns full registry snapshot
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    if (category) {
      const caps = capabilities.getCapabilities(category);
      return NextResponse.json({
        success: true,
        category,
        capabilities: caps,
        timestamp: new Date().toISOString(),
      });
    }

    const snapshot = capabilities.getRegistrySnapshot();

    return NextResponse.json({
      success: true,
      ...snapshot,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }

}
