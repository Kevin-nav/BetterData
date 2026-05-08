import type { VendorPackage } from "@betterdata/contracts";

export const SIMULATED_PACKAGES: VendorPackage[] = [
  {
    vendorPackageId: "mtn-1gb",
    network: "mtn",
    name: "MTN 1GB",
    sizeMb: 1024,
    costGhs: 4,
    isAvailable: true
  },
  {
    vendorPackageId: "mtn-2gb",
    network: "mtn",
    name: "MTN 2GB",
    sizeMb: 2048,
    costGhs: 9,
    isAvailable: true
  },
  {
    vendorPackageId: "mtn-5gb",
    network: "mtn",
    name: "MTN 5GB",
    sizeMb: 5120,
    costGhs: 23,
    isAvailable: true
  },
  {
    vendorPackageId: "telecel-1gb",
    network: "telecel",
    name: "Telecel 1GB",
    sizeMb: 1024,
    costGhs: 4.5,
    isAvailable: true
  },
  {
    vendorPackageId: "telecel-5gb",
    network: "telecel",
    name: "Telecel 5GB",
    sizeMb: 5120,
    costGhs: 24,
    isAvailable: true
  },
  {
    vendorPackageId: "airteltigo-1gb",
    network: "airteltigo",
    name: "AirtelTigo 1GB",
    sizeMb: 1024,
    costGhs: 4.25,
    isAvailable: true
  },
  {
    vendorPackageId: "airteltigo-3gb",
    network: "airteltigo",
    name: "AirtelTigo 3GB",
    sizeMb: 3072,
    costGhs: 13,
    isAvailable: true
  }
];
