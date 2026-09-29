/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B0E1A",        // page background
        panel: "#131829",       // cards / sidebar / nav
        panelAlt: "#1A2036",    // slightly raised panel (active states)
        line: "#242B45",        // borders
        ink: "#E8E6E0",         // primary text (light on dark)
        muted: "#8B93AC",       // secondary text
        gold: "#D9A94F",        // brand accent, active states, headings
        tfidf: "#3FA796",       // teal
        sbert: "#D97748",       // amber/orange
        meta: "#8B7FD1",        // purple
        cs: "#5B8DEF",          // Computer Science tag
        math: "#4FAF6D",        // Mathematics tag
      },
      fontFamily: {
        serif: ["Source Serif 4", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
