import type { Diff } from "@/lib/types";
import { isAvailableStatus, isSoldOutStatus } from "@/lib/status";

export type FeedFilter = "all" | "available" | "soldout" | "alert";

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "available", label: "可售" },
  { id: "soldout", label: "售罄" },
  { id: "alert", label: "告警" },
];

export function tagForDiff(diff: Diff): {
  label: string;
  tone: "accent" | "danger" | "default";
} {
  if (isAvailableStatus(diff.new_status)) return { label: "可售", tone: "accent" };
  if (isSoldOutStatus(diff.new_status)) return { label: "售罄", tone: "danger" };
  return { label: "变动", tone: "default" };
}

export function filterDiffs(diffs: Diff[], filter: FeedFilter): Diff[] {
  return diffs.filter((d) => {
    if (filter === "available") return isAvailableStatus(d.new_status);
    if (filter === "soldout") return isSoldOutStatus(d.new_status);
    if (filter === "alert")
      return !isAvailableStatus(d.new_status) && !isSoldOutStatus(d.new_status);
    return true;
  });
}
