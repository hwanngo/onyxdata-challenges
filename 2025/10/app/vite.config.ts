import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [UnoCSS(), solid()],
  server: { port: 5173 },
  // DuckDB-WASM needs cross-origin isolation for its threaded build
  optimizeDeps: { exclude: ["@duckdb/duckdb-wasm"] },
});
