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
        sans: ["'Noto Sans KR'", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        // Material 3 — Teal + Ivory
        md: {
          primary: "#00897B",
          "primary-light": "#4DB6AC",
          "primary-dark": "#00695C",
          "on-primary": "#FFFFFF",
          secondary: "#546E7A",
          "secondary-light": "#78909C",
          surface: "#FAFAF5",
          "surface-dim": "#F0EFE9",
          "surface-container": "#FFFFFF",
          "surface-high": "#EDEDEB",
          "on-surface": "#1C1B1F",
          "on-surface-variant": "#49454F",
          outline: "#CAC4D0",
          "outline-variant": "#E7E0EC",
          error: "#B3261E",
        },
        surge: {
          low: "#94a3b8",
          mid: "#60a5fa",
          high: "#f97316",
        },
      },
      borderRadius: {
        "m3-sm": "8px",
        "m3-md": "12px",
        "m3-lg": "16px",
        "m3-xl": "28px",
      },
      boxShadow: {
        "m3-1": "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        "m3-2": "0 2px 6px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.06)",
        "m3-3": "0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
