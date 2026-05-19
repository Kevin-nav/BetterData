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
  const inFlight = new Set<QueueName>();

  async function dispatch(queue: QueueName) {
    if (inFlight.has(queue)) {
      return;
    }

    const queueConsumers = consumers.get(queue);

    if (!queueConsumers || queueConsumers.size === 0) {
      return;
    }

    const stored = queues.get(queue)?.[0];

    if (!stored) {
      return;
    }

    const active = stored;
    const consumer = queueConsumers.values().next().value;

    if (!consumer) {
      return;
    }

    inFlight.add(queue);
    let settled = false;

    function removeHead() {
      const current = queues.get(queue);

      if (current?.[0]?.id === active.id) {
        current.shift();
      }

      if (current?.length === 0) {
        queues.delete(queue);
      }
    }

    try {
      await consumer({
        id: active.id,
        queue: active.queue,
        job: active.job,
        attempts: active.attempts,
        async ack() {
          removeHead();
          settled = true;
        },
        async retry(delayMs) {
          removeHead();
          settled = true;
          setTimeout(() => {
            enqueueStored({
              ...active,
              attempts: active.attempts + 1
            });
          }, delayMs);
        },
        async deadLetter(reason) {
          removeHead();
          settled = true;
          enqueueStored({
            ...active,
            queue: QUEUE_NAMES.purchaseDead,
            job: {
              ...active.job,
              deadLetterReason: reason
            }
          });
        }
      });
    } catch {
      if (!settled) {
        removeHead();
        settled = true;
        setTimeout(() => {
          enqueueStored({
            ...active,
            attempts: active.attempts + 1
          });
        }, 0);
      }
    } finally {
      inFlight.delete(queue);

      if (settled) {
        void dispatch(queue);
      }
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
