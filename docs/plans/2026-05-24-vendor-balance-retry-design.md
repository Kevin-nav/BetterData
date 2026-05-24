# Vendor Balance History and Low-Balance Retry Design

## Goal

Track DataMart vendor balance over time in the admin dashboard and make paid data purchases recover automatically when fulfillment is blocked by low vendor balance.

## Design

Vendor balance history should be event-driven and sampled. Scheduled/admin balance checks are useful, but purchase responses can carry fresher balance information at the exact moment money moves. We will store balance snapshots from both sources with a `source` field so the chart can show operational reality without needing aggressive polling.

Paid data purchases that cannot be fulfilled because the DataMart wallet is too low should not become terminal failures immediately. The order should remain in a retryable processing state, with ops visibility, while the platform waits for the vendor wallet to recover. The retry window is one hour. During that hour, scheduled retry jobs check the vendor balance and attempt fulfillment once there is enough balance.

If the retry window expires, registered users get an automatic BetterData wallet credit for the paid amount. Guest purchases cannot be safely credited to a platform wallet, so they generate an ops alert for manual refund/support handling.

## Data Flow

1. Payment succeeds and a purchase job is queued.
2. Purchase worker attempts DataMart fulfillment.
3. If DataMart or the preflight balance guard reports insufficient vendor balance, the order stays `processing`.
4. A retry alert/job is scheduled with `retryAction: "fulfill_order"` and a deadline one hour after the first low-balance block.
5. Payment retry cron requeues fulfillment while within the retry window.
6. When balance is sufficient, fulfillment proceeds and the order reaches `processing` or `completed`.
7. If one hour expires:
   - registered user: credit BetterData wallet and mark order `refunded`;
   - guest: mark order `failed` and create a critical ops alert.

## Admin UX

The admin dashboard gets a DataMart balance chart sourced from Convex balance snapshots. The existing vendor balance card remains the current/latest value. The chart should show trend data for recent history, starting with the last 24 hours or the available records.

## Safety

Retries must not charge Paystack again. Fulfillment retries use a fresh vendor idempotency key while keeping the original BetterData order/payment reference. Wallet credit must be idempotent and tied to the order reference so repeated timeout jobs cannot double-credit the user.
