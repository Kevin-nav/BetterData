import assert from "node:assert/strict";

import {
  isAdminUser,
  isValidAdminApiKey,
  readBearerToken,
  resolveAdminScope
} from "./adminAuth";

assert.equal(readBearerToken(undefined), undefined);
assert.equal(readBearerToken("Basic abc"), undefined);
assert.equal(readBearerToken("Bearer token-123"), "token-123");

assert.equal(isAdminUser({ id: "u1", firebaseUid: "u1", claims: { admin: true } }), true);
assert.equal(isAdminUser({ id: "u1", firebaseUid: "u1", claims: { role: "admin" } }), true);
assert.equal(
  isAdminUser(
    { id: "u2", firebaseUid: "u2" },
    {
      ADMIN_FIREBASE_UIDS: "u1,u2"
    }
  ),
  true
);
assert.equal(
  isAdminUser(
    { id: "u3", firebaseUid: "u3", email: "Admin@BetterDataGH.com" },
    {
      ADMIN_EMAILS: "admin@betterdatagh.com"
    }
  ),
  true
);
assert.equal(isAdminUser({ id: "u4", firebaseUid: "u4", email: "user@example.com" }, {}), false);
assert.equal(resolveAdminScope({ id: "u5", firebaseUid: "u5" }, "superadmin", {}), "superadmin");
assert.equal(resolveAdminScope({ id: "u6", firebaseUid: "u6" }, "admin", {}), "admin");
assert.equal(
  resolveAdminScope(
    { id: "u7", firebaseUid: "u7", email: "Root@BetterDataGH.com" },
    "user",
    { ADMIN_SUPERADMIN_EMAILS: "root@betterdatagh.com" }
  ),
  "superadmin"
);
assert.equal(resolveAdminScope({ id: "u8", firebaseUid: "u8" }, "user", {}), null);
assert.equal(
  isValidAdminApiKey("key-1", {
    ADMIN_API_KEY: "key-1"
  }),
  true
);
assert.equal(
  isValidAdminApiKey("bad", {
    ADMIN_API_KEY: "key-1"
  }),
  false
);
