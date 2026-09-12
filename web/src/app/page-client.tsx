"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useDiffToasts } from "@/hooks/useDiffToasts";
import { useNotifications } from "@/hooks/useNotifications";
import { BootSequence } from "@/components/boot/BootSequence";
import type { BootPhase } from "@/hooks/useBootProgress";
import { DisconnectOverlay } from "@/components/layout/DisconnectOverlay";
import { WsProgressBar } from "@/components/layout/WsProgressBar";
import { ExhibitionHero } from "@/components/hero/ExhibitionHero";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { EventStream } from "@/components/events/EventStream";
import { NodePanel } from "@/components/nodes/NodePanel";
import { CommandPalette } from "@/components/command/CommandPalette";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { EventCalendar } from "@/components/calendar/EventCalendar";
import { HomePane } from "@/components/home/HomePane";
import { HomeRail } from "@/components/home/HomeRail";
import { TicketPane } from "@/components/home/TicketPane";
import { ArticlePane } from "@/components/home/ArticlePane";
import { NavExtras } from "@/components/layout/NavExtras";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getFeaturedInfo } from "@/lib/featured";
import { useProjectCarousel } from "@/hooks/useProjectCarousel";
import { scrollToId } from "@/lib/command";
import { SITE_LINKS, SITE_TITLE } from "@/lib/site-nav";
import type { ArticleCard } from "@/lib/articles";
import type { Diff } from "@/lib/types";

