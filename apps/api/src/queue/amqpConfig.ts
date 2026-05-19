import { readPositiveInt } from "../config/numbers";
import { QUEUE_NAMES } from "./types";

export type AmqpQueueConfig = {
  url: string;
  prefetch: number;
  queues: typeof QUEUE_NAMES;
};

export function resolveAmqpQueueConfig(
  env: NodeJS.ProcessEnv = process.env
): AmqpQueueConfig {
  const url = env.CLOUDAMQP_URL?.trim();

  if (!url || !isValidUrl(url)) {
    throw new Error(
      "CLOUDAMQP_URL must be a non-empty valid URL when QUEUE_PROVIDER=amqp."
    );
  }

  return {
    url,
    prefetch: readPositiveInt(env.QUEUE_PREFETCH, 5),
    queues: QUEUE_NAMES
  };
}

export function shouldUseAmqpQueue(env: NodeJS.ProcessEnv = process.env) {
  return env.QUEUE_PROVIDER === "amqp";
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
