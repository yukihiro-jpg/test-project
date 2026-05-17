import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hiragino Sans"', '"Yu Gothic"', 'Meiryo', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
