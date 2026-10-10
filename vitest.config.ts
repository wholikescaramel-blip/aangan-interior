import { defineConfig } from "vitest/config";
import path from "node:path";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch {}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { include: ["tests/unit/**/*.test.ts"], testTimeout: 30000 },
});
