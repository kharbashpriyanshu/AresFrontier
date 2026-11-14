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
          bg: '#080F19',
          surface: '#132536',
          elevated: '#1B3041',
          border: '#223A4E',
          'border-light': '#2E4A62',
          text: '#F2F3F0',
          muted: '#91A5B5',
          accent: '#FA7955',
          'accent-dark': '#E0623E',
          'accent-hover': '#FF916D',
          'accent-glow': 'rgba(250, 121, 85, 0.25)',
          teal: '#2CB9B1',
          amber: '#E8AE62',
          red: '#E57373',
          blue: '#549ED8',
          violet: '#9784CD',
        },
        // Backward-compatible mappings
        space: {
          950: '#080F19',
          900: '#132536',
          850: '#1B3041',
          800: '#223A4E',
          750: '#2E4A62',
          700: '#2E4A62',
          600: '#91A5B5',
        },
        mars: {
          accent: '#FA7955',
          rust: '#E0623E',
          ochre: '#df7a36',
          sand: '#d2a079',
          glow: 'rgba(250, 121, 85, 0.25)',
        },
        telemetry: {
          cyan: '#549ED8',
          emerald: '#2CB9B1',
          amber: '#E8AE62',
          rose: '#E57373',
          muted: '#91A5B5',
        }
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        editorial: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'Inter', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
        xl: '8px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      }
    },
  },
  plugins: [],
}
