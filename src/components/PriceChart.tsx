'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Opportunity } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface Props {
  token: string;
  opportunities: Opportunity[];
}

export default function PriceChart({ token, opportunities }: Props) {
  const opp = opportunities.find((o) => o.token_symbol === token);

  // For now, show current price point + simulated last 24 data points
  // In production this would come from /api/price-history
  const labels = Array.from({ length: 24 }, (_, i) => `${24 - i}h`);
  const basePrice = opp?.price ?? 0;
  const data = labels.map((_, i) => {
    const noise = Math.sin(i * 0.8) * basePrice * 0.05 + Math.cos(i * 1.3) * basePrice * 0.03;
    return basePrice + noise;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: token,
        data,
        borderColor: '#7b68ee',
        backgroundColor: 'rgba(123, 104, 238, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#7b68ee',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        borderColor: '#1e2a4a',
        borderWidth: 1,
        titleColor: '#8892a8',
        bodyColor: '#e1e5ee',
        bodyFont: { family: 'Courier New' },
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            ctx.parsed.y !== null ? `$${ctx.parsed.y.toFixed(6)}` : '',
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(30, 42, 74, 0.3)' },
        ticks: { color: '#5a6480', maxTicksLimit: 8 },
      },
      y: {
        grid: { color: 'rgba(30, 42, 74, 0.3)' },
        ticks: {
          color: '#5a6480',
          callback: (v: string | number) => `$${Number(v).toFixed(4)}`,
        },
      },
    },
  };

  return (
    <div className="relative bg-gradient-to-br from-bg-card to-bg-cardHover border border-border rounded-xl p-5 card-glow overflow-hidden">
      <div className="text-[12px] uppercase tracking-[1.5px] text-accent-muted font-semibold mb-2">
        📊 Price Chart — <span className="text-accent-blue">{token}</span>
      </div>
      <div className="h-[280px] mt-2">
        <Line data={chartData} options={options as never} />
      </div>
    </div>
  );
}
