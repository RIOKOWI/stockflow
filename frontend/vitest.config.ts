import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    test: {
      environment: "jsdom",
      // jsdom enforces CORS, so the test origin must be one the backend allows.
      environmentOptions: { jsdom: { url: "http://localhost:5173" } },
      include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
      setupFiles: ["src/test/setup.ts"],
      env: {
        VITE_API_BASE_URL: env.VITE_API_BASE_URL,
      },
    },
  };
});
