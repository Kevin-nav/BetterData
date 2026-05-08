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
  capacity?: number;
  mb?: number;
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
  const vendorPackageId =
    raw.id ??
    raw.package_id ??
    (raw.network && raw.capacity !== undefined
      ? `${raw.network.toLowerCase()}-${raw.capacity}gb`
      : undefined);
  const network = raw.network ? fromDataMartProviderCode(raw.network) : undefined;

  const sizeMb = raw.size_mb ?? raw.mb;
  const costGhs = raw.cost ?? raw.price;

  if (!vendorPackageId || !network || sizeMb === undefined || costGhs === undefined) {
    return undefined;
  }

  return {
    vendorPackageId,
    network,
    name: raw.name ?? `${networkLabel(network)} ${raw.capacity ?? sizeMb / 1024}GB`,
    sizeMb,
    costGhs: raw.cost ?? raw.price ?? 0,
    isAvailable: raw.available ?? true,
    raw
  };
}

export function mapDataMartPackageGroups(
  groups: Record<string, DataMartPackagePayload[]>
): VendorPackage[] {
  return Object.values(groups)
    .flat()
    .map(mapDataMartPackage)
    .filter((item): item is VendorPackage => Boolean(item));
}

export function mapDataMartPurchaseResponse(response: {
  data?: {
    orderReference?: string;
    orderStatus?: string;
  };
}) {
  const orderReference = response.data?.orderReference;

  if (!orderReference) {
    throw new Error("DataMart purchase response did not include an order reference.");
  }

  return {
    vendorOrderReference: orderReference,
    status: mapDataMartStatus(response.data?.orderStatus ?? "processing"),
    raw: response
  };
}

export function mapDataMartStatusResponse(response: {
  data?: {
    orderStatus?: string;
  };
}) {
  return mapDataMartStatus(response.data?.orderStatus ?? "processing");
}

export function mapDataMartBalanceResponse(response: {
  data?: {
    balance?: number;
  };
}) {
  return {
    balanceGhs: response.data?.balance ?? 0,
    raw: response
  };
}

export function mapDataMartWebhook(payload: unknown) {
  const event = payload as {
    data?: {
      orderReference?: string;
      status?: string;
    };
  };
  const vendorOrderReference = event.data?.orderReference;

  if (!vendorOrderReference) {
    throw new Error("DataMart webhook did not include an order reference.");
  }

  return {
    vendorOrderReference,
    status: mapDataMartStatus(event.data?.status ?? "processing"),
    raw: payload
  };
}

function networkLabel(network: NetworkCode) {
  switch (network) {
    case "mtn":
      return "MTN";
    case "telecel":
      return "Telecel";
    case "airteltigo":
      return "AirtelTigo";
  }
}
