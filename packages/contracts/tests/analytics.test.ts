import { describe, expect, it } from "vitest";

import {
  ANALYTICS_EVENTS,
  normalizeAnalyticsProperties,
} from "../src/analytics";

describe("normalizeAnalyticsProperties", () => {
  it("keeps primitive values", () => {
    expect(
      normalizeAnalyticsProperties({
        network: "mtn",
        sizeMb: 1024,
        isBulk: true,
      }),
    ).toEqual({ network: "mtn", sizeMb: 1024, isBulk: true });
  });

  it("drops null, undefined, and empty-string values", () => {
    expect(
      normalizeAnalyticsProperties({
        network: null,
        reference: undefined,
        channel: "",
        kept: "yes",
      }),
    ).toEqual({ kept: "yes" });
  });

  it("strips properties that look like PII or sensitive payloads", () => {
    const output = normalizeAnalyticsProperties({
      email: "a@b.com",
      customerName: "Kevin",
      phone_number: "0244000000",
      authToken: "secret",
      authorization: "Bearer x",
      vendor_reference: "ref",
      rawResponse: "{}",
      payload: "{...}",
      network: "mtn",
    });

    expect(output).toEqual({ network: "mtn" });
  });

  it("defines unique event names", () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
});
