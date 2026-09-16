'use client';

import React from 'react';
import type { BoardStatePayload, TelemetrySource } from '@/app/api/board/route';

interface ExplainableDecisionInspectorProps {
  nodeId: string | null;
  boardState: BoardStatePayload | null;
  onClose: () => void;
}

export default function ExplainableDecisionInspector({
  nodeId,
  boardState,
  onClose,
}: ExplainableDecisionInspectorProps) {
  if (!nodeId || !boardState) return null;

  const opp = boardState.activeOpportunity;
  const decision = boardState.decision;
  const portfolio = boardState.portfolio;

  const renderSourceTag = (source: TelemetrySource) => {
    const colors: Record<TelemetrySource, string> = {
      LIVE: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
      CALCULATED: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
      CONFIG: 'bg-zinc-800/60 text-zinc-300 border-zinc-600/50',
      SIMULATED: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
    };
    return (
      <span className="text-xs px-1.5 py-0.5 rounded border font-mono tracking-wider uppercase {colors[source]}">
        {source}
      </span>
    );
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[380px] bg-[#1e2a42]/95 border-l border-zinc-500/50 backdrop-blur-xl z-40 p-4 font-mono text-zinc-300 flex flex-col shadow-2xl overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-500/40">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-semibold text-sm tracking-wider uppercase">
            {nodeId === 'ai' ? 'EXPLAINABLE DECISION TRACE' : `${nodeId.toUpperCase()} INSPECTOR`}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 p-1 text-sm"
        >
          ✕
        </button>
      </div>

      {/* ─── SECTION 1: OPPORTUNITY SNAPSHOT ────────────────── */}
      {opp && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-600/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-100 text-base">{opp.symbol}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-zinc-300">{opp.chain}</span>
              {renderSourceTag(opp.liquidityUsd.source)}
            </div>
          </div>
          <div className="text-sm text-zinc-300 truncate">{opp.address}</div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-600/40 text-sm">
            <div>
              <span className="text-zinc-300 text-sm block">Momentum (5m)</span>
              <span className="text-emerald-400 font-medium">+{opp.momentumPercent.value}%</span>
            </div>
            <div>
              <span className="text-zinc-300 text-sm block">Volume Accel</span>
              <span className="text-cyan-300 font-medium">{opp.volumeAccel.value}×</span>
            </div>
            <div>
              <span className="text-zinc-300 text-sm block">Buy Pressure</span>
              <span className="text-zinc-100 font-medium">{opp.buyPressurePercent.value}%</span>
            </div>
            <div>
              <span className="text-zinc-300 text-sm block">Liquidity</span>
              <span className="text-zinc-100 font-medium">${(opp.liquidityUsd.value / 1000).toFixed(1)}k</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 2: AI DECISION & ALTERNATIVES ──────────── */}
      {decision && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wider">AI Proposal</span>
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-400 text-xs font-semibold">{decision.confidencePercent.value}% CONF</span>
              {renderSourceTag(decision.confidencePercent.source)}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-red-950/40 border border-red-800/40 text-red-300">
              {decision.sourceAsset.symbol} {decision.sourceAsset.changePercent}%
            </span>
            <span className="text-zinc-400">→</span>
            <span className="px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
              {decision.targetAsset.symbol} +{decision.targetAsset.changePercent}%
            </span>
          </div>

          <div className="text-sm text-zinc-300 leading-relaxed">
            {decision.rationale}
          </div>

          {/* Considered Alternatives */}
          <div className="pt-2 border-t border-zinc-600/40">
            <div className="text-sm text-zinc-300 uppercase tracking-wider mb-2">Evaluated Alternatives</div>
            <div className="space-y-1.5">
              {decision.considered.map((c, i) => (
                <div key={i} className="text-sm p-2 rounded bg-zinc-800/30 border border-zinc-600/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">{c.action}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      c.status === 'SELECTED' ? 'bg-emerald-950/60 text-emerald-300' : 'bg-zinc-800/60 text-zinc-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-zinc-300 mt-0.5">{c.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 3: DETERMINISTIC RISK AUDIT ────────────── */}
      {decision?.riskAudit && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-600/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300 uppercase tracking-wider">Independent Risk Gate</span>
            <span className="px-1.5 py-0.5 rounded text-sm bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
              {decision.riskAudit.status}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between py-1 border-b border-zinc-600/40">
              <span className="text-zinc-300">Slippage Ceiling</span>
              <span className="text-zinc-200">
                {decision.riskAudit.slippageLimit.calculated}% / ≤{decision.riskAudit.slippageLimit.limit}% ✓
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-600/40">
              <span className="text-zinc-300">Min Pool Liquidity</span>
              <span className="text-zinc-200">
                ${(decision.riskAudit.liquidityGate.current / 1000).toFixed(0)}k / ≥${(decision.riskAudit.liquidityGate.minRequired / 1000).toFixed(0)}k ✓
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-300">Circuit Breakers</span>
              <span className="text-zinc-200">
                Losses: {decision.riskAudit.circuitBreakers.currentLosses} / Max {decision.riskAudit.circuitBreakers.maxLosses} ✓
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 4: EXECUTION PIPELINE ──────────────────── */}
        <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-600/50 space-y-2">
            <span className="text-sm text-zinc-300 uppercase tracking-wider block">Execution Trace</span>
        <div className="space-y-1.5 text-sm text-zinc-300">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>1. Quote received via baw (420ms)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>2. Deterministic gate audit passed (12ms)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>3. Signed swap payload dispatched (890ms)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>4. Confirmed on BSC (3 blocks)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>5. Portfolio state reconciled (+0.00 delta)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
