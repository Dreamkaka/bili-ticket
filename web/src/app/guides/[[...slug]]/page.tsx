import { guidesSource } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/layouts/flux/page";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const page = guidesSource.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        <MDX />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return guidesSource.generateParams();
}

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const page = guidesSource.getPage(params.slug);

  if (!page) notFound();

  return {
    title: `${page.data.title} | 攻略中心`,
    description: page.data.description,
  };
}
