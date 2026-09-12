import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const guides = defineDocs({
  dir: "content/guides",
});

export const articles = defineDocs({
  dir: "content/articles",
});

export default defineConfig();
