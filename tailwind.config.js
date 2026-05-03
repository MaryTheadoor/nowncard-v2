/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        space: '#0a0e1a',
        'space-2': '#111827',
        tile: '#171f33',
        'tile-soft': '#1e2942',
        ink: '#f8f9fc',
        'ink-muted': '#94a3b8',
        'ink-faint': '#64748b',
        line: '#243044',
        'line-soft': '#1a2335',
        accent: '#c9a278',
        'accent-hover': '#d4b08a',
        success: '#5eead4',
        danger: '#f87171',
        'card-bg': '#f4f1ec',
        'card-text': '#2a2520',
        'card-muted': '#6b6256',
        'card-faint': '#9a9186',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '20px',
      },
      boxShadow: {
        'card': '0 24px 60px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.2)',
        'surface': '0 8px 32px rgba(0,0,0,0.35)',
      },
      animation: {
        'spin-slow': 'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
}
