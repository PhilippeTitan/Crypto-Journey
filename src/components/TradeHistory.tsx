'use client';

import type { Trade } from '@/lib/types';

interface Props {
  trades: Trade[];
  loading: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TradeHistory({ trades, loading }: Props) {
  return (
    <div className="relative bg-gradient-to-br from-bg-card to-bg-cardHover border border-border rounded-xl p-5 card-glow overflow-hidden">
      <div className="text-[12px] uppercase tracking-[1.5px] text-accent-muted font-semibold mb-3">
        📋 Trade History
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-[#0d1220] rounded animate-pulse" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center text-accent-gray py-8 text-sm">No trades yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {['Token', 'Action', 'Price', 'Value', 'P&L', 'Time'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[11px] uppercase tracking-[1px] text-accent-muted pb-2.5 pt-2 px-3 border-b border-border font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="hover:bg-accent-purple/5 transition-colors">
                  <td className="py-3 px-3 text-sm font-bold text-white">{t.token_symbol}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide
                        ${t.action === 'BUY'
                          ? 'bg-accent-green/15 text-accent-green'
                          : 'bg-accent-red/15 text-accent-red'}`}
                    >
                      {t.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm font-mono">${(t.price ?? 0).toFixed(6)}</td>
                  <td className="py-3 px-3 text-sm">${(t.value_usd ?? 0).toFixed(2)}</td>
                  <td className="py-3 px-3">
                    <span className={`text-sm font-semibold ${(t.pnl_percent ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {(t.pnl_percent ?? 0) >= 0 ? '+' : ''}{(t.pnl_percent ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-accent-gray">
                    {t.created_at ? timeAgo(t.created_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
