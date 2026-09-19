"use client";

import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  alertTone,
  formatAlertTime,
  severityLabel,
  weatherIconUrl,
  type WeatherAlert,
  type WeatherPayload,
} from "@/lib/weather";

export function WeatherCard({
  payload,
  alerts,
  loading,
  error,
}: {
  payload: WeatherPayload | null;
  alerts: WeatherAlert[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-[var(--ink-faint)]">
        <Spinner size={14} />
        拉取预报…
      </div>
    );
  }

  if (error) {
    return <p className="py-2 text-xs text-danger">{error}</p>;
  }

  if (!payload || payload.days.length === 0) {
    if (alerts.length > 0) {
      return <AlertList alerts={alerts} />;
    }
    return <p className="py-2 text-xs text-[var(--ink-faint)]">暂无预报数据</p>;
  }

  return (
    <div className="space-y-2">
      <AlertList alerts={alerts} />
      <div className="flex items-center justify-between gap-2">
        <Badge tone={payload.mode === "event" ? "accent" : "warning"}>
          {payload.mode === "event" ? "展期预报" : "近期预报"}
        </Badge>
        <span className="font-mono text-[10px] tracking-wider text-[var(--ink-faint)]">
          {payload.rangeLabel}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto thin-scroll pb-0.5">
        {payload.days.map((day) => {
          const icon = weatherIconUrl(day.iconDay);
          const [, m, d] = day.date.split("-");
          return (
            <div
              key={day.date}
              className="ak-panel-strong min-w-[86px] shrink-0 px-2.5 py-2"
            >
              <p className="font-mono text-[10px] tracking-wider text-[var(--ink-faint)]">
                {m}/{d} · 周{day.weekday}
              </p>
              <div className="mt-1 flex items-center gap-1">
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={icon}
                    alt=""
                    width={18}
                    height={18}
                    className="size-[18px]"
                  />
                ) : null}
                <span className="text-xs font-medium text-[var(--ink)]">
                  {day.textDay}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs tabular-nums text-[var(--ink)]">
                {day.tempMin ?? "—"}° / {day.tempMax ?? "—"}°
              </p>
              {day.windDirDay ? (
                <p className="mt-0.5 truncate text-[10px] text-[var(--ink-faint)]">
                  {day.windDirDay}
                  {day.windScaleDay ? ` ${day.windScaleDay}级` : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {payload.attribution ? (
        <p className="font-mono text-[9px] tracking-wider text-[var(--ink-faint)]">
          天气数据 · 和风天气
        </p>
      ) : null}
    </div>
  );
}

function AlertList({ alerts }: { alerts: WeatherAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="text-[11px] text-[var(--ink-faint)]">附近暂无生效预警</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {alerts.slice(0, 4).map((alert) => {
        const expire = formatAlertTime(alert.expireTime);
        return (
          <div
            key={alert.id}
            className="ak-panel-strong px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={alertTone(alert.severity, alert.color)}>
                {alert.eventName}
              </Badge>
              <Badge tone={alertTone(alert.severity, alert.color)}>
                {severityLabel(alert.severity)}
              </Badge>
              {expire ? (
                <span className="font-mono text-[10px] text-[var(--ink-faint)]">
                  至 {expire}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium leading-snug text-[var(--ink)]">
              {alert.headline}
            </p>
            {alert.description ? (
              <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-[var(--ink-faint)]">
                {alert.description}
              </p>
            ) : null}
            {alert.senderName ? (
              <p className="mt-1 font-mono text-[9px] tracking-wider text-[var(--ink-faint)]">
                {alert.senderName}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
