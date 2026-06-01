import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cores Bendito Lanches
        'bendito-verde': {
          escuro: '#1A3A1A',
          DEFAULT: '#2D5F2D',
          claro: '#4A8F4A',
        },
        'bendito-dourado': {
          escuro: '#B8935F',
          DEFAULT: '#D4A574',
          claro: '#E6C9A0',
        },
        'bendito-creme': {
          escuro: '#E8E0D0',
          DEFAULT: '#F5F1E8',
          claro: '#FFFEF8',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
