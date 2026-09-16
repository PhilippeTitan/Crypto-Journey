'use client';

import type { StatusResponse } from '@/lib/types';

interface Props {
  status: StatusResponse | null;
  loading: boolean;
}

function StatCard({
  title,
  value,
  valueClass = '',
  subtitle,
  subtitleClass = '',
}: {
  title: string;
  value: string;
  valueClass?: string;
  subtitle: string;
  subtitleClass?: string;
}) {
  return (
    <div className="relative bg-gradient-to-br from-bg-card to-bg-cardHover border border-border rounded-xl p-5 card-glow overflow-hidden">
      <div className="text-[12px] uppercase tracking-[1.5px] text-accent-muted font-semibold mb-2">
        {title}
      </div>
      <div className={`text-[32px] font-bold tracking-tight ${valueClass}`}>{value}</div>
      <div className={`text-sm text-accent-gray mt-1 ${subtitleClass}`}>{subtitle}</div>
    </div>
  );
}

export default function PortfolioCards({ status, loading }: Props) {
  if (loading || !status) {
    return (
      <div className="grid grid-cols-4 gap-4 px-6 py-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="relative bg-bg-card border border-border rounded-xl p-5 h-[120px] animate-pulse card-glow" />
        ))}
      </div>
    );
  }

  const mission = status.mission;
  const positions = status.positions || [];
  const autonomy = status.autonomy;

  const totalValue = positions.reduce((s, p) => s + (p.value_usd || 0), 0);
  const totalPnl = positions.reduce((s, p) => s + (p.pnl_usd || 0), 0);
  const totalCost = positions.reduce((s, p) => s + (p.entry_price * p.quantity || 0), 0);
  const roi = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;
  const best = positions.length > 0
    ? positions.reduce((a, b) => (a.pnl_percent > b.pnl_percent ? a : b))
    : null;

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-5">
      <StatCard
        title="💰 Portfolio Value"
        value={`$${totalValue.toFixed(2)}`}
        valueClass="text-accent-green"
        subtitle={`from $${mission?.start_value?.toFixed(2) ?? '—'} · ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
        subtitleClass={roi >= 0 ? 'text-accent-green' : 'text-accent-red'}
      />
      <StatCard
        title="📈 Total P&L"
        value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
        valueClass={totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}
        subtitle={`${positions.length} open position${positions.length !== 1 ? 's' : ''}`}
      />
      <StatCard
        title="⚡ Autonomy"
        value={autonomy?.mode?.toUpperCase() ?? '—'}
        valueClass="text-accent-blue"
        subtitle={`Risk: ${autonomy?.risk_level ?? '—'} · Max: $${autonomy?.max_position_usd ?? 0}`}
      />
      <StatCard
        title="🏆 Best Position"
        value={best ? `${best.pnl_percent >= 0 ? '+' : ''}${best.pnl_percent.toFixed(1)}%` : '—'}
        valueClass="text-accent-yellow"
        subtitle={best ? best.token_symbol : 'No positions'}
      />
    </div>
  );
}
