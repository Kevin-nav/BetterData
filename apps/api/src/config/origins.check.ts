import assert from "node:assert/strict";

import {
  isOriginAllowed,
  resolveAllowedOrigins,
  shouldRegisterDevRoutes
} from "./origins";

const productionEnv = {
  NODE_ENV: "production",
  PUBLIC_APP_URL: "https://betterdatagh.com",
  PUBLIC_ADMIN_URL: "https://admin.betterdatagh.com",
  LOCAL_ALLOWED_ORIGINS: "http://localhost:3000"
};

assert.deepEqual(resolveAllowedOrigins(productionEnv), [
  "https://betterdatagh.com",
  "https://admin.betterdatagh.com"
]);
assert.equal(isOriginAllowed("https://betterdatagh.com", productionEnv), true);
assert.equal(
  isOriginAllowed("https://admin.betterdatagh.com", productionEnv),
  true
);
assert.equal(isOriginAllowed("http://localhost:3000", productionEnv), false);
assert.equal(shouldRegisterDevRoutes(productionEnv), false);
assert.equal(
  shouldRegisterDevRoutes({
    NODE_ENV: "production",
    ENABLE_DEV_VENDOR_ROUTES: "true"
  }),
  true
);

const localEnv = {
  NODE_ENV: "development",
  PUBLIC_APP_URL: "http://localhost:3000/",
  PUBLIC_ADMIN_URL: "http://localhost:3001",
  LOCAL_ALLOWED_ORIGINS: "http://127.0.0.1:3000,http://localhost:19006"
};

assert.deepEqual(resolveAllowedOrigins(localEnv), [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://localhost:19006"
]);
assert.equal(isOriginAllowed(undefined, localEnv), true);
assert.equal(isOriginAllowed("http://localhost:19006", localEnv), true);
assert.equal(shouldRegisterDevRoutes(localEnv), true);
