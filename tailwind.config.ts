import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#b5dcff',
          300: '#88c6ff',
          400: '#5eaeff',
          500: '#2e8cff',
          600: '#1e6ee6',
          700: '#1757b8',
          800: '#164a94',
          900: '#163f78',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(31, 38, 135, 0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
