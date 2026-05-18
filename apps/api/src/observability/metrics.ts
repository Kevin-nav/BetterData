const counters = new Map<string, number>();

export function incrementMetric(name: string, amount = 1) {
  counters.set(name, getMetric(name) + amount);
}

export function getMetric(name: string) {
  return counters.get(name) ?? 0;
}

export function snapshotMetrics() {
  return Object.fromEntries(counters.entries());
}

export function resetMetricsForTests() {
  counters.clear();
}
