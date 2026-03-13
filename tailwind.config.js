/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:        ["'Jost'", 'sans-serif'],
        display:     ["'Playfair Display'", 'serif'],
        handwriting: ["'Caveat'", 'cursive'],
      },
    },
  },
  plugins: [],
}
