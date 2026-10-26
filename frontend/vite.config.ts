/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// One .env at the repo root serves both apps. Vite only exposes variables prefixed VITE_,
// so backend secrets in the same file are never bundled into the frontend.
export default defineConfig({
  envDir: "..",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    // In development the API is same-origin through this proxy, so cookies and CORS behave like production.
    proxy: { "/api": { target: process.env["VITE_DEV_PROXY_TARGET"] ?? "http://localhost:5000", changeOrigin: false } },
  },
  build: { sourcemap: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    css: false,
  },
});
