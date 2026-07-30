import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, "..", "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    base: command === "build" ? "/static/" : "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": proxyTarget,
        "/public": proxyTarget,
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{js,jsx}"],
        exclude: ["src/main.jsx", "src/test/**"],
        thresholds: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  };
});
