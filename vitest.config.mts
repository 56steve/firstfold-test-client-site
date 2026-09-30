import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: { alias: [{ find: /^@\/(.*)$/, replacement: `${root}$1` }] },
  test: { environment: "node", include: ["lib/**/*.test.ts", "app/**/*.test.ts"] },
});
