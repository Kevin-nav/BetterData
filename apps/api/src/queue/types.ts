import type { NetworkCode, PurchaseRequest } from "@betterdata/contracts";

export const QUEUE_NAMES = {
  purchaseRequested: "orders.purchase.requested",
  purchaseRetry: "orders.purchase.retry",
  purchaseDead: "orders.purchase.dead",
  statusRefresh: "orders.status.refresh"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type PurchaseJob = {
  kind: "purchase";
  orderReference: string;
  packageId: string;
  network: NetworkCode;
  recipientPhone: string;
  paymentMethod: PurchaseRequest["paymentMethod"];
  vendorId: string;
  idempotencyKey: string;
  attempt: number;
  createdAt: string;
  deadLetterReason?: string;
};

export type StatusRefreshJob = {
  kind: "status-refresh";
  orderReference: string;
  vendorId: string;
  vendorOrderReference: string;
  attempt: number;
  createdAt: string;
  deadLetterReason?: string;
};

export type QueueJob = PurchaseJob | StatusRefreshJob;

export type QueueMessage<TJob extends QueueJob = QueueJob> = {
  id: string;
  queue: QueueName;
  job: TJob;
  attempts: number;
  ack(): Promise<void>;
  retry(delayMs: number): Promise<void>;
  deadLetter(reason: string): Promise<void>;
};

export type QueueConsumer<TJob extends QueueJob = QueueJob> = (
  message: QueueMessage<TJob>
) => Promise<void>;

export type QueueProvider = {
  enqueue(queue: QueueName, job: QueueJob): Promise<{ messageId: string }>;
  consume<TJob extends QueueJob>(
    queue: QueueName,
    consumer: QueueConsumer<TJob>
  ): Promise<() => Promise<void>>;
  getDepth(queue: QueueName): Promise<number>;
};
