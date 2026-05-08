import type {
  NetworkCode,
  VendorOrderStatus,
  VendorPackage
} from "@betterdata/contracts";

export const DATAMART_NETWORK_CODES = {
  mtn: "YELLO",
  telecel: "TELECEL",
  airteltigo: "AT_PREMIUM"
} satisfies Record<NetworkCode, string>;

export function toDataMartProviderCode(network: NetworkCode): string {
  return DATAMART_NETWORK_CODES[network];
}

export function fromDataMartProviderCode(code: string): NetworkCode | undefined {
  const entry = Object.entries(DATAMART_NETWORK_CODES).find(
    ([, value]) => value === code
  );
  return entry?.[0] as NetworkCode | undefined;
}

export function mapDataMartStatus(status: string): VendorOrderStatus {
  switch (status.toLowerCase()) {
    case "completed":
    case "success":
      return "completed";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "processing";
  }
}

export type DataMartPackagePayload = {
  id?: string;
  package_id?: string;
  network?: string;
  name?: string;
  size_mb?: number;
  cost?: number;
  price?: number;
  available?: boolean;
};

export function mapDataMartPackage(
  raw: DataMartPackagePayload
): VendorPackage | undefined {
  const vendorPackageId = raw.id ?? raw.package_id;
  const network = raw.network ? fromDataMartProviderCode(raw.network) : undefined;

  if (!vendorPackageId || !network || !raw.name) {
    return undefined;
  }

  return {
    vendorPackageId,
    network,
    name: raw.name,
    sizeMb: raw.size_mb ?? 0,
    costGhs: raw.cost ?? raw.price ?? 0,
    isAvailable: raw.available ?? true,
    raw
  };
}
