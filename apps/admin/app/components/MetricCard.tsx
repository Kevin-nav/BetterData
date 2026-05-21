type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "healthy" | "low" | "critical" | "unknown" | undefined;
};

export function MetricCard({ label, value, detail, tone }: MetricCardProps) {
  const toneClass = tone && tone !== "neutral" ? ` tone-${tone}` : "";

  return (
    <article className={`metric-card${toneClass}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {detail ? <small className="metric-detail">{detail}</small> : null}
    </article>
  );
}
