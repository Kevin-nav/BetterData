"use client";

import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";

import { shouldEnableSessionReplay } from "./analytics";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    if (!key || posthog.__loaded) {
      return;
    }

    const replaySampleRate = Number(process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE ?? "0.1");
    const sessionReplayEligible = shouldEnableSessionReplay(
      Number.isFinite(replaySampleRate) ? replaySampleRate : 0
    );

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: !sessionReplayEligible,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: true,
          tel: true,
          text: true
        }
      },
      loaded: (client) => {
        client.register({
          environment:
            process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT ??
            process.env.NODE_ENV ??
            "development",
          platform: "web",
          session_replay_eligible: sessionReplayEligible
        });
      }
    });
  }, []);

  return <Provider client={posthog}>{children}</Provider>;
}
