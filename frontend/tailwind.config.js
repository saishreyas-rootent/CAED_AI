/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c1d2ff',
          300: '#92b0ff',
          400: '#5c81ff',
          500: '#3350ff',
          600: '#1a2bff',
          700: '#0a17ff',
          800: '#0510d4',
          900: '#0d15a3',
          950: '#080c61',
        },
      }
    },
  },
  plugins: [],
}