export default function Home({
  articles = [],
}: {
  articles?: ArticleCard[];
}) {
  const {
    connectionStatus,
    projects,
    nodes,
    tickets,
    diffs,
    lastUpdate,
    availableTickets,
    onlineNodes,
    systemHealthy,
  } = useTelemetry();

  const [bootReady, setBootReady] = useState(false);
  const [bootPhase, setBootPhase] = useState<BootPhase>("loading");
  const isBooting = bootReady && bootPhase !== "done";
  const showMain =
    !bootReady ||
    bootPhase === "wipe-in" ||
    bootPhase === "wipe-out" ||
    bootPhase === "done";

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ticket-boot-done") === "1") {
        setBootPhase("done");
      }
    } catch {
      /* ignore */
    }
    setBootReady(true);
  }, []);

  const dataReady = connectionStatus === "connected" || lastUpdate != null;

  const {
    focusProject,
    focusIndex,
    total: projectTotal,
    userLocked,
    cycle,
    selectProject: lockProject,
    resumeAutoplay,
  } = useProjectCarousel(showMain ? projects : [], showMain);

  const featured = useMemo(
    () => getFeaturedInfo(focusProject),
    [focusProject]
  );
  const featuredTickets = useMemo(
    () =>
      focusProject
        ? tickets.filter((t) => t.project_id === focusProject.id)
        : [],
    [focusProject, tickets]
  );

  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimerRef = useRef(0);

  const selectProject = useCallback(
    (id: string) => {
      lockProject(id);
      setHighlightId(id);
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(
        () => setHighlightId(null),
        2600
      );
    },
    [lockProject]
  );

  const selectFromDiff = useCallback(
    (diff: Diff) => {
      const pid =
        diff.project_id ||
        projects.find((p) => p.id === diff.ticket_id)?.id ||
        projects.find(
          (p) => p.name && diff.ticket_name && diff.ticket_name.includes(p.name)
        )?.id;
      if (pid) selectProject(pid);
      scrollToId("pane-tickets");
    },
    [projects, selectProject]
  );

  useEffect(() => () => window.clearTimeout(highlightTimerRef.current), []);

  const bootDone = bootPhase === "done";
  const {
    open: commandOpen,
    setOpen: setCommandOpen,
    openPalette,
  } = useCommandPalette({ enabled: bootDone });

  const {
    open: notifyOpen,
    setOpen: setNotifyOpen,
    openPanel: openNotifications,
    unreadCount,
  } = useNotifications(diffs, bootDone);

  useDiffToasts({
    diffs,
    enabled: bootDone,
    onSelectDiff: selectFromDiff,
  });

  const finishBoot = useCallback(() => {
    try {
      sessionStorage.setItem("ticket-boot-done", "1");
    } catch {
      /* ignore */
    }
    setBootPhase("done");
  }, []);
  const handlePhase = useCallback((phase: BootPhase) => {
    setBootPhase(phase);
  }, []);

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none bg-[var(--background)] pt-[env(safe-area-inset-top,0px)]">
      {isBooting && (
        <BootSequence
          onDone={finishBoot}
          onPhaseChange={handlePhase}
          ready={dataReady}
          connectionStatus={connectionStatus}
        />
      )}

      {showMain && (
        <>
          <WsProgressBar
            lastUpdate={lastUpdate}
            connectionStatus={connectionStatus}
          />
          <DisconnectOverlay visible={connectionStatus === "disconnected"} />

          {bootDone && (
            <>
              <CommandPalette
                open={commandOpen}
                onOpenChange={setCommandOpen}
                projects={projects}
                connectionStatus={connectionStatus}
                lastUpdate={lastUpdate}
                systemHealthy={systemHealthy}
                onSelectProject={selectProject}
                onOpenNotifications={openNotifications}
              />
              <NotificationCenter
                open={notifyOpen}
                onOpenChange={setNotifyOpen}
                diffs={diffs}
                onSelectDiff={selectFromDiff}
              />
            </>
          )}

          <HomeLayout
            className="flex min-h-0 flex-1 flex-col overflow-hidden [--fd-layout-width:100%]"
            nav={{
              title: SITE_TITLE,
              url: "/",
              transparentMode: "none",
            }}
            links={[
              ...SITE_LINKS,
              {
                type: "custom",
                secondary: true,
                children: (
                  <NavExtras
                    connectionStatus={connectionStatus}
                    systemHealthy={systemHealthy}
                    lastUpdate={lastUpdate}
                    unreadCount={unreadCount}
                    onOpenCommand={bootDone ? openPalette : undefined}
                    onOpenNotifications={bootDone ? openNotifications : undefined}
                  />
                ),
              },
            ]}
          >
            <HomeRail>
              <HomePane id="pane-hero" index="01" title="HERO" grow flush>
                <ExhibitionHero
                  featured={featured}
                  tickets={featuredTickets}
                  loading={!dataReady}
                  connectionStatus={connectionStatus}
                  systemHealthy={systemHealthy}
                  lastUpdate={lastUpdate}
                  availableTickets={availableTickets}
                  onlineNodes={onlineNodes}
                  projectCount={projects.length}
                  eventCount={diffs.length}
                  focusIndex={focusIndex}
                  projectTotal={projectTotal}
                  userLocked={userLocked}
                  cycle={cycle}
                  onResumeAutoplay={resumeAutoplay}
                />
              </HomePane>

              <HomePane id="pane-tickets" index="02" title="TICKETS" flush width="min(88vw, 420px)">
                <TicketPane
                  project={featured?.project ?? null}
                  tickets={featuredTickets}
                  projects={projects}
                  allTickets={tickets}
                  diffs={diffs}
                  focusIndex={focusIndex}
                  projectTotal={projectTotal}
                  userLocked={userLocked}
                  onSelectProject={selectProject}
                  onResumeAutoplay={resumeAutoplay}
                />
              </HomePane>

              <HomePane id="pane-events" index="03" title="EVENTS" flush width="min(88vw, 460px)">
                <EventStream diffs={diffs} onSelectDiff={selectFromDiff} />
              </HomePane>

              <HomePane id="pane-nodes" index="04" title="NODES" width="min(88vw, 520px)">
                <NodePanel nodes={nodes} />
              </HomePane>

              <HomePane id="pane-projects" index="05" title="PROJECTS" width="min(92vw, 560px)">
                <ProjectGrid
                  projects={projects}
                  tickets={tickets}
                  highlightId={highlightId}
                />
              </HomePane>

              <HomePane id="pane-articles" index="06" title="ARTICLES" width="min(88vw, 420px)">
                <ArticlePane articles={articles} />
              </HomePane>

              <HomePane id="pane-calendar" index="07" title="CALENDAR" width="min(96vw, 760px)">
                <EventCalendar
                  projects={projects}
                  tickets={tickets}
                  onSelectProject={selectProject}
                />
              </HomePane>
            </HomeRail>
            <SiteFooter
              connectionStatus={connectionStatus}
              lastUpdate={lastUpdate}
            />
          </HomeLayout>
        </>
      )}
    </div>
  );
}
