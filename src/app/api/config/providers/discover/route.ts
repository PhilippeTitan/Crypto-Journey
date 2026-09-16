/**
 * MaurEdge — Model Discovery API
 * 
 * Discovers available models for an AI provider by calling their models list endpoint.
 * 
 * POST /api/config/providers/discover
 *   Body: { provider: string, apiKey: string, endpoint?: string }
 *   Returns: { success, models: string[], provider }
 * 
 * For providers without list endpoints (Anthropic, Perplexity, Azure),
 * returns curated static lists.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── PROVIDER MODEL DISCOVERY ENDPOINTS ───────────────────

interface DiscoveryConfig {
  url: string;
  method: string;
  headers: (apiKey: string) => Record<string, string>;
  extractModels: (data: any) => string[];
}

const DISCOVERY_CONFIGS: Record<string, (apiKey: string, endpoint?: string) => DiscoveryConfig> = {
  openai: (key) => ({
    url: 'https://api.openai.com/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).sort(),
  }),

  gemini: (key) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    method: 'GET',
    headers: () => ({ 'Content-Type': 'application/json' }),
    extractModels: (data) => (data?.models || [])
      .map((m: any) => m.name?.replace('models/', '') || '')
      .filter((n: string) => n && !n.includes('embedding') && !n.includes('tts') && !n.includes('imagen')),
  }),

  groq: (key) => ({
    url: 'https://api.groq.com/openai/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).sort(),
  }),

  deepseek: (key) => ({
    url: 'https://api.deepseek.com/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).sort(),
  }),

  openrouter: (key) => ({
    url: 'https://openrouter.ai/api/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).sort(),
  }),

  together: (key) => ({
    url: 'https://api.together.xyz/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (Array.isArray(data) ? data : []).map((m: any) => m.id).filter((id: string) => !id.includes('embedding')).sort(),
  }),

  fireworks: (key) => ({
    url: 'https://api.fireworks.ai/inference/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).filter((id: string) => !id.includes('embedding')).sort(),
  }),

  xai: (key) => ({
    url: 'https://api.x.ai/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).sort(),
  }),

  mistral: (key) => ({
    url: 'https://api.mistral.ai/v1/models',
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).sort(),
  }),

  cohere: (key) => ({
    url: 'https://api.cohere.com/v1/models',
    method: 'GET',
    headers: () => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    extractModels: (data) => (data?.models || [])
      .filter((m: any) => !m?.endpoints?.includes('embed'))
      .map((m: any) => m.name),
  }),

  perplexity: (_key) => ({
    url: '', // No list endpoint
    method: 'GET',
    headers: () => ({}),
    extractModels: () => ['sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-reasoning', 'sonar-deep-research'],
  }),

  anthropic: (_key) => ({
    url: '', // No list endpoint
    method: 'GET',
    headers: () => ({}),
    extractModels: () => ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  }),

  ollama: (_key) => ({
    url: 'http://localhost:11434/api/tags',
    method: 'GET',
    headers: () => ({}),
    extractModels: (data) => (data?.models || []).map((m: any) => m.name).sort(),
  }),

  opencode: (key, endpoint) => ({
    url: `${endpoint || 'https://api.opencode.ai'}/v1/models`,
    method: 'GET',
    headers: () => ({ 'Authorization': `Bearer ${key}` }),
    extractModels: (data) => (data?.data || []).map((m: any) => m.id).sort(),
  }),

  azure: (_key, endpoint) => ({
    url: '', // Per-deployment, no list endpoint
    method: 'GET',
    headers: () => ({}),
    extractModels: () => ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-35-turbo'],
  }),
};

// ─── FALLBACK STATIC MODEL LISTS ──────────────────────────

const STATIC_MODELS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  perplexity: ['sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-reasoning', 'sonar-deep-research'],
  azure: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-35-turbo'],
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, apiKey, endpoint } = body;

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ error: 'provider required' }, { status: 400 });
    }

    const providerKey = provider.toLowerCase();

    // For providers without list endpoints, return static list
    const configBuilder = DISCOVERY_CONFIGS[providerKey];
    if (!configBuilder) {
      return NextResponse.json({
        success: true,
        models: STATIC_MODELS[providerKey] || [],
        provider: providerKey,
        source: 'static',
      });
    }

    const config = configBuilder(apiKey || '', endpoint);

    // If no URL configured, use static list
    if (!config.url) {
      return NextResponse.json({
        success: true,
        models: config.extractModels(null),
        provider: providerKey,
        source: 'static',
      });
    }

    // Call the provider's model list endpoint
    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers(apiKey || ''),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[Discover] ${providerKey} returned ${response.status}: ${errorText.slice(0, 200)}`);

        // Return static fallback if API call fails
        return NextResponse.json({
          success: true,
          models: STATIC_MODELS[providerKey] || [],
          provider: providerKey,
          source: 'static_fallback',
          apiError: `HTTP ${response.status}`,
        });
      }

      const data = await response.json();
      const models = config.extractModels(data);

      return NextResponse.json({
        success: true,
        models,
        provider: providerKey,
        source: 'api',
        count: models.length,
      });

    } catch (fetchErr: any) {
      console.error(`[Discover] ${providerKey} fetch failed:`, fetchErr?.message);

      // Return static fallback
      return NextResponse.json({
        success: true,
        models: STATIC_MODELS[providerKey] || [],
        provider: providerKey,
        source: 'static_fallback',
        apiError: fetchErr?.message,
      });
    }

  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Discovery failed',
    }, { status: 500 });
  }
}
