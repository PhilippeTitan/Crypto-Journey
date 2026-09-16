'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { BoardStatePayload, TelemetrySource } from '@/app/api/board/route';
import AgentComposer from './AgentComposer';
import ExplainableDecisionInspector from './ExplainableDecisionInspector';

export default function DecisionBoard() {
  const [board, setBoard] = useState<BoardStatePayload | null>(null);
  const [inspectorNode, setInspectorNode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [activePulseProgress, setActivePulseProgress] = useState(0);

  const animFrameRef = useRef<number | null>(null);

  // ─── POLL BOARD STATE ────────────────────────────────────
  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch('/api/board?mode=full');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBoard(data.state);
          setConnected(true);
        }
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 1500);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  // ─── PULSE ANIMATION LOOP ────────────────────────────────
  useEffect(() => {
    let start = performance.now();
    const animate = (time: number) => {
      const elapsed = time - start;
      // Loop pulse every 2.4 seconds
      const progress = (elapsed % 2400) / 2400;
      setActivePulseProgress(progress);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ─── COMMAND HANDLER ─────────────────────────────────────
  const handleCommand = async (cmd: string) => {
    const lower = cmd.toLowerCase().trim();

    if (lower.includes('scan')) {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'triggerScan' }),
      });
      fetchBoard();
    } else if (lower.includes('take control')) {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'takeControl' }),
      });
      fetchBoard();
    } else if (lower.includes('return') || lower.includes('release')) {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'releaseControl' }),
      });
      fetchBoard();
    } else if (lower.includes('pause')) {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });
      fetchBoard();
    } else if (lower.includes('10000') || lower.includes('12 - 10000')) {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setMission', targetCapital: 10000 }),
      });
      fetchBoard();
    } else {
      // Default: trigger inference scan and open inspector if asking a question
      if (lower.includes('why') || lower.includes('afob') || lower.includes('doge')) {
        setInspectorNode('ai');
      }
    }
  };

  const handleSelectAutonomy = async (mode: string) => {
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setAutonomy', mode }),
    });
    fetchBoard();
  };

  const handleToggleControl = async () => {
    const action = board?.autonomyState.operatorControl ? 'releaseControl' : 'takeControl';
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    fetchBoard();
  };

  // Determine visual density (Idle vs Observing vs Active Decision)
  const density = board?.density || 'idle';
  const isRunning = board?.running || false;
  const isOperatorControl = board?.autonomyState.operatorControl || false;

  return (
    <div className="relative w-full h-[88vh] min-h-[640px] bg-[#050608] text-zinc-200 font-mono rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col select-none shadow-2xl">
      {/* ─── GLOBAL HEADER (Slim 48px) ────────────────────── */}
      <header className="h-12 border-b border-zinc-800/80 bg-[#07090d]/90 backdrop-blur-md px-4 flex items-center justify-between z-20">
        {/* Left: Brand & Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rotate-45 border border-cyan-400/80 relative shadow-[0_0_10px_rgba(101,215,255,0.4)]">
            <div className="absolute inset-1 bg-cyan-400" />
          </div>
          <span className="font-semibold text-xs tracking-widest text-zinc-100">MAUREDGE</span>
          <span className="text-[10px] text-zinc-600">3.0</span>
          {connected ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] ml-1" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1" />
          )}
        </div>

        {/* Center: Autonomy Status Pill */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => handleSelectAutonomy(board?.autonomyState.mode === 'aggressive' ? 'normal' : 'aggressive')}
            className={`cursor-pointer px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase border transition-all ${
              isOperatorControl
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:border-cyan-500/40'
            }`}
          >
            <span>{isOperatorControl ? '● MANUAL CONTROL' : `● AUTONOMOUS · ${board?.autonomyState.mode || 'NORMAL'}`}</span>
          </div>

          <button
            onClick={handleToggleControl}
            className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
              isOperatorControl
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            {isOperatorControl ? 'Return Autonomous' : 'Take Control'}
          </button>
        </div>

        {/* Right: Mission & Balance */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-600 text-[10px]">MISSION</span>
            <span className="text-zinc-300 text-[11px]">
              ${board?.mission.startCapital.toFixed(0)} → ${board?.mission.targetCapital.toLocaleString()}
            </span>
            <span className="text-emerald-400 text-[10px]">({board?.mission.progressPercent}%)</span>
          </div>

          <div className="h-3 w-[1px] bg-zinc-800" />

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-600 text-[10px]">WALLET</span>
            <span className="text-cyan-300 font-semibold text-[11px]">${board?.wallet.balance.toFixed(2)}</span>
            <span className="text-zinc-500 text-[9px]">{board?.wallet.currency}</span>
          </div>
        </div>
      </header>

      {/* ─── MAIN WORKSPACE: LIVING DECISION FIELD ──────────── */}
      <main className="relative flex-1 overflow-hidden bg-[#050608]">
        {/* Subtle Background Coordinate Grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, rgba(101,215,255,0.4) 0%, transparent 40%), linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        />

        {/* ─── LEFT GHOST ACTIVITY RAIL ─────────────────────── */}
        <div className="absolute left-4 top-4 bottom-24 w-44 z-10 pointer-events-auto hidden md:flex flex-col justify-between">
          <div className="space-y-3">
            <div className="text-[9px] text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
              <span>ACTIVITY RAIL</span>
            </div>

            <div className="space-y-2 border-l border-zinc-800/80 pl-2.5">
              {(board?.eventStream || []).slice(0, 5).map((evt, idx) => (
                <div
                  key={idx}
                  onClick={() => setInspectorNode(evt.node)}
                  className="cursor-pointer group text-[9px] leading-tight"
                >
                  <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-zinc-400 group-hover:text-cyan-300 font-medium truncate">
                    {evt.node}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── DENSITY 1: IDLE EXPERIENCE ──────────────────── */}
        {density === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
            <div className="relative flex flex-col items-center gap-4">
              {/* Central Dormant Breathing Pulse */}
              <div className="relative flex items-center justify-center w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-cyan-500/5 animate-ping duration-1000" />
                <div className="w-12 h-12 rounded-full border border-cyan-500/30 flex items-center justify-center bg-[#07090d]/80 shadow-[0_0_20px_rgba(101,215,255,0.08)]">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/80" />
                </div>
              </div>

              {/* Minimal Mission Identity */}
              <div className="text-center space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">MISSION IN PURSUIT</div>
                <div className="text-lg font-medium text-zinc-100 tracking-wide">
                  ${board?.mission.startCapital.toFixed(0)} → ${board?.mission.targetCapital.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500 flex items-center justify-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>AUTONOMOUS · WAITING FOR NEXT SIGNAL</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={() => handleCommand('scan market')}
                  className="px-3 py-1 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/40 text-cyan-300 text-[11px] transition-colors"
                >
                  Trigger Market Scan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── DENSITIES 2 & 3: OBSERVING & ACTIVE DECISION ─── */}
        {(density === 'observing' || density === 'active_decision') && (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center pointer-events-auto">
            <div className="relative w-full max-w-5xl h-[420px]">
              {/* SVG Dynamic Neural Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <defs>
                  <linearGradient id="cyanLine" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#65d7ff" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#65d7ff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#65d7ff" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Left: Portfolio Dial to Calculations & Opportunity */}
                <path
                  d="M 180 210 C 260 210, 280 130, 400 130"
                  fill="none"
                  stroke="rgba(101,215,255,0.25)"
                  strokeWidth="1.2"
                />
                <path
                  d="M 180 210 C 260 210, 280 280, 360 280"
                  fill="none"
                  stroke="rgba(101,215,255,0.25)"
                  strokeWidth="1.2"
                />

                {/* Top: Observation to Calculations */}
                <path
                  d="M 500 70 L 500 110"
                  fill="none"
                  stroke="rgba(230,199,106,0.3)"
                  strokeWidth="1.2"
                />

                {/* Middle: Calculations to AI Reasoning */}
                <path
                  d="M 500 150 L 500 200"
                  fill="none"
                  stroke="rgba(101,215,255,0.35)"
                  strokeWidth="1.2"
                />

                {/* Opportunity AFOB to AI Reasoning */}
                <path
                  d="M 440 280 C 470 280, 480 220, 500 220"
                  fill="none"
                  stroke="rgba(101,215,255,0.25)"
                  strokeWidth="1.2"
                />

                {/* AI Reasoning to AI Decision Pills */}
                <path
                  d="M 540 210 L 660 210"
                  fill="none"
                  stroke="rgba(101,215,255,0.4)"
                  strokeWidth="1.2"
                />

                {/* Decision Bracket down into Execution Pipeline */}
                <path
                  d="M 720 225 C 720 250, 720 260, 720 280"
                  fill="none"
                  stroke="rgba(98,230,177,0.4)"
                  strokeWidth="1.2"
                />

                {/* Luminous Pulse traveling along active decision path */}
                {isRunning && (
                  <circle
                    cx={180 + activePulseProgress * 320}
                    cy={210 - Math.sin(activePulseProgress * Math.PI) * 40}
                    r="2.5"
                    fill="#65d7ff"
                    className="shadow-[0_0_8px_#65d7ff]"
                  />
                )}
              </svg>

              {/* ─── NODE 1: PORTFOLIO DIAL (LEFT ANCHOR) ───── */}
              <div
                onClick={() => setInspectorNode('portfolio')}
                className="absolute left-6 top-[130px] w-36 h-36 rounded-full border border-zinc-700/60 bg-[#090b0f]/90 backdrop-blur-md flex flex-col items-center justify-center p-2 shadow-xl hover:border-cyan-400/60 cursor-pointer transition-colors z-10"
              >
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest">PORTFOLIO</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">{board?.portfolio.symbol}</div>
                <div className="text-[11px] text-emerald-400 font-medium">+{board?.portfolio.pnlPercent}%</div>
                <div className="text-[9px] text-zinc-400 mt-1">{board?.portfolio.allocationPercent}% alloc</div>
              </div>

              {/* ─── NODE 2: MARKET OBSERVATION (TOP CENTER) ── */}
              <div
                onClick={() => setInspectorNode('observe')}
                className="absolute left-1/2 -translate-x-1/2 top-4 px-3.5 py-2 rounded-lg bg-[#090b0f]/90 border border-amber-500/30 text-amber-300 text-xs shadow-lg flex flex-col items-center cursor-pointer hover:border-amber-400/60 transition-colors z-10"
              >
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider">OBSERVE MARKET</span>
                <span className="text-[10px] text-amber-200/90 font-medium">Binance · DexScreener · BSC</span>
              </div>

              {/* ─── NODE 3: CALCULATIONS / FEATURE ENGINE ──── */}
              <div
                onClick={() => setInspectorNode('features')}
                className="absolute left-1/2 -translate-x-1/2 top-[105px] px-3 py-1.5 rounded-lg bg-[#090b0f]/80 border border-zinc-700/60 text-zinc-300 text-xs shadow cursor-pointer hover:border-cyan-400/60 transition-colors z-10"
              >
                <span className="text-[9px] text-zinc-500 block uppercase">Calculations</span>
                <span className="text-[11px] text-cyan-300 font-medium">Feature Engine</span>
              </div>

              {/* ─── NODE 4: AFOB OPPORTUNITY CARD ──────────── */}
              <div
                onClick={() => setInspectorNode('afob')}
                className="absolute left-[310px] top-[240px] w-48 p-2.5 rounded-xl bg-[#090b0f]/90 border border-zinc-700/60 shadow-xl hover:border-cyan-400/60 cursor-pointer transition-colors z-10 text-[10px]"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-zinc-100 text-xs">{board?.activeOpportunity?.symbol}</span>
                  <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                    PASS
                  </span>
                </div>
                <div className="space-y-0.5 text-zinc-400">
                  <div className="flex justify-between">
                    <span>Momentum</span>
                    <span className="text-emerald-400">+{board?.activeOpportunity?.momentumPercent.value}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buy Pressure</span>
                    <span className="text-zinc-200">{board?.activeOpportunity?.buyPressurePercent.value}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volume Accel</span>
                    <span className="text-cyan-300">{board?.activeOpportunity?.volumeAccel.value}×</span>
                  </div>
                </div>
              </div>

              {/* ─── NODE 5: AI REASONING NODE ──────────────── */}
              <div
                onClick={() => setInspectorNode('ai')}
                className="absolute left-1/2 -translate-x-1/2 top-[190px] px-3.5 py-2 rounded-xl bg-[#090b0f]/95 border border-cyan-500/50 shadow-[0_0_20px_rgba(101,215,255,0.1)] text-cyan-300 text-xs cursor-pointer hover:border-cyan-400 transition-colors z-10 flex flex-col items-center"
              >
                <span className="text-[9px] text-cyan-400/70 uppercase tracking-widest">AI REASONING</span>
                <span className="text-[11px] font-semibold text-cyan-200 mt-0.5">Gemini Inference</span>
              </div>

              {/* ─── NODE 6: AI DECISION & PILLS ────────────── */}
              <div
                onClick={() => setInspectorNode('ai')}
                className="absolute right-12 top-[175px] w-64 p-2.5 rounded-xl bg-[#090b0f]/95 border border-emerald-500/40 shadow-xl cursor-pointer hover:border-emerald-400 transition-colors z-10"
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">AI PROPOSAL</span>
                  <span className="text-[9px] text-cyan-400 font-semibold">{board?.decision?.confidencePercent.value}% CONF</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-red-950/60 border border-red-800/40 text-red-300">
                    SELL 40% {board?.decision?.sourceAsset.symbol}
                  </span>
                  <span className="text-zinc-500">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                    BUY {board?.decision?.targetAsset.symbol}
                  </span>
                </div>
              </div>

              {/* ─── NODE 7: DOWNSTREAM DETERMINISTIC PIPELINE ── */}
              <div className="absolute right-28 top-[270px] flex flex-col items-center space-y-1 text-[9px] z-10">
                <div
                  onClick={() => setInspectorNode('risk')}
                  className="px-2.5 py-1 rounded bg-zinc-900/80 border border-emerald-600/40 text-emerald-300 cursor-pointer hover:border-emerald-400 transition-colors"
                >
                  ✓ RISK VALIDATION (PASS)
                </div>
                <span className="text-zinc-600">↓</span>
                <div
                  onClick={() => setInspectorNode('exec')}
                  className="px-2.5 py-1 rounded bg-zinc-900/80 border border-cyan-600/40 text-cyan-300 cursor-pointer hover:border-cyan-400 transition-colors"
                >
                  ⚡ EXECUTION (BAW SWAP)
                </div>
                <span className="text-zinc-600">↓</span>
                <div className="text-zinc-500 text-[8px]">VERIFIED & RECONCILED</div>
              </div>
            </div>
          </div>
        )}

        {/* ─── CONTEXTUAL SIDE DRAWER INSPECTOR ─────────────── */}
        {inspectorNode && (
          <ExplainableDecisionInspector
            nodeId={inspectorNode}
            boardState={board}
            onClose={() => setInspectorNode(null)}
          />
        )}
      </main>

      {/* ─── BOTTOM CONTROL DECK: AI COMPOSER ──────────────── */}
      <footer className="p-3 bg-[#050608]/95 border-t border-zinc-800/80 z-20">
        <AgentComposer
          onCommand={handleCommand}
          autonomyMode={board?.autonomyState.mode || 'normal'}
          onSelectAutonomy={handleSelectAutonomy}
          running={isRunning}
          onOpenInspector={setInspectorNode}
        />
      </footer>
    </div>
  );
}
