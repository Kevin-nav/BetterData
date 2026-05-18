import {
  connect,
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage
} from "amqplib";

import {
  QUEUE_NAMES,
  type QueueConsumer,
  type QueueJob,
  type QueueName,
  type QueueProvider
} from "./types";

export async function createAmqpQueueProvider(options: {
  url: string;
  prefetch?: number;
}): Promise<QueueProvider> {
  const connection = await connect(options.url);
  const channel = await connection.createConfirmChannel();

  await channel.prefetch(options.prefetch ?? 5);
  await assertTopology(channel);

  return {
    async enqueue(queue, job) {
      const messageId = await publish(channel, queue, job);

      return { messageId };
    },

    async consume(queue, consumer) {
      const result = await channel.consume(queue, (message) => {
        if (!message) {
          return;
        }

        void handleMessage(channel, message, queue, consumer as QueueConsumer);
      });

      return async () => {
        await channel.cancel(result.consumerTag);
      };
    },

    async getDepth(queue) {
      const result = await channel.checkQueue(queue);

      return result.messageCount;
    }
  };
}

async function assertTopology(channel: Channel) {
  await channel.assertQueue(QUEUE_NAMES.purchaseRequested, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": QUEUE_NAMES.purchaseDead
    }
  });
  await channel.assertQueue(QUEUE_NAMES.purchaseRetry, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": QUEUE_NAMES.purchaseRequested
    }
  });
  await channel.assertQueue(QUEUE_NAMES.purchaseDead, { durable: true });
  await channel.assertQueue(QUEUE_NAMES.statusRefresh, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": QUEUE_NAMES.purchaseDead
    }
  });
}

async function publish(
  channel: ConfirmChannel,
  queue: QueueName,
  job: QueueJob,
  delayMs?: number
) {
  const messageId = crypto.randomUUID();
  const body = Buffer.from(JSON.stringify(job));

  const accepted = channel.sendToQueue(queue, body, {
    persistent: true,
    contentType: "application/json",
    messageId,
    ...(delayMs !== undefined ? { expiration: String(delayMs) } : {})
  });

  if (!accepted) {
    await new Promise((resolve) => channel.once("drain", resolve));
  }

  await channel.waitForConfirms();

  return messageId;
}

async function handleMessage(
  channel: Channel,
  message: ConsumeMessage,
  queue: QueueName,
  consumer: QueueConsumer
) {
  try {
    const job = JSON.parse(message.content.toString("utf8")) as QueueJob;
    const attempts =
      typeof message.properties.headers?.attempts === "number"
        ? message.properties.headers.attempts
        : "attempt" in job
          ? job.attempt
          : 0;

    await consumer({
      id: message.properties.messageId ?? crypto.randomUUID(),
      queue,
      job,
      attempts,
      async ack() {
        channel.ack(message);
      },
      async retry(delayMs) {
        await publish(
          channel as ConfirmChannel,
          QUEUE_NAMES.purchaseRetry,
          { ...job, attempt: attempts + 1 } as QueueJob,
          delayMs
        );
        channel.ack(message);
      },
      async deadLetter(reason) {
        await publish(channel as ConfirmChannel, QUEUE_NAMES.purchaseDead, {
          ...job,
          deadLetterReason: reason
        });
        channel.ack(message);
      }
    });
  } catch {
    channel.nack(message, false, false);
  }
}

export async function closeAmqpConnection(connection: ChannelModel) {
  await connection.close();
}
