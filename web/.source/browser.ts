// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  articles: create.doc("articles", {"architecture-overview.mdx": () => import("../content/articles/architecture-overview.mdx?collection=articles"), }),
  guides: create.doc("guides", {"bilibili-tips.mdx": () => import("../content/guides/bilibili-tips.mdx?collection=guides"), "index.mdx": () => import("../content/guides/index.mdx?collection=guides"), }),
};
export default browserCollections;