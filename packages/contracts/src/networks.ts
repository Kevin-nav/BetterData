export const NETWORK_CODES = {
  MTN: "YELLO",
  TELECEL: "TELECEL",
  AIRTELTIGO: "AT_PREMIUM"
} as const;

export type NetworkKey = keyof typeof NETWORK_CODES;
export type DataMartNetworkCode = (typeof NETWORK_CODES)[NetworkKey];

export type DataPackage = {
  id: string;
  network: DataMartNetworkCode;
  name: string;
  sizeMb: number;
  costGhs: number;
  customerPriceGhs: number;
  isAvailable: boolean;
};
