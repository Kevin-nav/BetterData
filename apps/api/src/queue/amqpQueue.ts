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
  const state: AmqpState = {
    url: options.url,
    prefetch: options.prefetch ?? 5,
    consumers: new Set()
  };

  await ensureChannel(state);

  return {
    async enqueue(queue, job) {
      const messageId = await withFreshChannel(state, (channel) =>
        publish(channel, queue, job)
      );

      return { messageId };
    },

    async consume(queue, consumer) {
      const record: ConsumerRecord = {
        queue,
        consumer: consumer as QueueConsumer,
        stopped: false
      };

      state.consumers.add(record);
      await startConsumer(state, record);
      return async () => {
        record.stopped = true;
        state.consumers.delete(record);
        if (record.reconnectTimer !== undefined) {
          clearTimeout(record.reconnectTimer);
        }
        if (record.consumerTag !== undefined && state.channel !== undefined) {
          await state.channel.cancel(record.consumerTag).catch(() => undefined);
        }
      };
    },

    async getDepth(queue) {
      const result = await withFreshChannel(state, (channel) =>
        channel.checkQueue(queue)
      );

      return result.messageCount;
    }
  };
}

type AmqpState = {
  url: string;
  prefetch: number;
  connection?: ChannelModel;
  channel?: ConfirmChannel;
  connecting?: Promise<ConfirmChannel>;
  consumers: Set<ConsumerRecord>;
};

type ConsumerRecord = {
  queue: QueueName;
  consumer: QueueConsumer;
  stopped: boolean;
  consumerTag?: string;
  starting?: Promise<void>;
  reconnectTimer?: NodeJS.Timeout;
};

async function ensureChannel(state: AmqpState): Promise<ConfirmChannel> {
  if (state.channel !== undefined) {
    return state.channel;
  }

  if (state.connecting !== undefined) {
    return await state.connecting;
  }

  state.connecting = connectChannel(state);

  try {
    return await state.connecting;
  } finally {
    delete state.connecting;
  }
}

async function connectChannel(state: AmqpState) {
  const connection = await connect(state.url);
  const channel = await connection.createConfirmChannel();

  connection.on("error", () => undefined);
  channel.on("error", () => undefined);
  connection.once("close", () => handleChannelClosed(state, connection, channel));
  channel.once("close", () => handleChannelClosed(state, connection, channel));

  await channel.prefetch(state.prefetch);
  await assertTopology(channel);

  state.connection = connection;
  state.channel = channel;

  return channel;
}

function handleChannelClosed(
  state: AmqpState,
  connection: ChannelModel,
  channel: ConfirmChannel
) {
  if (state.connection === connection) {
    delete state.connection;
  }
  if (state.channel === channel) {
    delete state.channel;
  }

  for (const record of state.consumers) {
    delete record.consumerTag;
    scheduleConsumerReconnect(state, record);
  }
}

async function withFreshChannel<T>(
  state: AmqpState,
  operation: (channel: ConfirmChannel) => Promise<T>
) {
  try {
    return await operation(await ensureChannel(state));
  } catch (error) {
    if (!isClosedAmqpError(error)) {
      throw error;
    }

    delete state.channel;
    delete state.connection;
    return await operation(await ensureChannel(state));
  }
}

async function startConsumer(state: AmqpState, record: ConsumerRecord) {
  if (record.stopped) {
    return;
  }

  if (record.starting !== undefined) {
    await record.starting;
    return;
  }

  record.starting = (async () => {
    try {
      const channel = await ensureChannel(state);
      if (record.stopped) {
        return;
      }

      const result = await channel.consume(record.queue, (message) => {
        if (!message) {
          return;
        }

        void handleMessage(channel, message, record.queue, record.consumer);
      });
      record.consumerTag = result.consumerTag;
    } catch (error) {
      if (!record.stopped) {
        scheduleConsumerReconnect(state, record);
      }
    } finally {
      delete record.starting;
    }
  })();

  await record.starting;
}

function scheduleConsumerReconnect(state: AmqpState, record: ConsumerRecord) {
  if (
    record.stopped ||
    record.reconnectTimer !== undefined ||
    record.starting !== undefined
  ) {
    return;
  }

  record.reconnectTimer = setTimeout(() => {
    delete record.reconnectTimer;
    void startConsumer(state, record);
  }, 1_000);
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
  await channel.assertQueue(QUEUE_NAMES.statusRefreshRetry, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": QUEUE_NAMES.statusRefresh
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
        const retryQueue = retryQueueFor(queue);

        await publish(
          channel as ConfirmChannel,
          retryQueue,
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

export function retryQueueFor(queue: QueueName): QueueName {
  const retryQueues: Partial<Record<QueueName, QueueName>> = {
    [QUEUE_NAMES.purchaseRequested]: QUEUE_NAMES.purchaseRetry,
    [QUEUE_NAMES.statusRefresh]: QUEUE_NAMES.statusRefreshRetry
  };

  return retryQueues[queue] ?? (`${queue}.retry` as QueueName);
}

export function isClosedAmqpError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    name.includes("illegaloperation") ||
    message.includes("channel closed") ||
    message.includes("connection closed") ||
    message.includes("channel ended") ||
    message.includes("connection ended")
  );
}

export async function closeAmqpConnection(connection: ChannelModel) {
  await connection.close();
}
