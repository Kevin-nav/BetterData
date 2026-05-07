export const databaseTables = [
  "users",
  "saved_numbers",
  "orders",
  "wallet_transactions",
  "pricing_rules",
  "agent_applications",
  "audit_logs"
] as const;

export type DatabaseTable = (typeof databaseTables)[number];
