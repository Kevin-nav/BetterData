"use client";

import {
  normalizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties
} from "@betterdata/contracts";
import posthog from "posthog-js";

export function getAnalyticsEnvironment() {
  return process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
}

export function buildWebAnalyticsProperties(properties: AnalyticsProperties = {}) {
  return normalizeAnalyticsProperties({
    platform: "web",
    environment: getAnalyticsEnvironment(),
    ...properties
  });
}

export function shouldEnableSessionReplay(sampleRate: number, randomValue = Math.random()) {
  return sampleRate > 0 && randomValue < sampleRate;
}

export function captureWebEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!isPostHogConfigured()) {
    return;
  }

  posthog.capture(event, buildWebAnalyticsProperties(properties));
}

export function identifyWebUser(userHash: string, properties: AnalyticsProperties = {}) {
  if (!isPostHogConfigured()) {
    return;
  }

  posthog.identify(userHash, buildWebAnalyticsProperties(properties));
}

export function resetWebAnalytics() {
  if (isPostHogConfigured()) {
    posthog.reset();
  }
}

export function isPostHogConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}
