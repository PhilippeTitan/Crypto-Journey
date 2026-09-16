'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Header from '@/components/Header';
import PortfolioCards from '@/components/PortfolioCards';
import PriceGrid from '@/components/PriceGrid';
import PriceChart from '@/components/PriceChart';
import TradeHistory from '@/components/TradeHistory';
import SettingsModal from '@/components/SettingsModal';
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
    <div className="min-h-screen bg-bg-primary text-white">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
          ⚠️ {error}
        </div>
      )}

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
  );
}
