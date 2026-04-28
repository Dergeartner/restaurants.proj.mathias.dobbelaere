import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lieferando: {
          DEFAULT: "#FF8000",
          dark: "#E07300",
          50: "#FFF4E6",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
