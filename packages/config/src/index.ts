export const APP_NAME = "Better Data";

export const SUPPORT_CHANNELS = {
  whatsappLabel: "WhatsApp",
  supportEmailEnvKey: "SUPPORT_EMAIL"
} as const;

export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
