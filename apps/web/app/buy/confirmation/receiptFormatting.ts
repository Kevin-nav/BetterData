export function formatReceiptDate(
  receiptCreatedAt: number | undefined,
  localRecordCreatedAt: string | undefined,
  fallbackToCurrent: boolean
): string {
  if (typeof receiptCreatedAt === "number" && !isNaN(receiptCreatedAt)) {
    return formatDateTime(receiptCreatedAt);
  }

  if (localRecordCreatedAt) {
    const parsed = Date.parse(localRecordCreatedAt);
    if (!isNaN(parsed)) {
      return formatDateTime(parsed);
    }
  }

  if (fallbackToCurrent) {
    return formatDateTime(Date.now());
  }

  return "";
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
