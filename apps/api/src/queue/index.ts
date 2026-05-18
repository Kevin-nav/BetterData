import { resolveAmqpQueueConfig, shouldUseAmqpQueue } from "./amqpConfig";
import { createAmqpQueueProvider } from "./amqpQueue";
import { createLocalQueueProvider } from "./localQueue";
import type { QueueProvider } from "./types";

export async function createQueueProvider(): Promise<QueueProvider> {
  if (shouldUseAmqpQueue()) {
    const config = resolveAmqpQueueConfig();

    return await createAmqpQueueProvider({
      url: config.url,
      prefetch: config.prefetch
    });
  }

  return createLocalQueueProvider();
}

export * from "./types";
