/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [UnoCSS(), solid()],
  server: { port: 5173 },
  // pure data-layer tests: no DOM needed (vite-plugin-solid would otherwise pick jsdom)
  test: { environment: "node" },
});
