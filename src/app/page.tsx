'use client';

import DecisionBoard from '@/components/DecisionBoard';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#151d2e] text-zinc-100 flex flex-col justify-between">
      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        <DecisionBoard />
      </div>
    </div>
  );
}
