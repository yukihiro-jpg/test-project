import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#fbfbfd',
        surface: '#ffffff',
        'surface-muted': '#f5f5f7',
        ink: {
          DEFAULT: '#1d1d1f',
          soft: '#515154',
          mute: '#86868b',
        },
        accent: {
          DEFAULT: '#0071e3',
          hover: '#0077ed',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Yu Gothic"',
          'Meiryo',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
export default config
