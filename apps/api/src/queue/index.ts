import { createLocalQueueProvider } from "./localQueue";
import type { QueueProvider } from "./types";

export function createQueueProvider(): QueueProvider {
  return createLocalQueueProvider();
}

export * from "./types";
