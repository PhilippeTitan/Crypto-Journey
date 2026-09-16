import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0e17',
          card: '#111827',
          cardHover: '#0f1523',
          input: '#0a0e17',
        },
        border: {
          DEFAULT: '#1e2a4a',
          hover: '#7b68ee',
        },
        accent: {
          green: '#00ff88',
          red: '#ff4757',
          blue: '#00d4ff',
          purple: '#7b68ee',
          yellow: '#ffd93d',
          gray: '#8892a8',
          muted: '#5a6480',
          dim: '#3a4560',
        },
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
      animation: {
        'pulse-dot': 'pulse 2s infinite',
        'flash-green': 'flashG 0.5s',
        'flash-red': 'flashR 0.5s',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        flashG: {
          '0%': { background: 'rgba(0,255,136,0.2)' },
          '100%': { background: 'transparent' },
        },
        flashR: {
          '0%': { background: 'rgba(255,71,87,0.2)' },
          '100%': { background: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
