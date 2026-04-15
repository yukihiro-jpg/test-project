import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 資料の配色（黒・赤（悪化）・青（改善）の3色原則）
        improved: '#1e40af', // blue-800
        worsened: '#b91c1c', // red-700
        neutral: '#111827',  // gray-900
      },
      fontFamily: {
        sans: ['Hiragino Sans', 'Yu Gothic', 'Meiryo', 'system-ui', 'sans-serif'],
        serif: ['Hiragino Mincho ProN', 'Yu Mincho', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
