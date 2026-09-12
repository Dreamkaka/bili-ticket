import { listArticleCards } from "@/lib/articles";
import Home from "./page-client";

export default function HomePage() {
  const articles = listArticleCards();
  return <Home articles={articles} />;
}
