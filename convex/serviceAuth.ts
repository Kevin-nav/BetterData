export function requireServiceSecret(serviceSecret: string) {
  const expected = process.env.BETTERDATA_SERVICE_SECRET;

  if (!expected || serviceSecret !== expected) {
    throw new Error("Service authorization failed.");
  }
}
