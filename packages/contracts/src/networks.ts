export const NETWORK_CODES = {
  mtn: "mtn",
  telecel: "telecel",
  airteltigo: "airteltigo"
} as const;

export type NetworkKey = keyof typeof NETWORK_CODES;
export type NetworkCode = (typeof NETWORK_CODES)[NetworkKey];

export type DataPackage = {
  id: string;
  vendorId: string;
  vendorPackageId: string;
  network: NetworkCode;
  name: string;
  sizeMb: number;
  costGhs: number;
  customerPriceGhs: number;
  baseCustomerPriceGhs?: number;
  agentPriceGhs?: number;
  agentDiscountPercentage?: number;
  isAvailable: boolean;
};
