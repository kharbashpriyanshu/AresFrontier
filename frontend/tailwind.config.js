/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#07090e',
          900: '#0b0f19',
          850: '#111726',
          800: '#172033',
          700: '#222f4b',
          600: '#334466',
        },
        mars: {
          accent: '#e26d46',
          rust: '#c1440e',
          ochre: '#df7a36',
          sand: '#d2a079',
          glow: 'rgba(226, 109, 70, 0.25)',
        },
        telemetry: {
          cyan: '#38bdf8',
          emerald: '#34d399',
          amber: '#fbbf24',
          rose: '#f43f5e',
          muted: '#94a3b8',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
