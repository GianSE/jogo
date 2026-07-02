/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cozy: {
          bg: "#1b1726",
          panel: "#2a2438",
          accent: "#e8a0bf",
          soft: "#f4e4d7",
        },
      },
    },
  },
  plugins: [],
};
