import { articlesSource } from "@/lib/source";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function ArticlePage(props: PageProps) {
  const params = await props.params;
  const page = articlesSource.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;
  const customData = page.data as unknown as {
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
    <article className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-8">
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-foreground/60 hover:text-accent transition-colors"
        >
          <span>←</span>
          <span>返回文章列表</span>
        </Link>
      </div>

      <header className="mb-10 pb-8 border-b border-border/60">
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60 font-mono mb-4">
          <span className="text-foreground/90 font-medium">
            {customData.author || "票务监控"}
          </span>
          {date && <span>• 发布于 {date}</span>}
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
          {page.data.title}
        </h1>

        {customData.summary && (
          <p className="mt-4 text-base text-foreground/75 leading-relaxed bg-panel/50 p-4 border-l-2 border-accent">
            {customData.summary}
          </p>
        )}

        {customData.tags && customData.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {customData.tags.map((tag: string) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs bg-panel border border-border text-foreground/70"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="prose prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-accent hover:prose-a:underline">
        <MDX />
      </div>
    </article>
  );
}

export async function generateStaticParams() {
  return articlesSource.generateParams();
}

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const page = articlesSource.getPage(params.slug);

  if (!page) notFound();

  const customData = page.data as unknown as { summary?: string };

  return {
    title: `${page.data.title} | 文章与复盘`,
    description: page.data.description || customData.summary,
  };
}
