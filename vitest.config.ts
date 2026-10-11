import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws unless it is resolved under the react-server condition.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  // tsconfig leaves JSX for Next to compile, so the runner is told how to handle it
  // directly. Components render to a string; nothing here needs a DOM.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    /**
     * The suite runs as a configured deployment would: `@/lib/tiers` reads the product
     * ids at module load.
     */
    env: {
      NEXT_PUBLIC_CREEM_PRODUCT_PLUS: "prod_test_plus",
      NEXT_PUBLIC_CREEM_PRODUCT_PRO: "prod_test_pro",
      NEXT_PUBLIC_CREEM_PRODUCT_KEEP_FOREVER: "prod_test_keep_forever",
    },
  },
});
