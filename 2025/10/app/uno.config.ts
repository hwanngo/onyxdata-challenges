import { defineConfig, presetUno } from "unocss";

/**
 * THIS MONTH'S IDENTITY LIVES HERE.
 *
 * Values from .workbench/2025/10/design/direction.md. Add values, not new token names - if you need a
 * token that doesn't exist, add it to packages/dna-kit/src/tokens/tokens.css first
 * so every future month can use it.
 *
 * This is why we use UnoCSS over Tailwind: each month reskins via its own preset
 * without forking a single dna-kit component.
 */
export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      bg: "var(--bg)",
      ink: "var(--ink)",
      muted: "var(--ink-muted)",
      accent: "var(--accent)",
      good: "var(--good)",
      bad: "var(--bad)",
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
