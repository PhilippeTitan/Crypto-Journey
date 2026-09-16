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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [planSuggestion, setPlanSuggestion] = useState<any>(null);
  const [planState, setPlanState] = useState<any>(null);
  const [isThinking, setIsThinking] = useState(false);

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

  // ─── COMMAND HANDLER (Real AI Conversation) ─────────────
  const handleCommand = async (cmd: string) => {
    const lower = cmd.toLowerCase().trim();

    // Board actions still use direct commands
    if (lower === 'scan' || lower === 'scan market') {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'triggerScan' }),
      });
      fetchBoard();
      return;
    }
    if (lower === 'take control') {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'takeControl' }),
      });
      fetchBoard();
      return;
    }
    if (lower === 'release' || lower === 'return control') {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'releaseControl' }),
      });
      fetchBoard();
      return;
    }
    if (lower === 'pause') {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });
      fetchBoard();
      return;
    }

    // Everything else goes to the real AI conversation
    setIsThinking(true);
    setAiResponse(null);
    setPlanSuggestion(null);
    try {
      const res = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cmd, sessionId: conversationId }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResponse(data.response);
        setConversationId(data.sessionId);
        if (data.planSuggestion) {
          setPlanSuggestion(data.planSuggestion);
        }
      } else {
        setAiResponse(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setAiResponse(`Connection error: ${err?.message || 'Unknown'}`);
    } finally {
      setIsThinking(false);
    }
  };

  // ─── PLAN ACTIONS ───────────────────────────────────────
  const handleArmPlan = async () => {
    if (!planSuggestion) return;
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', plan: planSuggestion }),
      });
      const data = await res.json();
      if (data.success) {
        // Now arm it
        const armRes = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'arm' }),
        });
        const armData = await armRes.json();
        if (armData.success) {
          setPlanState(armData.plan);
          setPlanSuggestion(null);
          setAiResponse(`Plan v${armData.plan.version} ARMED. Autonomous execution authorized.`);
        }
      }
    } catch (err: any) {
      setAiResponse(`Failed to arm plan: ${err?.message}`);
    }
  };

  const handleRevokePlan = async () => {
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      const data = await res.json();
      if (data.success) {
        setPlanState(null);
        setAiResponse(data.message);
      }
    } catch (err: any) {
      setAiResponse(`Failed to revoke: ${err?.message}`);
    }
  };

  // ─── CHECK PLAN STATE ON LOAD ───────────────────────────
  useEffect(() => {
    fetch('/api/plan')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.plan) {
          setPlanState(data.plan);
        }
      })
      .catch(() => {});
  }, []);

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
    <div className="relative w-full h-[88vh] min-h-[640px] bg-[#151d2e] text-zinc-200 font-mono rounded-2xl border border-zinc-600/50 overflow-hidden flex flex-col select-none shadow-2xl">
      {/* ─── GLOBAL HEADER (Slim 48px) ────────────────────── */}
      <header className="h-16 border-b border-zinc-600/50 bg-[#1e2a42]/95 backdrop-blur-md px-6 flex items-center justify-between z-20">
        {/* Left: Brand & Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rotate-45 border border-cyan-400/80 relative shadow-[0_0_10px_rgba(101,215,255,0.4)]">
            <div className="absolute inset-1 bg-cyan-400" />
          </div>
          <span className="font-semibold text-base tracking-widest text-zinc-100">MAUREDGE</span>
          <span className="text-sm text-zinc-300">3.0</span>
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
            className={`cursor-pointer px-3 py-1.5 rounded-full text-xs tracking-wider uppercase border transition-all ${
              isOperatorControl
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:border-cyan-500/40'
            }`}
          >
            <span>{isOperatorControl ? '● MANUAL CONTROL' : `● AUTONOMOUS · ${board?.autonomyState.mode || 'NORMAL'}`}</span>
          </div>

          <button
            onClick={handleToggleControl}
            className={`px-3 py-1 rounded text-xs border transition-colors ${
              isOperatorControl
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-zinc-800/60 text-zinc-300 border-zinc-600/50 hover:text-zinc-100'
            }`}
          >
            {isOperatorControl ? 'Return Autonomous' : 'Take Control'}
          </button>
        </div>

        {/* Right: Mission & Balance */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-300 text-sm">MISSION</span>
            <span className="text-zinc-100 text-base">
              ${board?.mission.startCapital.toFixed(0)} → ${board?.mission.targetCapital.toLocaleString()}
            </span>
            <span className="text-emerald-400 text-sm">({board?.mission.progressPercent}%)</span>
          </div>

          <div className="h-3 w-[1px] bg-zinc-800" />

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-300 text-sm">WALLET</span>
            <span className="text-cyan-300 font-semibold text-base">${board?.wallet.balance.toFixed(2)}</span>
            <span className="text-zinc-300 text-sm">{board?.wallet.currency}</span>
          </div>
        </div>
      </header>

      {/* ─── MAIN WORKSPACE: LIVING DECISION FIELD ──────────── */}
      <main className="relative flex-1 overflow-hidden bg-[#151d2e]">
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
            <div className="text-sm text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400/70" />
              <span>ACTIVITY RAIL</span>
            </div>

            <div className="space-y-2.5 border-l border-zinc-600/50 pl-3">
              {(board?.eventStream || []).slice(0, 5).map((evt, idx) => (
                <div
                  key={idx}
                  onClick={() => setInspectorNode(evt.node)}
                  className="cursor-pointer group text-sm leading-tight"
                >
                  <div className="text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-zinc-200 group-hover:text-cyan-300 font-medium truncate">
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
              <div className="relative flex items-center justify-center w-32 h-32">
                <div className="absolute inset-0 rounded-full bg-cyan-500/8 animate-ping duration-1000" />
                <div className="w-16 h-16 rounded-full border border-cyan-500/30 flex items-center justify-center bg-[#1e2a42]/80 shadow-[0_0_24px_rgba(101,215,255,0.12)]">
                  <div className="w-4 h-4 rounded-full bg-cyan-400/80" />
                </div>
              </div>

              {/* Minimal Mission Identity */}
              <div className="text-center space-y-2">
                <div className="text-sm text-zinc-300 uppercase tracking-widest">MISSION IN PURSUIT</div>
                <div className="text-2xl font-medium text-zinc-100 tracking-wide">
                  ${board?.mission.startCapital.toFixed(0)} → ${board?.mission.targetCapital.toLocaleString()}
                </div>
                <div className="text-sm text-zinc-300 flex items-center justify-center gap-1.5 pt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>AUTONOMOUS · WAITING FOR NEXT SIGNAL</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={() => handleCommand('scan market')}
                  className="px-5 py-2.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-700/50 text-cyan-300 text-base transition-colors"
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
                  stroke="rgba(101,215,255,0.35)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 180 210 C 260 210, 280 280, 360 280"
                  fill="none"
                  stroke="rgba(101,215,255,0.35)"
                  strokeWidth="1.5"
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
                  stroke="rgba(101,215,255,0.45)"
                  strokeWidth="1.5"
                />

                {/* Opportunity AFOB to AI Reasoning */}
                <path
                  d="M 440 280 C 470 280, 480 220, 500 220"
                  fill="none"
                  stroke="rgba(101,215,255,0.35)"
                  strokeWidth="1.5"
                />

                {/* AI Reasoning to AI Decision Pills */}
                <path
                  d="M 540 210 L 660 210"
                  fill="none"
                  stroke="rgba(101,215,255,0.5)"
                  strokeWidth="1.5"
                />

                {/* Decision Bracket down into Execution Pipeline */}
                <path
                  d="M 720 225 C 720 250, 720 260, 720 280"
                  fill="none"
                  stroke="rgba(98,230,177,0.5)"
                  strokeWidth="1.5"
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
                className="absolute left-6 top-[130px] w-44 h-44 rounded-full border border-zinc-500/50 bg-[#1e2a42]/90 backdrop-blur-md flex flex-col items-center justify-center p-3 shadow-xl hover:border-cyan-400/60 cursor-pointer transition-colors z-10"
              >
                <div className="text-sm text-zinc-300 uppercase tracking-widest">PORTFOLIO</div>
                <div className="text-xl font-bold text-zinc-100 mt-0.5">{board?.portfolio.symbol}</div>
                <div className="text-base text-emerald-400 font-medium">+{board?.portfolio.pnlPercent}%</div>
                <div className="text-sm text-zinc-300 mt-1">{board?.portfolio.allocationPercent}% alloc</div>
              </div>

              {/* ─── NODE 2: MARKET OBSERVATION (TOP CENTER) ── */}
              <div
                onClick={() => setInspectorNode('observe')}
                className="absolute left-1/2 -translate-x-1/2 top-4 px-5 py-3 rounded-lg bg-[#1e2a42]/90 border border-amber-500/30 text-amber-300 text-sm shadow-lg flex flex-col items-center cursor-pointer hover:border-amber-400/60 transition-colors z-10"
              >
                <span className="text-sm text-zinc-200 uppercase tracking-wider">OBSERVE MARKET</span>
                <span className="text-sm text-amber-200/90 font-medium">Binance · DexScreener · BSC</span>
              </div>

              {/* ─── NODE 3: CALCULATIONS / FEATURE ENGINE ──── */}
              <div
                onClick={() => setInspectorNode('features')}
                className="absolute left-1/2 -translate-x-1/2 top-[105px] px-5 py-2.5 rounded-lg bg-[#1e2a42]/80 border border-zinc-500/50 text-zinc-300 text-sm shadow cursor-pointer hover:border-cyan-400/60 transition-colors z-10"
              >
                <span className="text-sm text-zinc-300 block uppercase">Calculations</span>
                <span className="text-base text-cyan-300 font-medium">Feature Engine</span>
              </div>

              {/* ─── NODE 4: AFOB OPPORTUNITY CARD ──────────── */}
              <div
                onClick={() => setInspectorNode('afob')}
                className="absolute left-[310px] top-[240px] w-56 p-3.5 rounded-xl bg-[#1e2a42]/90 border border-zinc-500/50 shadow-xl hover:border-cyan-400/60 cursor-pointer transition-colors z-10 text-sm"
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-zinc-100 text-base">{board?.activeOpportunity?.symbol}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                    PASS
                  </span>
                </div>
                <div className="space-y-1 text-zinc-300 text-sm">
                  <div className="flex justify-between">
                    <span>Momentum</span>
                    <span className="text-emerald-400">+{board?.activeOpportunity?.momentumPercent.value}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buy Pressure</span>
                    <span className="text-zinc-100">{board?.activeOpportunity?.buyPressurePercent.value}%</span>
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
                className="absolute left-1/2 -translate-x-1/2 top-[190px] px-5 py-3 rounded-xl bg-[#1e2a42]/95 border border-cyan-500/50 shadow-[0_0_24px_rgba(101,215,255,0.15)] text-cyan-300 text-sm cursor-pointer hover:border-cyan-400 transition-colors z-10 flex flex-col items-center"
              >
                <span className="text-sm text-cyan-400/80 uppercase tracking-widest">AI REASONING</span>
                <span className="text-base font-semibold text-cyan-200 mt-0.5">Gemini Inference</span>
              </div>

              {/* ─── NODE 6: AI DECISION & PILLS ────────────── */}
              <div
                onClick={() => setInspectorNode('ai')}
                className="absolute right-12 top-[175px] w-72 p-4 rounded-xl bg-[#1e2a42]/95 border border-emerald-500/40 shadow-xl cursor-pointer hover:border-emerald-400 transition-colors z-10"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-zinc-300 uppercase tracking-wider">AI PROPOSAL</span>
                  <span className="text-sm text-cyan-400 font-semibold">{board?.decision?.confidencePercent.value}% CONF</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-1 rounded bg-red-950/60 border border-red-800/40 text-red-300">
                    SELL 40% {board?.decision?.sourceAsset.symbol}
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                    BUY {board?.decision?.targetAsset.symbol}
                  </span>
                </div>
              </div>

              {/* ─── NODE 7: DOWNSTREAM DETERMINISTIC PIPELINE ── */}
              <div className="absolute right-28 top-[270px] flex flex-col items-center space-y-2 text-sm z-10">
                <div
                  onClick={() => setInspectorNode('risk')}
                  className="px-3 py-1.5 rounded bg-zinc-800/60 border border-emerald-600/40 text-emerald-300 cursor-pointer hover:border-emerald-400 transition-colors"
                >
                  ✓ RISK VALIDATION (PASS)
                </div>
                <span className="text-zinc-500">↓</span>
                <div
                  onClick={() => setInspectorNode('exec')}
                  className="px-3 py-1.5 rounded bg-zinc-800/60 border border-cyan-600/40 text-cyan-300 cursor-pointer hover:border-cyan-400 transition-colors"
                >
                  ⚡ EXECUTION (BAW SWAP)
                </div>
                <span className="text-zinc-500">↓</span>
                <div className="text-zinc-400 text-xs">VERIFIED & RECONCILED</div>
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

        {/* ─── AI CONVERSATION RESPONSE PANEL ──────────────── */}
        {(aiResponse || isThinking) && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-30 pointer-events-auto">
            <div className="bg-[#1e2a42]/95 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4 shadow-[0_0_30px_rgba(101,215,255,0.1)]">
              {isThinking && (
                <div className="flex items-center gap-2 text-cyan-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>AI is reasoning...</span>
                </div>
              )}
              {aiResponse && !isThinking && (
                <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{aiResponse}</div>
              )}
              {/* Plan suggestion preview with ARM button */}
              {planSuggestion && !isThinking && (
                <div className="mt-3 p-3 bg-cyan-950/30 border border-cyan-700/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-cyan-400 uppercase tracking-wider">📋 Plan v{planSuggestion.version} — {planSuggestion.status}</span>
                    <span className="text-xs text-zinc-400">{planSuggestion.mission.startCapital}→${planSuggestion.mission.targetCapital.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-300 mb-2">{planSuggestion.strategy}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleArmPlan}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      ✓ ARM PLAN
                    </button>
                    <button
                      onClick={() => setPlanSuggestion(null)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ACTIVE PLAN STATUS BAR ──────────────────────── */}
        {planState && planState.status === 'ARMED' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-950/60 border border-emerald-500/40 rounded-full backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="text-emerald-300 text-xs uppercase tracking-wider font-semibold">PLAN v{planState.version} ARMED</span>
              <span className="text-emerald-400/70 text-xs">{planState.mission.targetCapital.toLocaleString()} target</span>
              <button
                onClick={handleRevokePlan}
                className="ml-2 px-2.5 py-1 rounded-full bg-red-950/60 border border-red-700/40 text-red-300 text-xs hover:bg-red-900/60 transition-colors"
              >
                REVOKE
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ─── BOTTOM CONTROL DECK: AI COMPOSER ──────────────── */}
      <footer className="p-4 bg-[#151d2e]/95 border-t border-zinc-600/50 z-20">
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
