'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { ProviderInfo } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [scanInterval, setScanInterval] = useState(30);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load provider registry + current config
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setTestResult(null);
    setApiKey('');

    Promise.all([api.getProviders(), api.getConfig()])
      .then(([provs, cfg]) => {
        setProviders(provs);
        const prov = cfg.ai_provider || provs[0]?.key || 'openai';
        setSelectedProvider(prov);
        setModel(cfg.ai_model || provs.find((p) => p.key === prov)?.defaultModel || '');
        setEndpoint(cfg.ai_endpoint || '');
        setScanInterval(cfg.scan_interval_ms ? Math.round(parseInt(cfg.scan_interval_ms) / 1000) : 30);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const currentProvider = providers.find((p) => p.key === selectedProvider);

  function handleProviderChange(key: string) {
    setSelectedProvider(key);
    const prov = providers.find((p) => p.key === key);
    if (prov) {
      setModel(prov.defaultModel);
      if (!prov.needsEndpoint) setEndpoint('');
    }
    setTestResult(null);
  }

  async function handleTest() {
    setTestResult(null);
    try {
      const res = await api.testProvider({
        provider: selectedProvider,
        model,
        apiKey: apiKey || undefined,
        endpoint: endpoint || undefined,
      });
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' });
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        ai_provider: selectedProvider,
        ai_model: model,
        scan_interval_ms: String(scanInterval * 1000),
      };
      if (endpoint) payload.ai_endpoint = endpoint;
      if (apiKey && !apiKey.startsWith('•••') && currentProvider?.keyEnv) {
        payload[currentProvider.keyEnv.toLowerCase()] = apiKey;
      }
      const res = await api.saveConfig(payload);
      if (res.ok) {
        setTestResult({ ok: true, message: `✅ Saved! Updated: ${res.updated.join(', ')}` });
        setApiKey('');
        setTimeout(onClose, 1500);
      }
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-bg-card to-bg-cardHover border border-border rounded-2xl p-8 w-[480px] max-w-[90vw] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-6 gradient-text">⚙️ AI Configuration</h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#0d1220] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Provider */}
            <div className="mb-5">
              <label className="block text-[12px] uppercase tracking-[1px] text-accent-muted font-semibold mb-1.5">
                AI Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-bg-input border border-border rounded-lg text-white text-sm outline-none
                           focus:border-accent-purple transition-colors"
              >
                {providers.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}{p.noKeyRequired ? ' (no key)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            {!currentProvider?.noKeyRequired && (
              <div className="mb-5">
                <label className="block text-[12px] uppercase tracking-[1px] text-accent-muted font-semibold mb-1.5">
                  {currentProvider?.name} API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={currentProvider?.keyPlaceholder || 'Enter API key'}
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 bg-bg-input border border-border rounded-lg text-white text-sm font-mono
                             tracking-[1px] outline-none focus:border-accent-purple transition-colors"
                />
                <div className="text-[11px] text-accent-dim mt-1">
                  Your key is stored in the database. Never shared externally.
                </div>
              </div>
            )}

            {/* Endpoint */}
            {currentProvider?.needsEndpoint && (
              <div className="mb-5">
                <label className="block text-[12px] uppercase tracking-[1px] text-accent-muted font-semibold mb-1.5">
                  Custom Endpoint URL
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://your-endpoint.com/v1/chat/completions"
                  className="w-full px-3.5 py-2.5 bg-bg-input border border-border rounded-lg text-white text-sm outline-none
                             focus:border-accent-purple transition-colors"
                />
                <div className="text-[11px] text-accent-dim mt-1">
                  Required for Azure, OpenCode, and remote Ollama.
                </div>
              </div>
            )}

            {/* Model */}
            <div className="mb-5">
              <label className="block text-[12px] uppercase tracking-[1px] text-accent-muted font-semibold mb-1.5">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-bg-input border border-border rounded-lg text-white text-sm outline-none
                           focus:border-accent-purple transition-colors"
              >
                {currentProvider?.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Scan Interval */}
            <div className="mb-5">
              <label className="block text-[12px] uppercase tracking-[1px] text-accent-muted font-semibold mb-1.5">
                Scan Interval (seconds)
              </label>
              <input
                type="number"
                min={10}
                max={300}
                value={scanInterval}
                onChange={(e) => setScanInterval(parseInt(e.target.value) || 30)}
                className="w-full px-3.5 py-2.5 bg-bg-input border border-border rounded-lg text-white text-sm outline-none
                           focus:border-accent-purple transition-colors"
              />
              <div className="text-[11px] text-accent-dim mt-1">
                How often the autonomous loop scans for opportunities (10–300s)
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`mb-4 px-3.5 py-2.5 rounded-lg text-[13px] ${
                  testResult.ok
                    ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
                }`}
              >
                {testResult.message}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2.5 mt-6">
              <button
                onClick={handleTest}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-[#1a2240] text-accent-gray border border-[#2a3456]
                           hover:bg-[#2a3456] hover:text-white transition-all"
              >
                🧪 Test Connection
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white
                           bg-gradient-to-r from-accent-purple to-[#5b4bc9] hover:-translate-y-0.5
                           hover:shadow-[0_4px_20px_rgba(123,104,238,0.3)] transition-all disabled:opacity-50"
              >
                {saving ? '💾 Saving...' : '💾 Save Settings'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-[#1a2240] text-accent-gray border border-[#2a3456]
                           hover:bg-[#2a3456] hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
