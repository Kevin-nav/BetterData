import assert from "node:assert/strict";

import { resolveResendTimeoutMs } from "./client";

assert.equal(resolveResendTimeoutMs({}), 10000);
assert.equal(resolveResendTimeoutMs({ RESEND_TIMEOUT_MS: "" }), 10000);
assert.equal(resolveResendTimeoutMs({ RESEND_TIMEOUT_MS: "10" }), 10000);
assert.equal(resolveResendTimeoutMs({ RESEND_TIMEOUT_MS: "999" }), 10000);
assert.equal(resolveResendTimeoutMs({ RESEND_TIMEOUT_MS: "1000" }), 1000);
assert.equal(resolveResendTimeoutMs({ RESEND_TIMEOUT_MS: "15000" }), 15000);
assert.equal(resolveResendTimeoutMs({ RESEND_TIMEOUT_MS: "not-a-number" }), 10000);
