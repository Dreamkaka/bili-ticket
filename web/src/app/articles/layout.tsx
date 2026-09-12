import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { SITE_LINKS, SITE_TITLE } from "@/lib/site-nav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      className="flex min-h-dvh flex-1 flex-col [--fd-layout-width:100%]"
      nav={{ title: SITE_TITLE, url: "/" }}
      links={SITE_LINKS}
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <SiteFooter />
    </HomeLayout>
  );
}
