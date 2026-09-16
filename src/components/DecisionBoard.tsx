'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * MaurEdge 3.0 — Living Decision Board
 * 
 * Visualizes the runCycle() pipeline as a live node graph.
 * Nodes reveal themselves as the agent activates them —
 * the UI is a live projection of the architecture while the agent is using it.
 */

type NodeStatus = 'idle' | 'active' | 'done' | 'tripped' | 'rejected' | 'error';

interface BoardNode {
  status: NodeStatus;
  lastActive: string | null;
  data: Record<string, unknown> | null;
}

interface BoardState {
  running: boolean;
  currentStep: string | null;
  cycleCount: number;
  lastCycleAt: string | null;
  nodes: Record<string, BoardNode>;
  lastResult?: Record<string, unknown>;
}

interface EventEntry {
  timestamp: string;
  node: string;
  status: string;
  data: unknown;
}

// ─── NODE DEFINITIONS ──────────────────────────────────────

const NODE_DEFS = [
  { id: 'mission',   label: 'MISSION',    x: 2,  y: 1, color: 'cyan',    icon: '🎯' },
  { id: 'state',     label: 'STATE',      x: 2,  y: 3, color: 'emerald', icon: '📦' },
  { id: 'breakers',  label: 'BREAKERS',   x: 2,  y: 5, color: 'amber',   icon: '⚡' },
  { id: 'positions', label: 'POSITIONS',  x: 5,  y: 1, color: 'green',   icon: '💰' },
  { id: 'discover',  label: 'DISCOVER',   x: 5,  y: 3, color: 'violet',  icon: '🔍' },
  { id: 'features',  label: 'FEATURES',   x: 5,  y: 5, color: 'blue',    icon: '📊' },
  { id: 'regime',    label: 'REGIME',     x: 8,  y: 1, color: 'orange',  icon: '🌡️' },
  { id: 'context',   label: 'CONTEXT',    x: 8,  y: 3, color: 'indigo',  icon: '🔗' },
  { id: 'ai',        label: 'AI',         x: 11, y: 1, color: 'purple',  icon: '🧠' },
  { id: 'validate',  label: 'VALIDATE',   x: 11, y: 3, color: 'yellow',  icon: '✅' },
  { id: 'risk',      label: 'RISK',       x: 11, y: 5, color: 'red',     icon: '🛡️' },
  { id: 'exec',      label: 'EXECUTE',    x: 14, y: 2, color: 'emerald', icon: '⚡' },
  { id: 'outcome',   label: 'OUTCOME',    x: 14, y: 4, color: 'cyan',    icon: '📋' },
] as const;

// Pipeline edges for drawing connections
const PIPELINE_EDGES = [
  ['mission', 'state'], ['state', 'breakers'],
  ['breakers', 'positions'], ['positions', 'discover'],
  ['discover', 'features'], ['features', 'regime'],
  ['regime', 'context'], ['context', 'ai'],
  ['ai', 'validate'], ['validate', 'risk'],
  ['risk', 'exec'], ['exec', 'outcome'],
];

// ─── STATUS STYLES ─────────────────────────────────────────

const STATUS_STYLES: Record<NodeStatus, { bg: string; border: string; text: string; glow: string }> = {
  idle:     { bg: 'bg-zinc-800/40', border: 'border-zinc-700/30', text: 'text-zinc-500', glow: '' },
  active:   { bg: 'bg-zinc-800/80', border: 'border-cyan-400/60', text: 'text-cyan-300', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.3)]' },
  done:     { bg: 'bg-zinc-800/60', border: 'border-emerald-500/50', text: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.2)]' },
  tripped:  { bg: 'bg-zinc-800/60', border: 'border-amber-500/60', text: 'text-amber-400', glow: 'shadow-[0_0_16px_rgba(245,158,11,0.3)]' },
  rejected: { bg: 'bg-zinc-800/60', border: 'border-red-500/50', text: 'text-red-400', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.2)]' },
  error:    { bg: 'bg-zinc-800/60', border: 'border-red-500/50', text: 'text-red-400', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.2)]' },
};

// ─── MAIN COMPONENT ────────────────────────────────────────

