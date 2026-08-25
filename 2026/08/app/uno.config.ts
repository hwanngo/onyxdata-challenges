import { defineConfig, presetUno } from "unocss";

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      bg: "var(--bg)",
      ink: "var(--ink)",
      muted: "var(--ink-muted)",
      accent: "var(--accent)",
      good: "var(--good)",
      bad: "var(--fault)",
      warn: "var(--warn)",
    },
    fontFamily: {
      display: "var(--font-display)",
      body: "var(--font-body)",
      num: "var(--font-num)",
    },
  },
  shortcuts: {
    "sr-only":
      "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]",
  },
});
