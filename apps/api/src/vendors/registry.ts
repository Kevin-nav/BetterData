import { createDataMartVendor } from "./datamart/client";
import type { DataVendor } from "./types";

const vendors: Record<string, DataVendor> = {
  datamart: createDataMartVendor()
};

export function getVendorById(id: string): DataVendor | undefined {
  return vendors[id];
}

export function listVendors(): DataVendor[] {
  return Object.values(vendors);
}
