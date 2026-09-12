import { articlesSource } from "@/lib/source";

export type ArticleCard = {
  url: string;
  title: string;
  description: string;
  date: string | null;
  tags: string[];
};

export function listArticleCards(): ArticleCard[] {
  return articlesSource.getPages().map((post) => {
    const custom = post.data as unknown as {
      date?: string | Date;
      tags?: string[];
      summary?: string;
    };
    const date = custom.date
      ? new Date(custom.date).toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;
    return {
      url: post.url,
      title: post.data.title,
      description: custom.summary || post.data.description || "",
      date,
      tags: custom.tags ?? [],
    };
  });
}
