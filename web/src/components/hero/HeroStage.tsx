"use client";

import { memo } from "react";
import type { Project, Ticket } from "@/lib/types";
import { FeatureBanner } from "./FeatureBanner";
import { scrollToId } from "@/lib/command";

export const HeroStage = memo(function HeroStage({
  projects,
  focusProject,
  focusTickets,
  focusIndex,
  userLocked,
  onResumeAutoplay,
  registerProgressEl,
}: {
  projects: Project[];
  focusProject: Project | null;
  focusTickets: Ticket[];
  focusIndex: number;
  userLocked: boolean;
  onResumeAutoplay: () => void;
  registerProgressEl?: (el: HTMLElement | null) => void;
}) {
  const onOpenProject = () => {
    if (focusProject?.id) {
      scrollToId(`project-${focusProject.id}`);
      return;
    }
    scrollToId("projects");
  };

  return (
    <section id="home" className="relative pt-14 lg:pt-16">
      {/* 明确视口高度，保证 Banner justify-end 贴底 */}
      <div className="relative h-[calc(100dvh-3.5rem)] w-full lg:h-[calc(100dvh-4rem)]">
        <FeatureBanner
          project={focusProject}
          tickets={focusTickets}
          index={focusIndex}
          total={projects.length}
          userLocked={userLocked}
          onResumeAutoplay={onResumeAutoplay}
          registerProgressEl={registerProgressEl}
          onOpenProject={onOpenProject}
        />
      </div>
    </section>
  );
});
