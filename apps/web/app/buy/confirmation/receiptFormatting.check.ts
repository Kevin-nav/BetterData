import assert from "node:assert/strict";

import { formatReceiptDate } from "./receiptFormatting";

const formatted = formatReceiptDate(Date.UTC(2026, 5, 2, 11, 30), undefined, false);

assert.equal(typeof formatted, "string");
assert.ok(formatted.length > 0);
assert.match(formatted, /2026/);
assert.doesNotThrow(() => formatReceiptDate(undefined, "2026-06-02T11:30:00.000Z", false));
assert.equal(formatReceiptDate(undefined, undefined, false), "");
assert.doesNotThrow(() => formatReceiptDate(undefined, undefined, true));
