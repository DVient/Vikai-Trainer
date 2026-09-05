/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Team-skin roles — resolved from CSS variables set on the root
        // layout (src/lib/theme.ts computes them from the two team colors).
        app: "var(--vk-app)",
        card: "var(--vk-card)",
        edge: "var(--vk-edge)",
        "edge-soft": "var(--vk-edge-soft)",
        "edge-mid": "var(--vk-edge-mid)",
        soft: "var(--vk-soft)",
        strong: "var(--vk-strong)",
        body: "var(--vk-body)",
        faint: "var(--vk-faint)",
        accent: "var(--vk-accent)",
        onaccent: "var(--vk-on-accent)",
        go: "var(--vk-go)",
        "go-soft": "var(--vk-go-soft)",
        "go-line": "var(--vk-go-line)",
        modulate: "var(--vk-modulate)",
        "modulate-soft": "var(--vk-modulate-soft)",
        "modulate-line": "var(--vk-modulate-line)",
        shield: "var(--vk-shield)",
        "shield-soft": "var(--vk-shield-soft)",
        "shield-line": "var(--vk-shield-line)",
      },
    },
  },
  plugins: [],
};
