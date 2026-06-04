import { spawn } from "node:child_process";
import path from "node:path";

const checks = [
  "src/config/origins.check.ts",
  "src/config/rateLimits.check.ts",
  "src/auth/adminAuth.check.ts",
  "src/modules/orders/orderValidation.check.ts",
  "src/modules/packages/packages.routes.check.ts",
  "src/modules/payments/payments.routes.check.ts",
  "src/orders/orderStore.check.ts",
  "src/payments/paymentSafety.check.ts",
  "src/queue/amqpConfig.check.ts",
  "src/queue/queue.check.ts",
  "src/redis/upstash.check.ts",
  "src/observability/observability.check.ts",
  "src/workers/purchaseWorker.check.ts",
  "src/workers/statusWorker.check.ts",
  "src/vendors/datamart/config.check.ts",
  "src/vendors/datamart/cache.check.ts",
  "src/vendors/datamart/transport.check.ts",
  "src/vendors/datamart/mapper.check.ts",
  "src/vendors/datamart/purchaseDispatcher.check.ts",
  "src/vendors/errors.check.ts",
  "src/vendors/webhookVerification.check.ts",
  "src/vendors/simulation/simulation.check.ts",
  "src/modules/admin/admin.check.ts",
  "src/integrations/paystack/client.check.ts",
  "src/integrations/resend/client.check.ts",
  "src/analytics/posthog.check.ts",
  "src/telemetry/hash.check.ts"
];

const filters = process.argv.slice(2);
const selectedChecks =
  filters.length === 0
    ? checks
    : checks.filter((check) => filters.some((filter) => check.includes(filter)));

if (selectedChecks.length === 0) {
  console.error(`No checks matched filters: ${filters.join(", ")}`);
  process.exit(1);
}

const results = await Promise.allSettled(selectedChecks.map(runCheck));
const failures = results
  .map((result, index) => ({ result, check: selectedChecks[index] }))
  .filter(
    (entry): entry is {
      check: string;
      result: PromiseRejectedResult;
    } => entry.result.status === "rejected"
  );

if (failures.length > 0) {
  console.error(`\n${failures.length} API check(s) failed:`);
  for (const failure of failures) {
    console.error(`\n- ${failure.check}`);
    console.error(String(failure.result.reason));
  }
  process.exit(1);
}

console.log(`API checks passed (${selectedChecks.length})`);

function runCheck(check: string) {
  return new Promise<void>((resolve, reject) => {
    const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const child = spawn(process.execPath, [tsxCli, path.normalize(check)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        [
          `exit code ${code}`,
          stdout.trim() ? `stdout:\n${stdout.trim()}` : "",
          stderr.trim() ? `stderr:\n${stderr.trim()}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      );
    });
  });
}
