import { QUEUE_NAMES } from "./types";

export type AmqpQueueConfig = {
  url: string;
  prefetch: number;
  queues: typeof QUEUE_NAMES;
};

export function resolveAmqpQueueConfig(
  env: NodeJS.ProcessEnv = process.env
): AmqpQueueConfig {
  const url = env.CLOUDAMQP_URL;

  if (!url) {
    throw new Error("CLOUDAMQP_URL is required when QUEUE_PROVIDER=amqp.");
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

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
