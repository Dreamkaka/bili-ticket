"use client";

import dynamic from "next/dynamic";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Spinner } from "@/components/ui/Spinner";
import { useTelemetry } from "@/hooks/useTelemetry";
import { SITE_LINKS, SITE_TITLE } from "@/lib/site-nav";

const ExhibitionMap = dynamic(
  () =>
    import("@/components/map/ExhibitionMap").then((mod) => mod.ExhibitionMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--ink-faint)]">
        <Spinner size={16} />
        加载地图…
      </div>
    ),
  }
);

export function ExhibitionMapPage() {
  const { projects, connectionStatus, lastUpdate } = useTelemetry();
  const loading = connectionStatus === "connecting" && lastUpdate == null;

  return (
    <HomeLayout
      className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden [--fd-layout-width:100%]"
      nav={{ title: SITE_TITLE, url: "/" }}
      links={SITE_LINKS}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--ink-faint)]">
            <Spinner size={16} />
            加载展会数据…
          </div>
        ) : (
          <ExhibitionMap projects={projects} />
        )}
      </div>
      <SiteFooter connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
    </HomeLayout>
  );
}
