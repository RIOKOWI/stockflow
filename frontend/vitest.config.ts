import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    test: {
      include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
      env: {
        VITE_API_BASE_URL: env.VITE_API_BASE_URL,
      },
    },
  };
});
