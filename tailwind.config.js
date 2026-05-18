/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Flat surface tokens (avoids @apply issues with nested keys)
        'surface-base':   '#ffffff',
        'surface-raised': '#f8fafc',
        'surface-border': '#e2e8f0',
        'surface-muted':  '#f1f5f9',
        // Flat ink tokens
        'ink':            '#0f172a',
        'ink-muted':      '#64748b',
        'ink-faint':      '#94a3b8',
        // Accent
        accent: {
          green:  '#10b981',
          yellow: '#f59e0b',
          red:    '#ef4444',
          purple: '#8b5cf6',
        },
        // Keep pitch tokens so old refs don't break
        pitch: {
          dark:  '#ffffff',
          mid:   '#f8fafc',
          light: '#f1f5f9',
        },
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body:    ['Exo 2', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'pitch-gradient': 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #f8fafc 100%)',
        'card-gradient':  'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.8) 100%)',
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.05)',
        'card-md':  '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
        'brand-sm': '0 1px 3px 0 rgba(37,99,235,0.15)',
      },
      animation: {
        'slide-in':   'slideIn 0.25s ease-out',
        'fade-in':    'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideIn: {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
