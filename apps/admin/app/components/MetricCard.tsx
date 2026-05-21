import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  secondaryValue?: string | undefined;
  delta?: number | undefined;
  caption?: string | undefined;
  detail?: string | undefined;
  tone?:
    | "default"
    | "neutral"
    | "success"
    | "warning"
    | "critical"
    | "healthy"
    | "low"
    | "unknown"
    | undefined;
};

export function MetricCard({
  label,
  value,
  secondaryValue,
  delta,
  caption,
  detail,
  tone,
}: MetricCardProps) {
  const normalizedTone = normalizeTone(tone);
  const toneClass = normalizedTone !== "default" ? ` tone-${normalizedTone}` : "";
  const hasDelta = delta !== undefined;
  const deltaDirection = hasDelta ? (delta > 0 ? "up" : delta < 0 ? "down" : "flat") : null;
  const DeltaIcon =
    deltaDirection === "up" ? ArrowUpRight : deltaDirection === "down" ? ArrowDownRight : Minus;

  return (
    <article className={`metric-card${toneClass}`}>
      <div className="metric-card-main">
        <span className="metric-label">{label}</span>
        <strong className="metric-value">{value}</strong>
        {secondaryValue ? (
          <span className="metric-secondary-value">{secondaryValue}</span>
        ) : null}
      </div>

      <div className="metric-card-footer">
        {hasDelta ? (
          <span className={`metric-delta delta-${deltaDirection}`}>
            <DeltaIcon aria-hidden="true" />
            {formatDelta(delta)}
          </span>
        ) : null}
        {caption ?? detail ? (
          <small className="metric-detail">{caption ?? detail}</small>
        ) : null}
      </div>
    </article>
  );
}

function normalizeTone(tone: MetricCardProps["tone"]) {
  if (tone === "healthy") return "success";
  if (tone === "low") return "warning";
  if (tone === "neutral" || tone === undefined) return "default";
  return tone;
}

function formatDelta(delta: number) {
  if (delta === 0) return "0%";
  return `${delta > 0 ? "+" : ""}${delta}%`;
}
