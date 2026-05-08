import { getVendorById } from "./registry";

export function getActiveDataVendor() {
  const vendorId = process.env.BETTERDATA_ACTIVE_DATA_VENDOR ?? "datamart";
  const vendor = getVendorById(vendorId);

  if (!vendor) {
    throw new Error(`Unknown active data vendor: ${vendorId}`);
  }

  return vendor;
}
