import type { LinkItemType } from "fumadocs-ui/layouts/shared";

export const SITE_TITLE = (
  <span className="inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
    <span className="inline-block h-1.5 w-1.5 bg-accent" />
    我tm票呢
  </span>
);

export const SITE_LINKS: LinkItemType[] = [
  { text: "首页", url: "/" },
  { text: "攻略", url: "/guides" },
  { text: "文章", url: "/articles" },
];
