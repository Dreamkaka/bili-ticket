// source.config.ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
var guides = defineDocs({
  dir: "content/guides"
});
var articles = defineDocs({
  dir: "content/articles"
});
var source_config_default = defineConfig();
export {
  articles,
  source_config_default as default,
  guides
};
