"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StockDataPoint } from "@/lib/types";

export function StockChart({
  data,
  mounted,
}: {
  data: StockDataPoint[];
  mounted: boolean;
}) {
  return (
    <div className="theme-panel border p-5">
      <div className="theme-hairline mb-4 flex items-center justify-between border-b pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.25em] text-accent">TRENDS</p>
          <p className="theme-ink mt-1 text-sm font-medium">库存曲线</p>
        </div>
        <span className="theme-ink-faint font-mono text-xs">{data.length} pts</span>
      </div>
      <div className="h-56 w-full">
        {mounted && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="akAccent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="timeLabel" stroke="var(--chart-tick)" fontSize={10} tickLine={false} />
              <YAxis stroke="var(--chart-tick)" fontSize={10} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--panel-strong)",
                  borderColor: "var(--hairline)",
                  borderRadius: 0,
                  fontSize: 12,
                  color: "var(--ink)",
                }}
                formatter={(value, _name, item) => {
                  const payload = (item as { payload?: StockDataPoint })?.payload;
                  return [
                    <span key="stock">
                      库存: <strong className="text-accent">{String(value ?? "")}</strong>
                      <span className="theme-ink-faint mt-0.5 block max-w-[200px] truncate text-xs">
                        {payload?.ticketName}
                      </span>
                    </span>,
                    "",
                  ];
                }}
              />
              <Area
                type="monotone"
                dataKey="stock"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#akAccent)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="theme-ink-faint flex h-full items-center justify-center text-sm">
            等待库存数据
          </div>
        )}
      </div>
    </div>
  );
}
