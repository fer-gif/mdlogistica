/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mdbrand: {
          red: '#B71E23',
          redBright: '#CE2329',
          redDark: '#96171B',
          redSoft: '#FEF2F2',
          orange: '#F2851D',
          orangeSoft: '#FFF7ED',
          yellow: '#FFF000',
          charcoal: '#231F20',
          navy: '#141923',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
