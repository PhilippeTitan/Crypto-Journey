/**
 * MaurEdge — Provider Configuration API
 * 
 * GET    /api/config/providers
 *   Returns all providers with key-configured status and discovered models.
 * 
 * POST   /api/config/providers
 *   Body: { provider, apiKey, selectedModel?, customEndpoint?, isActive? }
 *   Saves/updates provider config in DB. Never returns the actual API key.
 * 
 * DELETE /api/config/providers?provider=xxx
 *   Removes provider config from DB.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let dbModule: any = null;
let aiProviderModule: any = null;

function getDb() {
  if (!dbModule) {
    try { dbModule = require('../../../../../core/lib/db'); } catch { return null; }
  }
  return dbModule;
}

function getAI() {
  if (!aiProviderModule) {
    try { aiProviderModule = require('../../../../../core/intelligence/ai-provider'); } catch { return null; }
  }
  return aiProviderModule;
}

// GET — list all providers with config status
export async function GET() {
  try {
    const ai = getAI();
    const db = getDb();

    if (!ai) {
      return NextResponse.json({ error: 'AI provider module not loaded' }, { status: 500 });
    }

    const registry = ai.PROVIDERS || {};

    // Get saved configs from DB
    let savedConfigs: Record<string, any> = {};
    if (db?.getPool?.()) {
      try {
        const result = await db.query('SELECT * FROM provider_config');
        for (const row of (result?.rows || [])) {
          savedConfigs[row.provider_key] = {
            hasApiKey: !!row.api_key,
            selectedModel: row.selected_model,
            customEndpoint: row.custom_endpoint,
            isActive: row.is_active,
            discoveredModels: row.discovered_models || [],
            lastDiscoveredAt: row.last_discovered_at,
          };
        }
      } catch { /* Table may not exist yet */ }
    }

    const list = Object.entries(registry).map(([key, reg]: [string, any]) => {
      const saved = savedConfigs[key] || {};
      const envKey = reg.keyEnv;
      const hasEnvKey = envKey ? !!process.env[envKey] : false;

      return {
        key,
        name: reg.name,
        models: reg.models,
        defaultModel: reg.defaultModel,
        keyPlaceholder: reg.keyPlaceholder,
        keyEnv: reg.keyEnv,
        noKeyRequired: reg.noKeyRequired || false,
        needsEndpoint: reg.needsEndpoint || false,
        format: reg.format,
        hasApiKey: saved.hasApiKey || hasEnvKey,
        selectedModel: saved.selectedModel || reg.defaultModel,
        customEndpoint: saved.customEndpoint || '',
        isActive: saved.isActive || false,
        discoveredModels: saved.discoveredModels || reg.models,
      };
    });

    return NextResponse.json(list);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load providers' },
      { status: 500 }
    );
  }
}

// POST — save/update provider config
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, apiKey, selectedModel, customEndpoint, isActive } = body;

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ error: 'provider required' }, { status: 400 });
    }

    const db = getDb();
    if (!db?.getPool?.()) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const providerKey = provider.toLowerCase();

    // Upsert logic
    const existing = await db.query(
      'SELECT id FROM provider_config WHERE provider_key = $1',
      [providerKey]
    );

    if (existing?.rows?.length > 0) {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramIdx = 1;

      if (apiKey !== undefined) {
        updates.push(`api_key = $${paramIdx++}`);
        values.push(apiKey);
      }
      if (selectedModel !== undefined) {
        updates.push(`selected_model = $${paramIdx++}`);
        values.push(selectedModel);
      }
      if (customEndpoint !== undefined) {
        updates.push(`custom_endpoint = $${paramIdx++}`);
        values.push(customEndpoint);
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIdx++}`);
        values.push(isActive);
        if (isActive) {
          await db.query('UPDATE provider_config SET is_active = false WHERE provider_key != $1', [providerKey]);
        }
      }

      values.push(providerKey);
      await db.query(
        `UPDATE provider_config SET ${updates.join(', ')} WHERE provider_key = $${paramIdx}`,
        values
      );
    } else {
      if (isActive) {
        await db.query('UPDATE provider_config SET is_active = false');
      }
      await db.query(
        `INSERT INTO provider_config (provider_key, api_key, selected_model, custom_endpoint, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [providerKey, apiKey || null, selectedModel || null, customEndpoint || null, isActive || false]
      );
    }

    return NextResponse.json({
      success: true,
      provider: providerKey,
      message: `Provider ${providerKey} configuration saved`,
    });

  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Failed to save provider config',
    }, { status: 500 });
  }
}

// DELETE — remove provider config
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'provider param required' }, { status: 400 });
    }

    const db = getDb();
    if (!db?.getPool?.()) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    await db.query('DELETE FROM provider_config WHERE provider_key = $1', [provider.toLowerCase()]);

    return NextResponse.json({
      success: true,
      provider: provider.toLowerCase(),
      message: `Provider ${provider} configuration removed`,
    });

  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Failed to delete provider config',
    }, { status: 500 });
  }
}
