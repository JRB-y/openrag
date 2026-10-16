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
      // Several test files are integration tests against the same live
      // local services (Postgres, Ollama, the ONNX reranker). Running
      // them in parallel workers makes them compete for the same CPU-
      // bound model inference and can blow past hook/test timeouts
      // under load; running files serially trades some wall-clock time
      // for reliability, which matters more here.
      fileParallelism: false,
    },
  };
});
