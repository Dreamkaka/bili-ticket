"use client";

import { useCallback, useState } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useProjectCarousel } from "@/hooks/useProjectCarousel";
import { useWsUpdateProgress } from "@/hooks/useWsUpdateProgress";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { BootSequence } from "@/components/boot/BootSequence";
import type { BootPhase } from "@/hooks/useBootProgress";
import { PageBackground } from "@/components/layout/PageBackground";
import { SiteNav } from "@/components/layout/SiteNav";
import { DashboardFooter } from "@/components/layout/DashboardFooter";
import { DisconnectOverlay } from "@/components/layout/DisconnectOverlay";
import { WsProgressBar } from "@/components/layout/WsProgressBar";
import { SectionTitle } from "@/components/layout/SectionTitle";
import { HeroStage } from "@/components/hero/HeroStage";
import { KpiStrip } from "@/components/metrics/KpiStrip";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { EventStream } from "@/components/events/EventStream";
import { StockChart } from "@/components/events/StockChart";
import { NodePanel } from "@/components/nodes/NodePanel";
import { CommandPalette } from "@/components/command/CommandPalette";
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
  // 仅在青色过场开始后挂载主界面，避免加载期穿帮
  const showMain =
    bootPhase === "wipe-in" || bootPhase === "wipe-out" || bootPhase === "done";

  const dataReady = connectionStatus === "connected" || lastUpdate != null;

  const {
    focusProject,
    focusTickets,
    focusIndex,
    progress,
    userLocked,
    selectProject,
    selectFromDiff,
    resumeAutoplay,
  } = useProjectCarousel(showMain ? projects : [], showMain ? tickets : []);

  const wsProgress = useWsUpdateProgress(
    showMain ? lastUpdate : null,
    showMain ? connectionStatus : "connecting"
  );

  const bootDone = bootPhase === "done";
  const {
    open: commandOpen,
    setOpen: setCommandOpen,
    openPalette,
  } = useCommandPalette({ enabled: bootDone });

  const eventDayCount = useEventDayCount(showMain ? projects : []);

  const finishBoot = useCallback(() => setBootPhase("done"), []);
  const handlePhase = useCallback((phase: BootPhase) => {
    setBootPhase(phase);
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--background)]">
      {/* 首屏只出加载层；数据在后台由 useTelemetry 拉取 */}
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
          <WsProgressBar progress={wsProgress} connectionStatus={connectionStatus} />

          <div className="relative z-10 min-h-[100dvh]">
            <SiteNav
              connectionStatus={connectionStatus}
              systemHealthy={systemHealthy}
              lastUpdate={lastUpdate}
              onOpenCommand={bootDone ? openPalette : undefined}
            />

            {bootDone && (
              <CommandPalette
                open={commandOpen}
                onOpenChange={setCommandOpen}
                projects={projects}
                connectionStatus={connectionStatus}
                lastUpdate={lastUpdate}
                systemHealthy={systemHealthy}
                onSelectProject={selectProject}
              />
            )}

            <DisconnectOverlay visible={connectionStatus === "disconnected"} />

            <HeroStage
              projects={projects}
              tickets={tickets}
              diffs={diffs}
              focusProject={focusProject}
              focusTickets={focusTickets}
              focusIndex={focusIndex}
              progress={progress}
              userLocked={userLocked}
              onSelectDiff={selectFromDiff}
              onResumeAutoplay={resumeAutoplay}
            />

            <div className="relative w-full space-y-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:space-y-14">
              <section className="section-block animate-fade-in-up">
                <KpiStrip
                  projects={projects.length}
                  available={availableTickets}
                  online={onlineNodes}
                  events={diffs.length}
                />
              </section>

              <section id="calendar" className="section-block animate-fade-in-up anim-delay-1">
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
              </section>

              <section id="projects" className="section-block animate-fade-in-up anim-delay-2">
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
              </section>

              <section id="trends" className="section-block animate-fade-in-up anim-delay-3">
                <SectionTitle
                  en="TRENDS"
                  title="库存趋势"
                  description="基于状态变动推送的余量采样"
                  meta={`${stockHistory.length} PTS`}
                />
                <StockChart data={stockHistory} mounted />
              </section>

              <section id="nodes" className="section-block animate-fade-in-up anim-delay-3">
                <SectionTitle
                  en="NODES"
                  title="采集节点"
                  description="心跳与任务分配"
                  meta={`ONLINE // ${onlineNodes}`}
                />
                <NodePanel nodes={nodes} />
              </section>
            </div>

            <DashboardFooter lastUpdate={lastUpdate} />
          </div>
        </>
      )}
    </div>
  );
}
