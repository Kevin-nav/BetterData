"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type BalancePoint = {
  balanceGhs: number;
  source: string;
  createdAt: number;
};

type VendorBalanceChartProps = {
  data: BalancePoint[];
};

export function VendorBalanceChart({ data }: VendorBalanceChartProps) {
  const visibleData = data.slice(-80).map((point) => ({
    ...point,
    label: new Date(point.createdAt).toISOString()
  }));

  return (
    <section className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="card-header-subtitle">Vendor Wallet</div>
          <h2 className="chart-card-title">DataMart Balance</h2>
        </div>
      </div>

      {visibleData.length === 0 ? (
        <div className="chart-empty">No balance snapshots yet.</div>
      ) : (
        <div className="chart-frame compact">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickFormatter={formatShortTime}
                tickLine={false}
                axisLine={false}
                minTickGap={22}
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
              <Tooltip content={<BalanceTooltip />} />
              <Area
                type="monotone"
                dataKey="balanceGhs"
                name="Balance"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#balanceFill)"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function BalanceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as BalancePoint & { label: string };

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatLongTime(point.createdAt)}</div>
      <div className="chart-tooltip-row">
        <span>Balance</span>
        <strong>{formatGhs(point.balanceGhs)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>Source</span>
        <strong>{formatSource(point.source)}</strong>
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

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatLongTime(value: number) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSource(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
