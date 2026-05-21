"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendPoint = {
  date: string;
  timestamp: number;
  revenue: number;
  profit: number;
  orderCount: number;
  marginPct: number;
};

type FinancialTrendChartProps = {
  data: TrendPoint[];
};

const ranges = [7, 30, 90] as const;

export function FinancialTrendChart({ data }: FinancialTrendChartProps) {
  const [range, setRange] = useState<(typeof ranges)[number]>(30);
  const visibleData = useMemo(() => data.slice(-range), [data, range]);

  return (
    <section className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="card-header-subtitle">Financials</div>
          <h2 className="chart-card-title">Revenue vs Profit</h2>
        </div>
        <div className="chart-range-toggle" aria-label="Financial chart range">
          {ranges.map((days) => (
            <button
              key={days}
              type="button"
              className={range === days ? "active" : ""}
              onClick={() => setRange(days)}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      {visibleData.length === 0 ? (
        <div className="chart-empty">No completed orders yet.</div>
      ) : (
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                stroke="var(--text-muted)"
                fontSize={12}
              />
              <YAxis
                tickFormatter={formatCompactGhs}
                tickLine={false}
                axisLine={false}
                width={58}
                stroke="var(--text-muted)"
                fontSize={12}
              />
              <Tooltip content={<FinancialTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#revenueFill)"
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#profitFill)"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function FinancialTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as TrendPoint;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatLongDate(label)}</div>
      <div className="chart-tooltip-row">
        <span>Revenue</span>
        <strong>{formatGhs(point.revenue)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>Profit</span>
        <strong>{formatGhs(point.profit)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>Margin</span>
        <strong>{point.marginPct}%</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>Orders</span>
        <strong>{point.orderCount}</strong>
      </div>
    </div>
  );
}

function formatGhs(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactGhs(value: number) {
  return new Intl.NumberFormat("en-GH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}