export default function DecisionBoard() {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [inspectorNode, setInspectorNode] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [connected, setConnected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── POLL BOARD STATE ────────────────────────────────────
  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch('/api/board?mode=full');
      const data = await res.json();
      if (data.success) {
        setBoard(data.state);
        setEvents(data.state.eventStream || []);
        setConnected(true);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    intervalRef.current = setInterval(fetchBoard, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchBoard]);

  // ─── CANVAS PULSE ANIMATION ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw edges
      for (const [fromId, toId] of PIPELINE_EDGES) {
        const from = NODE_DEFS.find(n => n.id === fromId);
        const to = NODE_DEFS.find(n => n.id === toId);
        if (!from || !to) continue;

        const fromNode = board?.nodes?.[fromId];
        const toNode = board?.nodes?.[toId];
        const isActive = fromNode?.status === 'active' || toNode?.status === 'active';
        const isDone = fromNode?.status === 'done' && (toNode?.status === 'done' || toNode?.status === 'active');

        const fx = (from.x / 16) * w;
        const fy = (from.y / 7) * h;
        const tx = (to.x / 16) * w;
        const ty = (to.y / 7) * h;

        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = isActive
          ? 'rgba(34, 211, 238, 0.6)'
          : isDone
          ? 'rgba(16, 185, 129, 0.3)'
          : 'rgba(113, 113, 122, 0.15)';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Pulse dot on active edges
        if (isActive) {
          const t = (Date.now() % 2000) / 2000;
          const px = fx + (tx - fx) * t;
          const py = fy + (ty - fy) * t;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [board]);

  // ─── COMMAND HANDLER ─────────────────────────────────────
  const handleCommand = async () => {
    if (!command.trim()) return;
    const cmd = command.trim().toUpperCase();

    if (cmd === 'RUN CYCLE' || cmd === 'RUN') {
      // Trigger a cycle via the backend
      try {
        await fetch('/api/board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' }),
        });
      } catch { /* ignore */ }
    }

    if (cmd === 'STATUS') {
      fetchBoard();
    }

    setCommand('');
  };

  // ─── RENDER ──────────────────────────────────────────────
  const activeNode = inspectorNode ? board?.nodes?.[inspectorNode] : null;
  const activeNodeDef = inspectorNode ? NODE_DEFS.find(n => n.id === inspectorNode) : null;

  return (
    <div className="relative w-full h-[600px] bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-hidden">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${board?.running ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-xs font-mono text-zinc-400">
            LIVING DECISION BOARD
          </span>
          <span className="text-xs font-mono text-zinc-500">
            Cycle #{board?.cycleCount || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-[10px] font-mono text-zinc-500">
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* ─── CANVAS (edge animations) ───────────────── */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* ─── NODES ──────────────────────────────────── */}
      <div className="absolute inset-0">
        {NODE_DEFS.map(def => {
          const node = board?.nodes?.[def.id];
          const status = node?.status || 'idle';
          const style = STATUS_STYLES[status];
          const isActive = status === 'active';

          return (
            <button
              key={def.id}
              onClick={() => setInspectorNode(inspectorNode === def.id ? null : def.id)}
              className={`
                absolute flex flex-col items-center justify-center
                w-[80px] h-[64px] rounded-lg border
                transition-all duration-300 cursor-pointer
                hover:scale-105 hover:z-20
                ${style.bg} ${style.border} ${style.glow}
                ${inspectorNode === def.id ? 'ring-1 ring-cyan-400/40 z-20' : ''}
              `}
              style={{
                left: `${(def.x / 16) * 100}%`,
                top: `${(def.y / 7) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="text-base">{def.icon}</span>
              <span className={`text-[9px] font-mono font-bold ${style.text}`}>
                {def.label}
              </span>
              {isActive && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── RIGHT SIDEBAR: EVENT STREAM ────────────── */}
      <div className="absolute top-10 right-0 w-[180px] h-[calc(100%-80px)] overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
        <div className="text-[9px] font-mono text-zinc-500 mb-2 px-1">EVENT STREAM</div>
        {[...events].reverse().slice(0, 20).map((ev, i) => (
          <div key={i} className="text-[10px] font-mono text-zinc-400 px-1 py-0.5 border-l border-zinc-700/50">
            <span className="text-zinc-600">{new Date(ev.timestamp).toLocaleTimeString()}</span>
            {' '}
            <span className={
              ev.status === 'done' ? 'text-emerald-400' :
              ev.status === 'active' ? 'text-cyan-400' :
              ev.status === 'tripped' || ev.status === 'rejected' ? 'text-amber-400' :
              'text-zinc-400'
            }>
              {ev.node}
            </span>
            <span className="text-zinc-600"> → {ev.status}</span>
          </div>
        ))}
      </div>

      {/* ─── INSPECTOR PANEL ────────────────────────── */}
      {inspectorNode && activeNode && activeNodeDef && (
        <div className="absolute bottom-14 left-0 right-[200px] z-30 mx-4">
          <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-lg p-3 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{activeNodeDef.icon}</span>
                <span className="text-xs font-mono font-bold text-white">{activeNodeDef.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  activeNode.status === 'active' ? 'bg-cyan-400/20 text-cyan-300' :
                  activeNode.status === 'done' ? 'bg-emerald-400/20 text-emerald-300' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {activeNode.status}
                </span>
              </div>
              <button onClick={() => setInspectorNode(null)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>
            {activeNode.data && (
              <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap max-h-20 overflow-y-auto">
                {JSON.stringify(activeNode.data, null, 2)}
              </pre>
            )}
            {activeNode.lastActive && (
              <div className="text-[9px] text-zinc-600 mt-1">
                Last active: {new Date(activeNode.lastActive).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── COMMAND BAR ────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-zinc-900/90 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-zinc-600 text-sm">›</span>
          <input
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCommand()}
            placeholder="COMMAND (RUN CYCLE / STATUS)"
            className="flex-1 bg-transparent text-xs font-mono text-zinc-300 placeholder-zinc-600 outline-none"
          />
          <button
            onClick={handleCommand}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded bg-cyan-400/10"
          >
            EXEC
          </button>
        </div>
      </div>
    </div>
  );
}
