"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TrendPoint = {
  date: string;
  orderCount: number;
};

type OrderVolumeChartProps = {
  data: TrendPoint[];
};

export function OrderVolumeChart({ data }: OrderVolumeChartProps) {
  const visibleData = data.slice(-30);

  return (
    <section className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="card-header-subtitle">Sales Volume</div>
          <h2 className="chart-card-title">Completed Orders</h2>
        </div>
      </div>

      {visibleData.length === 0 ? (
        <div className="chart-empty">No completed orders yet.</div>
      ) : (
        <div className="chart-frame compact">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={22}
                stroke="var(--text-muted)"
                fontSize={12}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                stroke="var(--text-muted)"
                fontSize={12}
              />
              <Tooltip content={<OrderTooltip />} />
              <Bar dataKey="orderCount" name="Orders" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function OrderTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatLongDate(label)}</div>
      <div className="chart-tooltip-row">
        <span>Orders</span>
        <strong>{payload[0].value}</strong>
      </div>
    </div>
  );
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
