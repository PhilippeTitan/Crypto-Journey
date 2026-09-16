'use client';

import { useState, useEffect } from 'react';

export default function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [time, setTime] = useState('--:--:--');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="bg-gradient-to-r from-[#0d1321] to-[#1a1f35] border-b border-border px-6 py-4 flex items-center justify-between">
      <h1 className="text-[22px] font-bold gradient-text">🚀 CRYPTO DASHBOARD</h1>
      <div className="flex items-center gap-3 text-[13px] text-accent-gray">
        <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse-dot" />
        <span>LIVE</span>
        <span className="ml-4 font-mono">{time}</span>
        <button
          onClick={onOpenSettings}
          className="ml-4 border border-[#2a3456] rounded-lg px-3 py-1.5 text-[13px] text-accent-gray
                     hover:border-accent-purple hover:text-white transition-all"
        >
          ⚙️ Settings
        </button>
      </div>
    </header>
  );
}
