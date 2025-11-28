/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Optional: Add semantic colors if we want to clean up the hardcoded values later
        // But for now we'll stick to dark: modifiers
      }
    },
  },
  plugins: [],
}
