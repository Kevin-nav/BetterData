import { randomUUID } from "node:crypto";

import { QUEUE_NAMES, type QueueConsumer, type QueueJob, type QueueName, type QueueProvider } from "./types";

type StoredMessage = {
  id: string;
  queue: QueueName;
  job: QueueJob;
  attempts: number;
};

export function createLocalQueueProvider(): QueueProvider {
  const queues = new Map<QueueName, StoredMessage[]>();
  const consumers = new Map<QueueName, Set<QueueConsumer>>();

  async function dispatch(queue: QueueName) {
    const queueConsumers = consumers.get(queue);

    if (!queueConsumers || queueConsumers.size === 0) {
      return;
    }

    const stored = queues.get(queue)?.shift();

    if (!stored) {
      return;
    }

    const consumer = queueConsumers.values().next().value;

    if (!consumer) {
      enqueueStored(stored);
      return;
    }

    try {
      await consumer({
        id: stored.id,
        queue: stored.queue,
        job: stored.job,
        attempts: stored.attempts,
        async ack() {},
        async retry(delayMs) {
          setTimeout(() => {
            enqueueStored({
              ...stored,
              attempts: stored.attempts + 1
            });
          }, delayMs);
        },
        async deadLetter(reason) {
          enqueueStored({
            ...stored,
            queue: QUEUE_NAMES.purchaseDead,
            job: {
              ...stored.job,
              deadLetterReason: reason
            }
          });
        }
      });
    } finally {
      void dispatch(queue);
    }
  }

  function enqueueStored(message: StoredMessage) {
    const current = queues.get(message.queue) ?? [];
    current.push(message);
    queues.set(message.queue, current);
    void dispatch(message.queue);
  }

  return {
    async enqueue(queue, job) {
      const message = {
        id: randomUUID(),
        queue,
        job,
        attempts: "attempt" in job ? job.attempt : 0
      };
      enqueueStored(message);

      return { messageId: message.id };
    },

    async consume(queue, consumer) {
      const current = consumers.get(queue) ?? new Set();
      current.add(consumer as QueueConsumer);
      consumers.set(queue, current);
      void dispatch(queue);

      return async () => {
        current.delete(consumer as QueueConsumer);
      };
    },

    async getDepth(queue) {
      return queues.get(queue)?.length ?? 0;
    }
  };
}
