import { createOrderStore } from "./orders/orderStore";
import { configureMetricsFromEnv } from "./observability/metrics";
import { createQueueProvider } from "./queue";
import { getActiveDataVendor } from "./vendors/activeVendor";
import { startPurchaseWorker } from "./workers/purchaseWorker";
import { startStatusWorker } from "./workers/statusWorker";

type ShutdownTarget = {
  close?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
};

const logger = console;

let shuttingDown = false;
let cleanup: (() => Promise<void>) | undefined;

try {
  cleanup = await bootstrapWorker();
} catch (error) {
  logger.error({ error, component: "worker" }, "Better Data worker startup failed");
  process.exit(1);
}

async function bootstrapWorker() {
  configureMetricsFromEnv();

  const queue = await createQueueProvider();
  const orderStore = createOrderStore();
  const vendor = getActiveDataVendor();
  const targets = [
    { component: "queue", target: queue as ShutdownTarget },
    { component: "orderStore", target: orderStore as ShutdownTarget }
  ];
  const detachListeners = targets.map(({ component, target }) =>
    attachLifecycleListeners(component, target, () => {
      void shutdown(1, `Worker ${component} lifecycle failure`);
    })
  );

  const stopPurchaseWorker = await startPurchaseWorker({
    queue,
    orderStore,
    vendor,
    logger
  });
  const stopStatusWorker = await startStatusWorker({ queue, orderStore, vendor });

  process.once("SIGINT", () => {
    void shutdown(0, "Worker received SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown(0, "Worker received SIGTERM");
  });

  logger.log("Better Data worker started.");

  return async () => {
    for (const detach of detachListeners) {
      detach();
    }

    await stopStatusWorker();
    await stopPurchaseWorker();
    await cleanupTarget("queue", queue as ShutdownTarget);
    await cleanupTarget("orderStore", orderStore as ShutdownTarget);
  };
}

async function shutdown(exitCode: number, reason: string) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.log({ component: "worker", reason, exitCode }, "Better Data worker stopping");

  try {
    await cleanup?.();
  } catch (error) {
    logger.error({ error, component: "worker" }, "Better Data worker cleanup failed");
    process.exit(1);
  }

  process.exit(exitCode);
}

function attachLifecycleListeners(
  component: string,
  target: ShutdownTarget,
  onFailure: () => void
) {
  if (!target.on) {
    return () => {};
  }

  const handleError = (error: unknown) => {
    logger.error({ error, component }, "Worker component emitted error");
    onFailure();
  };
  const handleClose = () => {
    logger.error({ component }, "Worker component closed");
    onFailure();
  };

  target.on("error", handleError);
  target.on("close", handleClose);

  return () => {
    target.off?.("error", handleError);
    target.off?.("close", handleClose);
  };
}

async function cleanupTarget(component: string, target: ShutdownTarget) {
  try {
    await target.close?.();
    await target.cleanup?.();
  } catch (error) {
    logger.error({ error, component }, "Worker component cleanup failed");
    throw error;
  }
}
