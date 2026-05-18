import assert from "node:assert/strict";

import { isAdminUser, readBearerToken } from "./adminAuth";

assert.equal(readBearerToken(undefined), undefined);
assert.equal(readBearerToken("Basic abc"), undefined);
assert.equal(readBearerToken("Bearer token-123"), "token-123");

assert.equal(isAdminUser({ id: "u1", claims: { admin: true } }), true);
assert.equal(isAdminUser({ id: "u1", claims: { role: "admin" } }), true);
assert.equal(
  isAdminUser(
    { id: "u2" },
    {
      ADMIN_FIREBASE_UIDS: "u1,u2"
    }
  ),
  true
);
assert.equal(
  isAdminUser(
    { id: "u3", email: "Admin@BetterDataGH.com" },
    {
      ADMIN_EMAILS: "admin@betterdatagh.com"
    }
  ),
  true
);
assert.equal(isAdminUser({ id: "u4", email: "user@example.com" }, {}), false);
