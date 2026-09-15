import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // A 1984 desktop: paper windows on a grey desk, hairlines instead of
        // boxes, and one accent colour used sparingly.
        paper: "#ffffff",
        desk: "#e7e6e1",
        ink: "#14141a",
        quiet: "#6b6b75",
        hair: "#d9d8d2",
        maple: "#d8232a",
        blush: "#fdeeed",
        mint: "#0a7d55",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: ["var(--font-display)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        window: "3px 3px 0 rgba(20, 20, 26, 0.10)",
        key: "2px 2px 0 rgba(20, 20, 26, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
