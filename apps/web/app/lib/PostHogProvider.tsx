"use client";

import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { getPostHogProjectToken, shouldEnableSessionReplay } from "./analytics";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const maxScrollPercentage = useRef(0);
  const maxScrollPixels = useRef(0);
  const pageUrl = useRef("");

  useEffect(() => {
    const key = getPostHogProjectToken();

    if (!key || posthog.__loaded) {
      return;
    }

    const replaySampleRate = Number(process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE ?? "0.1");
    const sessionReplayEligible = shouldEnableSessionReplay(
      Number.isFinite(replaySampleRate) ? replaySampleRate : 0
    );

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      defaults: "2026-01-30",
      autocapture: false,
      capture_dead_clicks: false,
      capture_pageview: "history_change",
      capture_pageleave: false,
      disable_session_recording: !sessionReplayEligible,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: true,
          tel: true,
          text: true,
          textarea: true
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

  useEffect(() => {
    if (!getPostHogProjectToken()) {
      return;
    }

    pageUrl.current = window.location.href;
    resetScrollDepth();
    updateScrollDepth();

    const handleScroll = () => updateScrollDepth();
    const handlePageHide = () => capturePageleaveWithScrollDepth();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      capturePageleaveWithScrollDepth();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [pathname]);

  return <Provider client={posthog}>{children}</Provider>;

  function resetScrollDepth() {
    maxScrollPercentage.current = 0;
    maxScrollPixels.current = 0;
  }

  function updateScrollDepth() {
    const scrollableHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const currentPixels = Math.max(0, window.scrollY + window.innerHeight);
    const currentPercentage =
      scrollableHeight > 0 ? Math.min(1, currentPixels / scrollableHeight) : 1;

    maxScrollPixels.current = Math.max(maxScrollPixels.current, currentPixels);
    maxScrollPercentage.current = Math.max(maxScrollPercentage.current, currentPercentage);
  }

  function capturePageleaveWithScrollDepth() {
    if (!posthog.__loaded || !pageUrl.current) {
      return;
    }

    updateScrollDepth();
    posthog.capture("$pageleave", {
      "$current_url": pageUrl.current,
      "max scroll percentage": maxScrollPercentage.current,
      "max scroll pixels": Math.round(maxScrollPixels.current),
      "last scroll percentage": getCurrentScrollPercentage(),
      "last scroll pixels": Math.round(window.scrollY + window.innerHeight),
      scrolled: maxScrollPixels.current > window.innerHeight
    });
  }

  function getCurrentScrollPercentage() {
    const scrollableHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );

    if (scrollableHeight <= 0) {
      return 1;
    }

    return Math.min(1, Math.max(0, (window.scrollY + window.innerHeight) / scrollableHeight));
  }
}
