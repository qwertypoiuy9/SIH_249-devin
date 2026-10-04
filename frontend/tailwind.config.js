/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#070b12", 900: "#0b111c", 850: "#0f1724", 800: "#131d2d", 700: "#1c2940", 600: "#2a3a57" },
      },
      fontFamily: { mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
    },
  },
  plugins: [],
};
