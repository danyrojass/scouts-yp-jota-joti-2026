/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          50: "#f2f7f1",
          100: "#e0ece0",
          200: "#c2d9c3",
          300: "#97bd9b",
          400: "#679b6e",
          500: "#457f4d",
          600: "#33663a",
          700: "#29512f",
          800: "#234128",
          900: "#1c3622",
          950: "#0f1f13",
        },
        beige: {
          50: "#faf7f0",
          100: "#f2ecda",
          200: "#e5d7b4",
          300: "#d5bf8a",
          400: "#c5a566",
          500: "#b99150",
          600: "#a97c45",
          700: "#8d613b",
          800: "#734e35",
          900: "#5e412e",
        },
        clay: {
          400: "#f0a053",
          500: "#ec8b2d",
          600: "#d96f1b",
          700: "#b45517",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "cursive"],
        sans: ["'Nunito'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 8px rgba(31, 41, 55, 0.08), 0 1px 2px rgba(31, 41, 55, 0.06)",
        lift: "0 8px 20px rgba(31, 41, 55, 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};