// @ts-nocheck
import * as __fd_glob_2 from "../content/guides/index.mdx?collection=guides"
import * as __fd_glob_1 from "../content/guides/bilibili-tips.mdx?collection=guides"
import * as __fd_glob_0 from "../content/articles/architecture-overview.mdx?collection=articles"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const articles = await create.docs("articles", "content/articles", {}, {"architecture-overview.mdx": __fd_glob_0, });

export const guides = await create.docs("guides", "content/guides", {}, {"bilibili-tips.mdx": __fd_glob_1, "index.mdx": __fd_glob_2, });