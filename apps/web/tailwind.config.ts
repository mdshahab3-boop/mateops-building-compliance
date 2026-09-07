import type { Config } from "tailwindcss";

// T&M Management Services brand palette (teal/green + orange from their logo).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tm: {
          teal: "#0f7b7b",
          "teal-dark": "#0b5c5c",
          orange: "#e8622a",
          "orange-dark": "#c94e1b",
          ink: "#0f2a2a",
          mist: "#f3f7f7",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
