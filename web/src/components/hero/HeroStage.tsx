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
    <section
      id="home"
      /* 顶栏：手机两行 ~6.5rem；桌面单行 3.5/4rem；含 safe-area */
      className="relative pt-[calc(6.25rem+env(safe-area-inset-top,0px))] md:pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-[calc(4rem+env(safe-area-inset-top,0px))]"
    >
      <div className="relative h-[min(92dvh,calc(100dvh-6.25rem-env(safe-area-inset-top,0px)))] w-full md:h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-4rem-env(safe-area-inset-top,0px))]">
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
