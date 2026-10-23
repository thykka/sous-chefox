import { defineConfig } from "vitest/config";

// Content scripts can't be ES modules, so the entry is bundled as a single IIFE.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "firefox140",
    minify: false,
    lib: {
      entry: "src/content.ts",
      formats: ["iife"],
      name: "sousChefox",
      fileName: () => "content.js",
    },
  },
  test: {
    environment: "jsdom",
  },
});
