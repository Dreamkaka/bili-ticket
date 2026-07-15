export type CommandGroup = "nav" | "action" | "project";

export type CommandItem = {
  id: string;
  group: CommandGroup;
  label: string;
  description?: string;
  keywords: string[];
  shortcut?: string;
  run: () => void;
};

export const GROUP_LABEL: Record<CommandGroup, string> = {
  nav: "导航",
  action: "操作",
  project: "项目",
};

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

export function modKeyLabel(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function matchesQuery(item: CommandItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [item.label, item.description ?? "", ...item.keywords]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}
