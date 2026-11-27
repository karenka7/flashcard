import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the built site works in a subfolder
  // (sashalosh.shop/flashcards/) as well as at a domain root.
  base: "./",
});
