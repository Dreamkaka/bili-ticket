"use client";

import type { ReactNode } from "react";
import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/flux";
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "fumadocs-ui/layouts/flux/slots/sidebar";
import { SITE_LINKS, SITE_TITLE } from "@/lib/site-nav";

function SidebarPassthrough({ children }: { children?: ReactNode }) {
  return children;
}

export function FluxShell({
  tree,
  children,
}: {
  tree: Root;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <DocsLayout
        tree={tree}
        nav={{
          title: SITE_TITLE,
          url: "/",
        }}
        links={SITE_LINKS}
        slots={{
          sidebar: {
            provider: SidebarPassthrough,
            trigger: SidebarTrigger,
            root: Sidebar,
            useSidebar,
          },
        }}
      >
        {children}
      </DocsLayout>
    </SidebarProvider>
  );
}
