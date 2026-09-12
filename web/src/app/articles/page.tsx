import Link from "next/link";
import { articlesSource } from "@/lib/source";

export const metadata = {
  title: "文章与资讯 | 票务监控平台",
  description: "演出资讯、架构设计演进与抢票数据复盘分析",
};

export default function ArticlesPage() {
  const posts = articlesSource.getPages();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-12 border-b border-border/60 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 bg-accent animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-accent">
            Articles & Insights
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          文章与架构复盘
        </h1>
        <p className="mt-3 text-sm text-foreground/70 max-w-2xl">
          深度解析高可用票务监控架构演进、算法分片以及历史开票真实数据分析。
        </p>
      </header>

      <div className="grid gap-6">
        {posts.map((post) => {
          const customData = post.data as unknown as {
            author?: string;
            date?: string | Date;
            tags?: string[];
            summary?: string;
          };

          const date = customData.date
            ? new Date(customData.date).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : null;

          return (
            <Link
              key={post.url}
              href={post.url}
              className="group block p-6 bg-panel/40 hover:bg-panel border border-border/80 hover:border-accent/60 transition-all duration-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/50 mb-3 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-foreground/80 font-medium">
                    {customData.author || "票务监控"}
                  </span>
                  {date && <span>• {date}</span>}
                </div>
                {customData.tags && customData.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {customData.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[10px] bg-surface border border-border text-foreground/70"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                {post.data.title}
              </h2>

              {(customData.summary || post.data.description) && (
                <p className="mt-2 text-sm text-foreground/70 line-clamp-2 leading-relaxed">
                  {customData.summary || post.data.description}
                </p>
              )}

              <div className="mt-4 flex items-center gap-1 text-xs font-mono text-accent group-hover:translate-x-1 transition-transform">
                <span>阅读全文</span>
                <span>→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
