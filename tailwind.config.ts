import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        leaf: "#24735d",
        mint: "#dff3eb",
        sun: "#f4b942",
        coral: "#e06b5b"
      }
    }
  },
  plugins: []
};

export default config;
