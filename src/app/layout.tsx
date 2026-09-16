import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '🚀 MaurEdge — Crypto Trading Terminal',
  description: 'MaurEdge 3.0 Autonomous Trading Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-white min-h-screen">{children}</body>
    </html>
  );
}
