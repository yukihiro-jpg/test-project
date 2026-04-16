import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        income: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
        },
        expense: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
    },
  },
  plugins: [],
}
export default config
