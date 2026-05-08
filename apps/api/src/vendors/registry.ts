import { createDataMartVendor } from "./datamart/client";
import { createSandboxDelayedVendor } from "./sandbox/delayed";
import { createSandboxFastVendor } from "./sandbox/fast";
import { createSandboxFlakyVendor } from "./sandbox/flaky";
import type { DataVendor } from "./types";

const vendors: Record<string, DataVendor> = {
  datamart: createDataMartVendor(),
  "sandbox-fast": createSandboxFastVendor(),
  "sandbox-delayed": createSandboxDelayedVendor(),
  "sandbox-flaky": createSandboxFlakyVendor()
};

export function getVendorById(id: string): DataVendor | undefined {
  return vendors[id];
}

export function listVendors(): DataVendor[] {
  return Object.values(vendors);
}
