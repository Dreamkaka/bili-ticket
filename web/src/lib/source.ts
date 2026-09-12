import { guides, articles } from ".source/server";
import { loader } from "fumadocs-core/source";

export const guidesSource = loader({
  baseUrl: "/guides",
  source: guides.toFumadocsSource(),
});

export const articlesSource = loader({
  baseUrl: "/articles",
  source: articles.toFumadocsSource(),
});
