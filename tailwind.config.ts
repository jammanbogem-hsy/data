import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        surge: {
          low: "#94a3b8",
          mid: "#60a5fa",
          high: "#f97316",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
