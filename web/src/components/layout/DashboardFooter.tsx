import { formatClock } from "@/lib/status";

export function DashboardFooter({ lastUpdate }: { lastUpdate: number | null }) {
  return (
    <footer className="theme-nav border-t px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col items-start justify-between gap-3 text-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="theme-ink border-l-2 border-accent pl-2 font-medium tracking-wider">
            我tm票呢
          </span>
          <span className="theme-ink-faint tracking-[0.2em] uppercase">Ticket Monitor</span>
        </div>
        <div className="theme-ink-faint flex gap-4 font-mono text-[11px]">
          <span>LAST // {lastUpdate ? formatClock(lastUpdate) : "NEVER"}</span>
          <span className="text-accent/80">SCROLL ↓</span>
        </div>
      </div>
    </footer>
  );
}
