import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // packages/core validates process.env at import time, so tests that
  // touch it (directly or transitively) need .env loaded the same way
  // the dev scripts load it via --env-file.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    test: {
      passWithNoTests: true,
    },
  };
});
