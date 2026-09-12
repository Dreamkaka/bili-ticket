"use client";

import Link from "next/link";
import type { ArticleCard } from "@/lib/articles";

export function ArticlePane({ articles }: { articles: ArticleCard[] }) {
  if (articles.length === 0) {
    return (
      <p className="theme-ink-faint py-10 text-center text-sm">暂无推荐文章</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {articles.map((post) => (
        <Link
          key={post.url}
          href={post.url}
          className="ak-panel block p-4 transition-colors hover:border-accent/50"
        >
          <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] text-[var(--ink-faint)]">
            <span>{post.date || "未标注日期"}</span>
            {post.tags[0] ? <span>#{post.tags[0]}</span> : null}
          </div>
          <h3 className="theme-ink text-sm font-semibold">{post.title}</h3>
          {post.description ? (
            <p className="theme-ink-faint mt-1.5 line-clamp-2 text-xs leading-relaxed">
              {post.description}
            </p>
          ) : null}
          <p className="mt-3 font-mono text-[11px] text-accent">阅读全文 -&gt;</p>
        </Link>
      ))}
    </div>
  );
}
