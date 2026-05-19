import assert from "node:assert/strict";

import { DataMartHttpError, DataMartNetworkError } from "./datamart/transport";
import { mapVendorErrorToHttp } from "./errors";

assert.deepEqual(
  mapVendorErrorToHttp(
    new DataMartHttpError(
      "Rate limited",
      429,
      { message: "Rate limited" },
      { resetInSeconds: 17 }
    )
  ),
  {
    statusCode: 503,
    message: "Data vendor is rate limited. Try again shortly.",
    retryAfterSeconds: 17
  }
);

assert.deepEqual(
  mapVendorErrorToHttp(
    new DataMartHttpError(
      "Insufficient wallet balance",
      400,
      { message: "Insufficient wallet balance" }
    )
  ),
  {
    statusCode: 503,
    message: "Data vendor wallet has insufficient balance."
  }
);

assert.deepEqual(
  mapVendorErrorToHttp(
    new DataMartHttpError("Invalid phone", 400, { message: "Invalid phone" })
  ),
  {
    statusCode: 400,
    message: "The data purchase request is invalid."
  }
);

assert.deepEqual(
  mapVendorErrorToHttp(new DataMartNetworkError("failed", new Error("network"))),
  {
    statusCode: 502,
    message: "Data vendor is unavailable right now."
  }
);
