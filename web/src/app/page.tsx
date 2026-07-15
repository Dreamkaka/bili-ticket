"use client";

import { useCallback, useState } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useProjectCarousel } from "@/hooks/useProjectCarousel";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useDiffToasts } from "@/hooks/useDiffToasts";
import { useNotifications } from "@/hooks/useNotifications";
import { BootSequence } from "@/components/boot/BootSequence";
import type { BootPhase } from "@/hooks/useBootProgress";
import { PageBackground } from "@/components/layout/PageBackground";
import { SiteNav } from "@/components/layout/SiteNav";
import { DashboardFooter } from "@/components/layout/DashboardFooter";
import { DisconnectOverlay } from "@/components/layout/DisconnectOverlay";
import { WsProgressBar } from "@/components/layout/WsProgressBar";
import { SectionTitle } from "@/components/layout/SectionTitle";
import { RevealSection } from "@/components/layout/RevealSection";
import { HeroStage } from "@/components/hero/HeroStage";
import { KpiStrip } from "@/components/metrics/KpiStrip";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { EventStream } from "@/components/events/EventStream";
import { StockChart } from "@/components/events/StockChart";
import { NodePanel } from "@/components/nodes/NodePanel";
import { CommandPalette } from "@/components/command/CommandPalette";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import {
  EventCalendar,
  useEventDayCount,
} from "@/components/calendar/EventCalendar";

export default function Home() {
  const {
    connectionStatus,
    projects,
    nodes,
    tickets,
    diffs,
    stockHistory,
    lastUpdate,
    availableTickets,
    onlineNodes,
    systemHealthy,
  } = useTelemetry();

  const [bootPhase, setBootPhase] = useState<BootPhase>("loading");
  const isBooting = bootPhase !== "done";
  const showMain =
    bootPhase === "wipe-in" || bootPhase === "wipe-out" || bootPhase === "done";

  const dataReady = connectionStatus === "connected" || lastUpdate != null;

  const {
    focusProject,
    focusTickets,
    focusIndex,
    userLocked,
    selectProject,
    selectFromDiff,
    resumeAutoplay,
    registerProgressEl,
  } = useProjectCarousel(showMain ? projects : [], showMain ? tickets : []);

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

  const eventDayCount = useEventDayCount(showMain ? projects : []);

  const finishBoot = useCallback(() => setBootPhase("done"), []);
  const handlePhase = useCallback((phase: BootPhase) => {
    setBootPhase(phase);
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--background)]">
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
          <PageBackground project={focusProject} />
          <WsProgressBar
            lastUpdate={lastUpdate}
            connectionStatus={connectionStatus}
          />

          <div className="relative z-10 min-h-[100dvh]">
            <SiteNav
              connectionStatus={connectionStatus}
              systemHealthy={systemHealthy}
              lastUpdate={lastUpdate}
              onOpenCommand={bootDone ? openPalette : undefined}
              onOpenNotifications={bootDone ? openNotifications : undefined}
              unreadCount={unreadCount}
            />

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

            <DisconnectOverlay visible={connectionStatus === "disconnected"} />

            <HeroStage
              projects={projects}
              focusProject={focusProject}
              focusTickets={focusTickets}
              focusIndex={focusIndex}
              userLocked={userLocked}
              onResumeAutoplay={resumeAutoplay}
              registerProgressEl={registerProgressEl}
            />

            <div className="relative w-full space-y-8 px-3 py-8 sm:space-y-10 sm:px-6 sm:py-12 lg:space-y-14 lg:px-8">
              <RevealSection>
                <KpiStrip
                  projects={projects.length}
                  available={availableTickets}
                  online={onlineNodes}
                  events={diffs.length}
                />
              </RevealSection>

              <RevealSection
                id="calendar"
              >
                <SectionTitle
                  en="CALENDAR"
                  title="活动日历"
                  description="根据项目举办日期标记，点击日期查看当日活动"
                  meta={`${eventDayCount} DAYS`}
                />
                <EventCalendar
                  projects={projects}
                  tickets={tickets}
                  onSelectProject={selectProject}
                />
              </RevealSection>

              <RevealSection
                id="projects"
              >
                <SectionTitle
                  en="PROJECTS"
                  title="监控项目"
                  description="展开查看票档价格与库存"
                  meta={`${projects.length} UNITS`}
                />
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="min-w-0 xl:col-span-7">
                    <ProjectGrid
                      projects={projects}
                      tickets={tickets}
                      highlightId={focusProject?.id}
                    />
                  </div>
                  <div className="min-w-0 xl:col-span-5">
                    <EventStream diffs={diffs} onSelectDiff={selectFromDiff} />
                  </div>
                </div>
              </RevealSection>

              <RevealSection
                id="trends"
              >
                <SectionTitle
                  en="TRENDS"
                  title="库存趋势"
                  description="基于状态变动推送的余量采样"
                  meta={`${stockHistory.length} PTS`}
                />
                <StockChart data={stockHistory} />
              </RevealSection>

              <RevealSection
                id="nodes"
              >
                <SectionTitle
                  en="NODES"
                  title="采集节点"
                  description="主探针分片任务 · 辅助监测全量冗余"
                  meta={`ONLINE // ${onlineNodes}`}
                />
                <NodePanel nodes={nodes} />
              </RevealSection>
            </div>

            <DashboardFooter lastUpdate={lastUpdate} />
          </div>
        </>
      )}
    </div>
  );
}
