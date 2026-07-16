/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Apex palette — from apex-combined.html (magenta→purple brand).
        apex: {
          bg: "#f3f4f6",       // app background (soft grey)
          surface: "#ffffff",  // cards / panels
          surface2: "#f9fafb", // hover fills, subtle raised
          surface3: "#f3f4f6", // progress tracks, muted chips
          border: "#e5e7eb",   // hairline borders
          text: "#111111",     // near-black primary text
          muted: "#9ca3af",    // caption / placeholder text
          muted2: "#6b7280",   // secondary text (slightly darker)
          accent: "#7745e6",   // primary interactive (purple)
          brand1: "#c84b9e",   // brand gradient start (magenta)
          brand2: "#6a4ec8",   // brand gradient end (purple)
          ink: "#0a0a0a",      // primary button / high-contrast
          // Semantic (AI banner + KPI tones)
          red: "#ef4444",
          orange: "#f59e0b",
          yellow: "#eab308",
          green: "#10b981",
          amber: "#f59e0b",
          // Risk bands (from HTML band-dots)
          crit: "#FF3B30",
          high: "#FF9500",
          med: "#FFCC00",
          low: "#30D158",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg,#c84b9e,#6a4ec8)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 4px 16px rgba(16,24,40,0.04)",
        pop: "0 8px 32px rgba(16,24,40,0.12)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse2: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        pulse2: "pulse2 1.5s ease-in-out infinite",
        "slide-in": "slide-in 0.2s ease",
      },
    },
  },
  plugins: [],
};
