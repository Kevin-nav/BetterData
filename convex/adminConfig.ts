export type AdminScope = "superadmin" | "admin";

export type AdminRole = "admin" | "superadmin";

export function getAdminScopeForRole(
  role: string | undefined | null
): AdminScope | null {
  if (role === "superadmin") {
    return "superadmin";
  }

  if (role === "admin") {
    return "admin";
  }

  return null;
}

export function isBootstrapSuperadmin(email: string | undefined | null): boolean {
  if (!email) {
    return false;
  }

  const emails = readCsv(process.env.ADMIN_SUPERADMIN_EMAILS);
  return emails.includes(email.toLowerCase());
}

function readCsv(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
