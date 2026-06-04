import { PostHog } from "posthog-node";
import {
  normalizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties
} from "@betterdata/contracts";

type Env = Partial<NodeJS.ProcessEnv>;

type CaptureInput = {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
};

let client: PostHog | null | undefined;

export function isPostHogEnabled(env: Env = process.env) {
  return env.POSTHOG_DISABLED !== "true" && Boolean(readPostHogProjectToken(env)?.trim());
}

export function buildPostHogEvent(input: CaptureInput, env: Env = process.env) {
  return {
    distinctId: input.distinctId,
    event: input.event,
    properties: normalizeAnalyticsProperties({
      ...input.properties,
      environment: env.POSTHOG_ENVIRONMENT ?? env.NODE_ENV ?? "development",
      platform: "api"
    })
  };
}

export function getPostHogClient(env: Env = process.env) {
  if (!isPostHogEnabled(env)) {
    return null;
  }

  if (client !== undefined) {
    return client;
  }

  client = new PostHog(readPostHogProjectToken(env)!, {
    host: env.POSTHOG_HOST || "https://us.i.posthog.com"
  });

  return client;
}

export function capturePostHogEvent(input: CaptureInput, env: Env = process.env) {
  try {
    const posthog = getPostHogClient(env);

    if (posthog === null) {
      return;
    }

    const event = buildPostHogEvent(input, env);
    posthog.capture(event);
  } catch {
    // Product analytics must never interrupt payment, wallet, or fulfillment flows.
  }
}

export async function shutdownPostHog() {
  if (client) {
    await client.shutdown();
  }

  client = undefined;
}

function readPostHogProjectToken(env: Env) {
  return env.POSTHOG_PROJECT_TOKEN;
}
