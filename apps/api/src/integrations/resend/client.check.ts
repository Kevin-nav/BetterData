import assert from "node:assert/strict";

import {
  readResendSender,
  sendAgentApplicationApprovedEmail
} from "./client";

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const originalError = console.error;
const originalEnv = { ...process.env };

try {
  console.warn = () => undefined;
  console.error = () => undefined;

  delete process.env.RESEND_API_KEY;
  assert.equal(readResendSender({}), "Better Data <noreply@betterdatagh.com>");
  assert.equal(
    readResendSender({ RESEND_SENDER_EMAIL: "Better Data <verified@betterdatagh.com>" }),
    "Better Data <verified@betterdatagh.com>"
  );

  const missingKeyResult = await sendAgentApplicationApprovedEmail({
    email: "agent@example.com",
    displayName: "Agent"
  });

  assert.equal(missingKeyResult.status, "failed");
  assert.match(missingKeyResult.errorMessage ?? "", /RESEND_API_KEY/);

  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_SENDER_EMAIL = "Better Data <verified@betterdatagh.com>";

  let requestBody: any = null;
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response("sender domain is not verified", { status: 403 });
  }) as typeof fetch;

  const rejectedResult = await sendAgentApplicationApprovedEmail({
    email: "agent@example.com",
    displayName: "Agent"
  });

  assert.equal(rejectedResult.status, "failed");
  assert.equal(rejectedResult.errorMessage, "sender domain is not verified");
  assert.equal(requestBody.from, "Better Data <verified@betterdatagh.com>");

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ id: "email_test" }), { status: 200 })) as typeof fetch;

  const sentResult = await sendAgentApplicationApprovedEmail({
    email: "agent@example.com",
    displayName: "Agent"
  });

  assert.deepEqual(sentResult, { status: "sent" });
} finally {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  console.error = originalError;
  process.env = originalEnv;
}

console.log("resend client checks passed");
