import { defineConfig } from "vitest/config";

// Content scripts can't be ES modules, so each entry is bundled as a single IIFE, one
// build per entry: `vite build` for the content script, `--mode popup` for the popup
// and `--mode background` for the background script.
const ENTRIES = ["popup", "background"];

export default defineConfig(({ mode }) => {
  const entry = ENTRIES.includes(mode) ? mode : "content";
  return {
    build: {
      outDir: "dist",
      // The content script is built first; the other entries are added beside it.
      emptyOutDir: entry === "content",
      target: "firefox140",
      minify: false,
      lib: {
        entry: `src/${entry}.ts`,
        formats: ["iife"],
        name: "sousChefox",
        fileName: () => `${entry}.js`,
      },
    },
    test: {
      environment: "jsdom",
    },
  };
});
