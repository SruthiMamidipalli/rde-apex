/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Apex Command Center palette (from apex_command_center.html)
        apex: {
          bg: "#0d0f14",
          surface: "#151820",
          surface2: "#1c2030",
          surface3: "#232840",
          border: "#2a3050",
          text: "#e8eaf2",
          muted: "#7a82a0",
          accent: "#4f6ef7",
          accent2: "#6ee7b7",
          red: "#f87171",
          orange: "#fb923c",
          yellow: "#fbbf24",
          green: "#34d399",
          amber: "#f59e0b",
        },
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
