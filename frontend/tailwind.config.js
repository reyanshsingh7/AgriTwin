/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agriGreen: '#2E7D32',
        agriLight: '#E8F5E9',
        agriDark: '#1B5E20'
      }
    },
  },
  plugins: [],
}
