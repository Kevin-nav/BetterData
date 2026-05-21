export const APP_NAME = "Better Data";

export const SUPPORT_CHANNELS = {
  whatsappLabel: "WhatsApp",
  supportEmailEnvKey: "SUPPORT_EMAIL",
} as const;

export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export type AdminScope = "superadmin" | "admin";
export type UserRole = "user" | "agent" | "admin" | "superadmin";

export function getAdminScopeForRole(
  role: UserRole | string | undefined | null
): AdminScope | null {
  if (role === "superadmin") {
    return "superadmin";
  }

  if (role === "admin") {
    return "admin";
  }

  return null;
}
