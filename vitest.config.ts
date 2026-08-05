import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws unless it is resolved under the react-server
      // condition. Under test we only care that the module graph loads.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  // tsconfig leaves JSX for Next to compile, so the test runner is told how to
  // handle it directly. Components are rendered to a string with
  // react-dom/server; nothing here needs a DOM.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
