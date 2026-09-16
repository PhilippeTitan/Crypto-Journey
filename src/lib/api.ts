import type {
  StatusResponse,
  Position,
  Trade,
  Opportunity,
  AIDecision,
  SystemEvent,
  MarketRegime,
  ProviderInfo,
  AppConfig,
} from './types';

const API_BASE = '';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Dashboard Data ───
export const api = {
  getStatus: () => fetchJSON<StatusResponse>('/api/status'),
  getPositions: () => fetchJSON<Position[]>('/api/positions'),
  getTrades: () => fetchJSON<Trade[]>('/api/trades'),
  getOpportunities: () => fetchJSON<Opportunity[]>('/api/opportunities'),
  getDecisions: () => fetchJSON<AIDecision[]>('/api/decisions'),
  getEvents: () => fetchJSON<SystemEvent[]>('/api/events'),
  getRegimes: () => fetchJSON<MarketRegime[]>('/api/regime'),

  // ─── Config ───
  getConfig: () => fetchJSON<AppConfig>('/api/config'),

  saveConfig: (payload: Record<string, string>) =>
    fetchJSON<{ ok: boolean; updated: string[] }>('/api/config', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProviders: () => fetchJSON<ProviderInfo[]>('/api/config/providers'),

  testProvider: (data: {
    provider: string;
    model: string;
    apiKey?: string;
    endpoint?: string;
  }) =>
    fetchJSON<{ ok: boolean; message: string; model?: string; response?: unknown }>(
      '/api/config/test',
      { method: 'POST', body: JSON.stringify(data) }
    ),
};
