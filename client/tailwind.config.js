/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bee: {
          yellow: '#f7da21',
          gold: '#e6a817',
          gray: '#e6e6e6',
          dark: '#333333',
        },
      },
    },
  },
  plugins: [],
};
