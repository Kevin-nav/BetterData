export type PaymentRetryKind = "data_fulfillment" | "internal_completion";

const retrySchedulesMs: Record<PaymentRetryKind, number[]> = {
  data_fulfillment: [60_000, 300_000, 900_000, 1_800_000, 3_600_000],
  internal_completion: [30_000, 120_000, 300_000, 900_000, 1_800_000]
};

export function getNextRetryAt(kind: PaymentRetryKind, retryCount: number, now = Date.now()) {
  const schedule = retrySchedulesMs[kind];
  const delay = schedule[retryCount];

  if (delay === undefined) {
    return null;
  }

  return now + delay;
}

export function isFinalRetryFailure(kind: PaymentRetryKind, retryCount: number) {
  return retryCount >= retrySchedulesMs[kind].length;
}
