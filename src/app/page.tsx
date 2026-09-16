'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Header from '@/components/Header';
import PortfolioCards from '@/components/PortfolioCards';
import PriceGrid from '@/components/PriceGrid';
import PriceChart from '@/components/PriceChart';
import TradeHistory from '@/components/TradeHistory';
import SettingsModal from '@/components/SettingsModal';
import DecisionBoard from '@/components/DecisionBoard';
import Footer from '@/components/Footer';
import type { StatusResponse, Trade, Opportunity } from '@/lib/types';

export default function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedToken, setSelectedToken] = useState('AFOB');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBoard, setShowBoard] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [s, t, o] = await Promise.all([
        api.getStatus(),
        api.getTrades(),
        api.getOpportunities(),
      ]);
      setStatus(s);
      setTrades(t);
      setOpportunities(o);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-[#050608] text-white flex flex-col justify-between">
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {error && (
        <div className="mx-6 mt-2 px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* ─── DECISION BOARD VIEW (PRIMARY DEFAULT) ─── */}
      {showBoard ? (
        <div className="p-3 sm:p-4 flex-1 flex flex-col">
          {/* Subtle View Switcher & Settings Bar */}
          <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-mono text-zinc-600">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-semibold tracking-wider">MAUREDGE LIVING BOARD</span>
              <span>•</span>
              <span>AUTONOMOUS OPERATING ENVIRONMENT</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className="hover:text-zinc-400 transition-colors"
              >
                ⚙ Settings
              </button>
              <span>•</span>
              <button
                onClick={() => setShowBoard(false)}
                className="hover:text-zinc-400 transition-colors"
              >
                Classic Dashboard ↗
              </button>
            </div>
          </div>

          <DecisionBoard />
        </div>
      ) : (
        /* ─── CLASSIC DASHBOARD VIEW ──────────────── */
        <div className="flex-1">
          <Header onOpenSettings={() => setSettingsOpen(true)} />
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => setShowBoard(true)}
              className="px-3 py-1 rounded text-xs font-mono bg-cyan-400/20 text-cyan-300 border border-cyan-400/30"
            >
              🧠 RETURN TO LIVING DECISION BOARD
            </button>
          </div>
          <PortfolioCards status={status} loading={loading} />
          <PriceGrid
            opportunities={opportunities}
            selectedToken={selectedToken}
            onSelect={setSelectedToken}
            loading={loading}
          />
          <div className="grid grid-cols-2 gap-4 px-6 mt-1">
            <PriceChart token={selectedToken} opportunities={opportunities} />
            <TradeHistory trades={trades} loading={loading} />
          </div>
          <Footer />
        </div>
      )}
    </div>
  );
}
