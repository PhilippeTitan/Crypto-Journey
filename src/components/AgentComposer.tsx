'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface ProviderItem {
  key: string;
  name: string;
  models: string[];
  defaultModel: string;
}

interface AgentComposerProps {
  onCommand: (cmd: string) => Promise<void> | void;
  autonomyMode: string;
  onSelectAutonomy: (mode: string) => void;
  running?: boolean;
  onOpenInspector?: (nodeId: string) => void;
}

export default function AgentComposer({
  onCommand,
  autonomyMode,
  onSelectAutonomy,
  running = false,
  onOpenInspector,
}: AgentComposerProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'provider' | 'effort' | 'context'>('main');

  // Agent configuration state
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro');
  const [effort, setEffort] = useState<'Light' | 'Medium' | 'High' | 'Extra High'>('High');
  const [contextToggles, setContextToggles] = useState({
    mission: true,
    portfolio: true,
    regime: true,
    opportunities: true,
    memory: false,
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch real dynamic provider list from /api/config/providers
  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch('/api/config/providers');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setProviders(data);
          }
        }
      } catch {
        // Fallback default list if offline
        setProviders([
          { key: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'], defaultModel: 'gemini-2.5-pro' },
          { key: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4', 'claude-3-5-sonnet'], defaultModel: 'claude-sonnet-4' },
          { key: 'openai', name: 'OpenAI', models: ['gpt-4o', 'o3-mini'], defaultModel: 'gpt-4o' },
          { key: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], defaultModel: 'deepseek-chat' },
          { key: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile'], defaultModel: 'llama-3.3-70b-versatile' },
        ]);
      }
    }
    loadProviders();
  }, []);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setConfigOpen(false);
      }
    }
    if (configOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [configOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim();
    setInput('');
    onCommand(cmd);

    // If user asked "why", open the AI decision inspector
    if (cmd.toLowerCase().includes('why') && onOpenInspector) {
      onOpenInspector('ai');
    }
  };

  const currentProviderObj = providers.find(p => p.key === selectedProvider);

  return (
    <div className="relative w-full max-w-3xl mx-auto z-30">
      {/* ─── POPUP: AGENT CONFIGURATION DECK (Opened via '+') ──── */}
      {configOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full mb-3 left-0 w-full sm:w-[420px] bg-[#1e2a42]/95 border border-zinc-500/50 rounded-xl shadow-2xl backdrop-blur-xl p-5 text-sm font-mono text-zinc-300 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-500/40">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-semibold tracking-wider text-sm">AGENT CONFIGURATION</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                AUTHORITY DECK
              </span>
            </div>
            <button
              onClick={() => setConfigOpen(false)}
              className="text-zinc-400 hover:text-zinc-200 p-1 text-sm"
            >
              ✕
            </button>
          </div>

          {activeTab === 'main' && (
            <div className="space-y-3">
              {/* Provider & Model */}
              <div
                onClick={() => setActiveTab('provider')}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-600/50 hover:border-cyan-500/40 cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-sm text-zinc-300 uppercase tracking-wider">Inference Provider</div>
                  <div className="text-zinc-100 font-medium text-sm mt-0.5 flex items-center gap-1.5">
                    <span>{currentProviderObj?.name || selectedProvider}</span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-cyan-400">{selectedModel}</span>
                  </div>
                </div>
                <span className="text-zinc-400 text-sm">›</span>
              </div>

              {/* Reasoning Effort */}
              <div
                onClick={() => setActiveTab('effort')}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-600/50 hover:border-cyan-500/40 cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-sm text-zinc-300 uppercase tracking-wider">Reasoning Effort</div>
                  <div className="text-zinc-100 font-medium text-sm mt-0.5 flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                      effort === 'Extra High' ? 'bg-purple-400' : effort === 'High' ? 'bg-cyan-400' : 'bg-emerald-400'
                    }`} />
                    <span>{effort}</span>
                    <span className="text-sm text-zinc-400">(Decoupled from Autonomy)</span>
                  </div>
                </div>
                <span className="text-zinc-400 text-sm">›</span>
              </div>

              {/* Context Selector */}
              <div
                onClick={() => setActiveTab('context')}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-600/50 hover:border-cyan-500/40 cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-sm text-zinc-300 uppercase tracking-wider">Structured Context</div>
                  <div className="text-zinc-200 text-sm mt-0.5 truncate max-w-[280px]">
                    Mission, Portfolio, Market Regime, Opportunities
                  </div>
                </div>
                <span className="text-zinc-400 text-sm">›</span>
              </div>

              {/* Capabilities & Skills Summary */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-3 rounded bg-zinc-800/40 border border-zinc-600/50 text-sm">
                  <span className="text-zinc-300 block">Capabilities</span>
                  <span className="text-cyan-300 font-semibold">18 Registered</span>
                </div>
                <div className="p-3 rounded bg-zinc-800/40 border border-zinc-600/50 text-sm">
                  <span className="text-zinc-300 block">Skills Layer</span>
                  <span className="text-emerald-300 font-semibold">8 Available</span>
                </div>
              </div>

              {/* Autonomy Regime */}
              <div className="pt-2 border-t border-zinc-500/40">
                <div className="text-sm text-zinc-300 uppercase tracking-wider mb-2">Autonomy Regime</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['soft', 'normal', 'aggressive', 'protect', 'preserve', 'emergency'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => onSelectAutonomy(m)}
                      className={`px-3 py-2 rounded text-sm font-mono capitalize transition-colors ${
                        autonomyMode.toLowerCase() === m
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                          : 'bg-zinc-800/50 text-zinc-300 border border-zinc-600/50 hover:text-zinc-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab: Provider & Model Selector */}
          {activeTab === 'provider' && (
            <div className="space-y-3">
              <button
                onClick={() => setActiveTab('main')}
                className="text-zinc-400 hover:text-zinc-200 text-sm flex items-center gap-1 mb-2"
              >
                ‹ Back to Agent Config
              </button>
              <div className="text-sm text-zinc-300 uppercase tracking-wider">Select AI Provider</div>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {providers.map((p) => (
                  <div
                    key={p.key}
                    onClick={() => {
                      setSelectedProvider(p.key);
                      setSelectedModel(p.defaultModel || p.models[0]);
                    }}
                    className={`p-2.5 rounded-lg cursor-pointer flex items-center justify-between ${
                      selectedProvider === p.key
                        ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/60'
                        : 'bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/80 hover:text-zinc-100 border border-transparent'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-sm text-zinc-400">{p.models.length} models</span>
                  </div>
                ))}
              </div>

              {currentProviderObj && (
                <div className="pt-2 border-t border-zinc-500/40">
                  <div className="text-sm text-zinc-300 uppercase tracking-wider mb-1">Available Models</div>
                  <div className="space-y-1">
                    {currentProviderObj.models.map((m) => (
                      <div
                        key={m}
                        onClick={() => setSelectedModel(m)}
                        className={`p-2.5 rounded text-sm cursor-pointer ${
                          selectedModel === m
                            ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                            : 'text-zinc-300 hover:text-zinc-100'
                        }`}
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab: Effort Selector */}
          {activeTab === 'effort' && (
            <div className="space-y-3">
              <button
                onClick={() => setActiveTab('main')}
                className="text-zinc-400 hover:text-zinc-200 text-sm flex items-center gap-1 mb-2"
              >
                ‹ Back to Agent Config
              </button>
              <div className="text-sm text-zinc-300 uppercase tracking-wider">Reasoning Effort Tier</div>
              {[
                { name: 'Light', desc: 'Fast token scans and routine pair discovery.' },
                { name: 'Medium', desc: 'Standard cycle: feature evaluation and spreads.' },
                { name: 'High', desc: 'Deep comparative reasoning (AFOB vs DOGE).' },
                { name: 'Extra High', desc: 'Strategic pivots, macro rebalancing, exit crisis.' },
              ].map((tier) => (
                <div
                  key={tier.name}
                  onClick={() => setEffort(tier.name as typeof effort)}
                  className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                    effort === tier.name
                      ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
                      : 'bg-zinc-800/40 border-zinc-600/50 text-zinc-300 hover:text-zinc-100'
                  }`}
                >
                  <div className="font-medium text-sm text-zinc-100">{tier.name}</div>
                  <div className="text-sm text-zinc-300 mt-0.5">{tier.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Sub-tab: Context Selector */}
          {activeTab === 'context' && (
            <div className="space-y-3">
              <button
                onClick={() => setActiveTab('main')}
                className="text-zinc-400 hover:text-zinc-200 text-sm flex items-center gap-1 mb-2"
              >
                ‹ Back to Agent Config
              </button>
              <div className="text-sm text-zinc-300 uppercase tracking-wider">Structured Context Bundle</div>
              {Object.entries(contextToggles).map(([key, val]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-600/50 cursor-pointer text-sm"
                >
                  <span className="capitalize text-zinc-200">{key}</span>
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() =>
                      setContextToggles(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
                    }
                    className="accent-cyan-400"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MAIN COMPOSER BAR ──────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className={`relative flex flex-col bg-[#1e2a42]/90 border rounded-xl backdrop-blur-xl transition-all duration-300 ${
          focused
            ? 'border-cyan-500/50 shadow-[0_0_24px_rgba(101,215,255,0.12)]'
            : 'border-zinc-500/40 shadow-lg'
        }`}
      >
        {/* Top Input Row */}
        <div className="flex items-center px-4 pt-3 pb-1.5">
          <span className="text-cyan-400/80 font-mono text-sm select-none mr-2">›</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              running
                ? 'Agent is actively evaluating market signals...'
                : 'Talk to MaurEdge — discuss strategy, plan trades, or say "scan market"...'
            }
            className="flex-1 bg-transparent border-0 outline-none text-zinc-100 placeholder-zinc-500 font-mono text-base"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className={`ml-2 p-1 rounded transition-colors ${
              input.trim()
                ? 'text-cyan-300 hover:text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/40'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {/* Bottom Configuration & Status Strip */}
        <div className="flex items-center justify-between px-4 pb-2.5 pt-1.5 text-sm font-mono text-zinc-300 border-t border-zinc-500/30">
          <div className="flex items-center gap-2 flex-wrap">
            {/* [+] Button for Agent Configuration */}
            <button
              type="button"
              onClick={() => setConfigOpen(!configOpen)}
              className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                configOpen
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-200 border border-zinc-600/50'
              }`}
            >
              <span>＋</span>
              <span className="hidden sm:inline text-sm">Config</span>
            </button>

            {/* Provider & Model Badge */}
            <span
              onClick={() => { setConfigOpen(true); setActiveTab('provider'); }}
              className="cursor-pointer hover:text-zinc-300 transition-colors"
            >
              <strong className="text-zinc-300 font-normal">{currentProviderObj?.name || 'Gemini'}</strong>{' '}
              <span className="text-cyan-400/90">{selectedModel}</span>
            </span>

            <span className="text-zinc-700">•</span>

            {/* Effort Badge */}
            <span
              onClick={() => { setConfigOpen(true); setActiveTab('effort'); }}
              className="cursor-pointer hover:text-zinc-300 transition-colors"
            >
              Effort: <span className="text-zinc-200">{effort}</span>
            </span>

            <span className="text-zinc-600">•</span>

            {/* Autonomy Badge */}
            <span
              onClick={() => { setConfigOpen(true); setActiveTab('main'); }}
              className="cursor-pointer hover:text-zinc-200 transition-colors uppercase text-sm"
            >
              Regime: <span className="text-emerald-400">{autonomyMode}</span>
            </span>
          </div>

          {/* Running Indicator */}
          {running && (
            <div className="flex items-center gap-1.5 text-cyan-400 text-xs animate-pulse">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span>CYCLING</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
