'use client';

import type { Opportunity } from '@/lib/types';

interface Props {
  opportunities: Opportunity[];
  selectedToken: string;
  onSelect: (symbol: string) => void;
  loading: boolean;
}

export default function PriceGrid({ opportunities, selectedToken, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="px-6 pb-5">
        <div className="relative bg-bg-card border border-border rounded-xl p-5 card-glow">
          <div className="text-[12px] uppercase tracking-[1.5px] text-accent-muted font-semibold mb-4">
            📡 Live Market Prices
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#0d1220] border border-[#1a2240] rounded-lg p-4 h-[100px] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pb-5">
      <div className="relative bg-bg-card border border-border rounded-xl p-5 card-glow">
        <div className="text-[12px] uppercase tracking-[1.5px] text-accent-muted font-semibold mb-4">
          📡 Live Market Prices
        </div>
        <div className="grid grid-cols-3 gap-3">
          {opportunities.length === 0 && (
            <div className="col-span-3 text-center text-accent-gray py-8">
              No market data yet — waiting for discovery pipeline...
            </div>
          )}
          {opportunities.map((opp) => {
            const isActive = opp.token_symbol === selectedToken;
            const m5 = opp.change_5m ?? 0;
            const h1 = opp.change_1h ?? 0;
            const color = m5 >= 0 ? 'text-accent-green' : 'text-accent-red';

            return (
              <button
                key={opp.id}
                onClick={() => onSelect(opp.token_symbol)}
                className={`text-left bg-[#0d1220] border rounded-lg p-4 transition-all hover:-translate-y-0.5
                  ${isActive ? 'border-accent-blue shadow-[0_0_20px_rgba(0,212,255,0.1)]' : 'border-[#1a2240] hover:border-accent-purple'}`}
              >
                <div className={`text-base font-bold ${color}`}>{opp.token_symbol}</div>
                <div className="text-xl font-semibold my-1 font-mono">
                  ${(opp.price ?? 0) < 0.01
                    ? (opp.price ?? 0).toFixed(8)
                    : (opp.price ?? 0).toFixed(4)}
                </div>
                <div className={`text-[13px] font-semibold ${color}`}>
                  5m: {m5 >= 0 ? '+' : ''}{m5.toFixed(2)}% · 1h: {h1 >= 0 ? '+' : ''}{h1.toFixed(2)}%
                </div>
                <div className="text-[11px] text-accent-muted mt-1.5">
                  Score: {opp.score?.toFixed(1) ?? '—'} · Liq: ${((opp.liquidity ?? 0) / 1000).toFixed(1)}k
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
