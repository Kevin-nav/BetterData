export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production") {
    return uniqueOrigins([env.PUBLIC_APP_URL, env.PUBLIC_ADMIN_URL]);
  }

  return uniqueOrigins([
    env.PUBLIC_APP_URL ?? "http://localhost:3000",
    env.PUBLIC_ADMIN_URL ?? "http://localhost:3001",
    env.NEXT_PUBLIC_API_BASE_URL,
    env.LOCAL_ALLOWED_ORIGINS
  ]);
}

export function isOriginAllowed(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env
) {
  if (!origin) {
    return true;
  }

  return resolveAllowedOrigins(env).includes(origin);
}

export function shouldRegisterDevRoutes(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== "production" || env.ENABLE_DEV_VENDOR_ROUTES === "true";
}

function uniqueOrigins(values: Array<string | undefined>) {
  const origins = values
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return [...new Set(origins)];
}
