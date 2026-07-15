"use client";

import { useState } from "react";
import type { Diff, Project, Ticket } from "@/lib/types";
import type { FeedFilter } from "@/lib/diff";
import { FeatureBanner } from "./FeatureBanner";
import { NewsSidebar } from "./NewsSidebar";

export function HeroStage({
  projects,
  tickets,
  diffs,
  focusProject,
  focusTickets,
  focusIndex,
  progress,
  userLocked,
  onSelectDiff,
  onResumeAutoplay,
}: {
  projects: Project[];
  tickets: Ticket[];
  diffs: Diff[];
  focusProject: Project | null;
  focusTickets: Ticket[];
  focusIndex: number;
  progress: number;
  userLocked: boolean;
  onSelectDiff: (diff: Diff) => void;
  onResumeAutoplay: () => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  // 默认收纳
  const [feedExpanded, setFeedExpanded] = useState(false);

  const onOpenProject = () => {
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="home"
      className="relative grid min-h-[100dvh] grid-cols-1 pt-14 lg:grid-cols-12 lg:pt-16"
    >
      <div
        className={`relative z-10 transition-all duration-500 ease-out ${
          feedExpanded
            ? "lg:col-span-4 xl:col-span-4"
            : "lg:col-span-3 xl:col-span-3"
        }`}
      >
        <NewsSidebar
          diffs={diffs}
          filter={filter}
          onFilterChange={setFilter}
          focusProject={focusProject}
          focusTickets={focusTickets}
          onSelectDiff={onSelectDiff}
          onOpenProject={onOpenProject}
          expanded={feedExpanded}
          onExpandedChange={setFeedExpanded}
        />
      </div>
      <div
        className={`relative min-h-[50vh] transition-all duration-500 ease-out lg:min-h-0 ${
          feedExpanded
            ? "lg:col-span-8 xl:col-span-8"
            : "lg:col-span-9 xl:col-span-9"
        }`}
      >
        <FeatureBanner
          project={focusProject}
          tickets={focusTickets}
          index={focusIndex}
          total={projects.length}
          progress={progress}
          userLocked={userLocked}
          onResumeAutoplay={onResumeAutoplay}
        />
      </div>
    </section>
  );
}
