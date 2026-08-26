/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        carbon: "#111111",
        bone: "#F7F7F5",
        primary: {
          DEFAULT: "#1E5B4F",
          dark: "#164A40",
        },
        accent: "#2ECC71",
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        sans: ['Inter', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
