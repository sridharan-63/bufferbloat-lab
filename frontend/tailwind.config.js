/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060a14',
          900: '#0a0f1d',
          850: '#0e172a',
          800: '#131f37',
          750: '#172542',
          700: '#1e293b',
          600: '#334155',
        },
        brand: {
          cyan: '#00f0ff',
          teal: '#06b6d4',
          blue: '#3b82f6',
          indigo: '#6366f1',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
        glow: '0 0 25px rgba(0, 240, 255, 0.15)',
        'glow-rose': '0 0 25px rgba(239, 68, 68, 0.2)',
        'glow-emerald': '0 0 25px rgba(16, 185, 129, 0.2)',
      }
    },
  },
  plugins: [],
}
