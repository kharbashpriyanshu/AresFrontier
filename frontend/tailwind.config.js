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
        atlas: {
          bg: 'var(--atlas-bg)',
          surface: 'var(--atlas-surface)',
          elevated: 'var(--atlas-elevated)',
          border: 'var(--atlas-border)',
          'border-light': 'var(--atlas-border-light)',
          text: 'var(--atlas-text)',
          muted: 'var(--atlas-muted)',
          accent: 'var(--atlas-accent)',
          'accent-dark': 'var(--atlas-accent-dark)',
          'accent-glow': 'var(--atlas-accent-glow)',
          teal: 'var(--atlas-teal)',
          amber: 'var(--atlas-amber)',
          red: 'var(--atlas-red)',
          blue: 'var(--atlas-blue)',
          violet: 'var(--atlas-violet)',
        },
        // Backward-compatible mappings so existing components remain fully functional
        space: {
          950: 'var(--atlas-bg)',
          900: 'var(--atlas-surface)',
          850: 'var(--atlas-elevated)',
          800: 'var(--atlas-border)',
          750: 'var(--atlas-border-light)',
          700: 'var(--atlas-border-light)',
          600: 'var(--atlas-muted)',
        },
        mars: {
          accent: 'var(--atlas-accent)',
          rust: 'var(--atlas-accent-dark)',
          ochre: '#df7a36',
          sand: '#d2a079',
          glow: 'var(--atlas-accent-glow)',
        },
        telemetry: {
          cyan: 'var(--atlas-blue)',
          emerald: 'var(--atlas-teal)',
          amber: 'var(--atlas-amber)',
          rose: 'var(--atlas-red)',
          muted: 'var(--atlas-muted)',
        }
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        editorial: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['Inter', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      }
    },
  },
  plugins: [],
}
