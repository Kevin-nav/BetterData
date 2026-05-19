export type OrderLogFieldInput = {
  orderReference?: string;
  vendorId?: string;
  vendorOrderReference?: string;
  idempotencyKey?: string;
  queueMessageId?: string;
  attempt?: number;
};

export function orderLogFields(input: OrderLogFieldInput) {
  return {
    ...(input.orderReference ? { orderReference: input.orderReference } : {}),
    ...(input.vendorId ? { vendorId: input.vendorId } : {}),
    ...(input.vendorOrderReference
      ? { vendorOrderReference: input.vendorOrderReference }
      : {}),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(input.queueMessageId ? { queueMessageId: input.queueMessageId } : {}),
    ...(input.attempt !== undefined ? { attempt: input.attempt } : {})
  };
}
