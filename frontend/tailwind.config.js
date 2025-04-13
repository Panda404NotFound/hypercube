/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#00B4D8",
          dark: "#0077B6",
          light: "#90E0EF",
        },
        secondary: {
          DEFAULT: "#7209B7",
          dark: "#560BAD",
          light: "#B5179E",
        },
        background: {
          DEFAULT: "#0A0A10",
          dark: "#050508",
          light: "#121218",
        },
        accent: {
          DEFAULT: "#4CC9F0",
          alt: "#F72585",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%": { filter: "brightness(1)" },
          "100%": { filter: "brightness(1.5)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
}; 