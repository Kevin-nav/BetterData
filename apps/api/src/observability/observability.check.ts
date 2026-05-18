import assert from "node:assert/strict";

import { orderLogFields } from "./logFields";
import {
  getMetric,
  incrementMetric,
  resetMetricsForTests,
  snapshotMetrics
} from "./metrics";

assert.deepEqual(orderLogFields({ orderReference: "BD-1", attempt: 2 }), {
  orderReference: "BD-1",
  attempt: 2
});

resetMetricsForTests();
incrementMetric("purchase.success");
incrementMetric("purchase.success", 2);
assert.equal(getMetric("purchase.success"), 3);
assert.deepEqual(snapshotMetrics(), { "purchase.success": 3 });
