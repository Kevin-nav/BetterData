# Datamartgh.shop API Documentation

## Base URL
https://api.datamartgh.shop/api/developer


## Authentication
All API requests require an API key sent in the X-API-Key header.

// Request headers
{
  "Content-Type": "application/json",
  "X-API-Key": "your_api_key_here"
}
Generate API Key
POST
/generate-api-key
Requires JWT authentication. Returns a new API key for your account.

Rate Limits
200 requests/min
General API
150 requests/min

Purchases
120 requests/min

## Balance Checks
Every response includes a rateLimit object showing your remaining requests and reset time.

// Rate limit info in every response:
"rateLimit": {
  "limit": 150,        // max requests per minute
  "remaining": 147,    // requests left before limit
  "resetInSeconds": 45 // seconds until counter resets
}

// Also available as response headers:
// X-RateLimit-Limit: 150
// X-RateLimit-Remaining: 147
// X-RateLimit-Reset: 45


## Purchase Data
POST
/purchase
Headers
Header	Required	Description
X-API-Key	yes	Your DataMart API key
Content-Type	yes	application/json
X-Idempotency-Key	recommended	Unique per request. Repeat within 24h returns the original response — safe to retry
Request Body
{
  "phoneNumber": "0551234567",
  "network": "YELLO",        // YELLO | TELECEL | AT_PREMIUM
  "capacity": "5",           // Data in GB
  "gateway": "wallet"        // Payment method
}
Response
{
  "status": "success",
  "message": "Data bundle purchased successfully",
  "data": {
    "purchaseId": "60f1e5b3e6b39812345678",
    "orderReference": "GN-AB12CD34",
    "transactionReference": "TRX-a1b2c3d4-...",
    "network": "YELLO",
    "capacity": 5,
    "price": 23.00,
    "balanceBefore": 100.00,
    "balanceAfter": 77.00,
    "orderStatus": "completed",
    "processingMethod": "geonettech_api"
  },
  "rateLimit": {
    "limit": 150,
    "remaining": 147,
    "resetInSeconds": 45
  }
}
Error Response:

{
  "status": "error",
  "message": "Insufficient wallet balance",
  "currentBalance": 10.00,
  "requiredAmount": 23.00
}
Idempotency
Send a fresh UUID (or unique string) in X-Idempotency-Key per logical purchase.
If the same key is seen again within 24h on the same API key, we return the original response — no duplicate charge.
Safe retry: on network timeout or 5xx, retry with the same key.
Requests already being processed return 409 REQUEST_IN_PROGRESS.
Heads up: the key is currently optional on /purchase but will become required. API requests that omit it are being logged so we can notify affected resellers ahead of the cut-over. Start sending it now to stay safe.

Example
curl -X POST https://api.datamartgh.shop/api/purchase \
  -H "X-API-Key: $DM_API_KEY" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0551234567","network":"YELLO","capacity":"5","gateway":"wallet"}'



## Bulk Purchase
Send up to 50 orders in a single request. The system validates all orders and checks your total balance upfront before processing.

POST
/bulk-purchase
Headers
Header	Required	Description
X-API-Key	yes	Your DataMart API key
Content-Type	yes	application/json
X-Idempotency-Key	recommended	Unique per batch. Repeat within 24h returns the original batch response — safe to retry the whole batch
Request Body
{
  "orders": [
    {
      "phoneNumber": "0551234567",
      "network": "YELLO",
      "capacity": "5",
      "ref": "MY-001"          // Optional - your own reference
    },
    {
      "phoneNumber": "0201234567",
      "network": "TELECEL",
      "capacity": "10",
      "ref": "MY-002"
    },
    {
      "phoneNumber": "0271234567",
      "network": "AT_PREMIUM",
      "capacity": "2"
    }
  ]
}
Response
{
  "status": "success",
  "message": "Bulk order processed: 3 queued, 0 failed",
  "data": {
    "summary": {
      "total": 3,
      "successful": 3,
      "failed": 0,
      "invalid": 0,
      "totalCharged": 42.50,
      "remainingBalance": 157.50
    },
    "results": [
      {
        "index": 1,
        "ref": "MY-001",
        "phoneNumber": "0551234567",
        "network": "YELLO",
        "capacity": "5",
        "price": 23.00,
        "status": "queued",
        "purchaseId": "60f1e5b3...",
        "orderReference": "MY-001",
        "transactionReference": "TRX-...",
        "balanceBefore": 200.00,
        "balanceAfter": 177.00
      },
      ...
    ],
    "validationErrors": []
  }
}
How It Works
1. All orders are validated first (phone, network, package exists)

2. Total cost is calculated and checked against your balance

3. Each order is processed sequentially with its own transaction

4. If balance runs out mid-batch, remaining orders stop

5. Webhooks fire for each order individually

Limits: Maximum 50 orders per request. Each order must have phoneNumber, network, and capacity. The ref field is optional for your own tracking.

Insufficient Balance Error:

{
  "status": "error",
  "message": "Insufficient wallet balance for this bulk order",
  "data": {
    "totalCost": 250.00,
    "walletBalance": 100.00,
    "validOrders": 5,
    "shortfall": 150.00
  }
}
Idempotency
Generate one fresh UUID per batch and send it in X-Idempotency-Key. The whole batch is one logical request — don't use per-order keys here.
If the same key is seen again within 24h on the same API key, we return the original batch response — wallet is not re-charged and orders are not re-queued.
Safe retry: on network timeout or 5xx, retry with the same key. Never retry with a new key after a timeout — you will double-charge the entire batch.
Requests already being processed return 409 REQUEST_IN_PROGRESS.
Heads up: currently optional but will become required. API requests that omit it are being logged so affected resellers get notified before the cut-over. Start sending it now.

Example
curl -X POST https://api.datamartgh.shop/api/bulk-purchase \
  -H "X-API-Key: $DM_API_KEY" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"orders":[{"phoneNumber":"0551234567","network":"YELLO","capacity":"5","ref":"MY-001"}]}'


## Order Status
GET
/order-status/:reference
Check the status of an order using its orderReference.

{
  "status": "success",
  "data": {
    "orderId": "60f1e5b3e6b39812345678",
    "reference": "GN-AB12CD34",
    "phoneNumber": "0551234567",
    "network": "YELLO",
    "capacity": 5,
    "price": 23.00,
    "orderStatus": "completed",
    "processingMethod": "geonettech_api",
    "createdAt": "2024-01-15T10:28:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
Status Values
pending
waiting
processing
completed
failed
refunded



## Live Delivery Tracker
Track your orders in real-time as they move through our delivery pipeline.

Two ways to get delivery updates — choose what suits you
Both methods give you the same live data. Pick the one that fits your setup.

Method 1: Widget
One script tag — we handle everything. Beautiful pre-built UI that auto-updates. No coding needed.

RECOMMENDED
Method 2: API Endpoint
Full JSON response — build your own custom UI. Poll every 10-30 seconds for live updates.

FOR CUSTOM UIs
Method 1: Embeddable Widget
Paste one line, your customers see live delivery tracking instantly.

Live Preview — this is what your customers see
Dark
Light
Delivery Tracker · Live
×
Yello portal is processing orders steadily. Estimated delivery: 1-2 hours.

38
Delivered
4
Pending
45
Checked
Last Delivered
Tracking #1557392 — placed at Apr 03, 10:03 AM, delivered at Apr 03, 11:51 AM
Checking now: Batch #1557079
055****567
YELLO · 5GB
Delivered
020****890
TELECEL · 10GB
Pending
027****234
YELLO · 2GB
Delivered
Install — paste before </body>
<script src="https://api.datamartgh.shop/widgets/delivery-tracker.js"
        data-api-key="YOUR_API_KEY" data-theme="dark">
</script>
Floating (default)
Button in the corner, click to open panel.

<script src="...delivery-tracker.js"
  data-api-key="KEY"
  data-position="bottom-right">
</script>
Inline (in your page)
Embeds inside a div, no floating button.

<div id="tracker"></div>
<script src="...delivery-tracker.js"
  data-api-key="KEY"
  data-container="tracker">
</script>
Widget Options
data-theme
dark | light
data-position
bottom-right | bottom-left | top-right | top-left
data-poll
seconds (default 15)
data-container
div ID for inline mode
Method 2: API Endpoint
Build your own UI — poll this endpoint every 10-30 seconds.

GET
/delivery-tracker
{
  "status": "success",
  "data": {
    "message": "Delivery scanner is actively checking orders...",
    "scanner": { "active": true, "waiting": false, "waitSeconds": 0 },
    "stats": { "checked": 45, "delivered": 38, "partial": 3, "pending": 4, "failed": 0 },
    "lastDelivered": {
      "trackingId": "1557392",
      "summary": "Tracking #1557392 — placed at Apr 03, 10:03 AM, delivered at Apr 03, 11:51 AM"
    },
    "checkingNow": { "summary": "Checking now: Batch #1557079" },
    "yourOrders": {
      "inCurrentBatch": [
        { "phone": "055****567", "network": "YELLO", "capacity": 5, "deliveryStatus": "Sent" }
      ],
      "inLastDeliveredBatch": [...]
    }
  }
}
Scanner States
Active — Scanner is checking deliveries
Waiting — Paused between checks
Idle — Scanner is not running
Tip: Combine this with webhooks for the best experience — use the tracker for a live display, and webhooks for instant per-order delivery notifications.



## Data Packages
GET
/data-packages?network=YELLO
Get available data packages. Optionally filter by network: YELLO, TELECEL, AT_PREMIUM

{
  "status": "success",
  "pricingTier": "reseller",
  "data": {
    "YELLO": [
      { "capacity": 1, "mb": 1024, "network": "YELLO", "price": 4.00 },
      { "capacity": 2, "mb": 2048, "network": "YELLO", "price": 9.00 },
      { "capacity": 5, "mb": 5120, "network": "YELLO", "price": 23.00 }
    ],
    "TELECEL": [ ... ],
    "AT_PREMIUM": [ ... ]
  }
}



## Balance
GET
/balance
{
  "status": "success",
  "data": {
    "balance": 192.50,
    "currency": "GHS",
    "user": {
      "id": "60f1e5b3e6b39812345678",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "timestamp": "2024-01-15T12:00:00.000Z"
  }
}




## Withdrawal API
Trigger Mobile Money payouts from your platform. Your DataMart wallet is charged amount + fee, the recipient receives exactly amount, and DataMart keeps the fee (default 2%).

⚠ Access is admin-gated

This endpoint is disabled by default on every API key. Contact DataMart support to request access. You'll be issued a signing secret (shown once) and your limits configured.

Base URL
https://api.datamartgh.shop/api/developer/v1/withdrawals
Required Headers
Header	Required	Description
X-API-Key	yes	Your DataMart API key
X-Idempotency-Key	yes	Unique per request. Repeat within 24h returns the original response — safe to retry
X-Signature	yes*	HMAC-SHA256 hex digest of {ts}.{method}.{path}.{body}
X-Timestamp	yes*	Millisecond epoch; must be within 5 minutes of server time
Content-Type	yes	application/json
* Required when HMAC is enforced on your key (default: yes)

Create a withdrawal
POST
/api/developer/v1/withdrawals
Request body:

{
  "amount": 50.00,
  "phoneNumber": "0541234567",
  "network": "MTN",
  "recipientName": "Kwame Mensah",
  "clientRef": "your-internal-ref-12345"
}
Fields
amount — GHS. Recipient receives exactly this. Min 10, max = your singleTxnLimit.
phoneNumber — 10-digit Ghana number (0541234567); 233 prefix also accepted.
network — MTN / TELECEL / AIRTELTIGO. Aliases: VOD, VODAFONE → TELECEL; AIR, AT, ATL, TIGO → AIRTELTIGO.
recipientName — optional, shown on the payout if provider supports it.
clientRef — optional, your own reference stored alongside our reference.
Success response (200):

{
  "status": "success",
  "data": {
    "reference": "RSW-1744849000-A1B2C3D4",
    "clientRef": "your-internal-ref-12345",
    "status": "processing",
    "amount": 50,
    "fee": 1,
    "feePercent": 2,
    "totalCharged": 51,
    "recipient": { "phone": "0541234567", "network": "MTN", "name": "Kwame Mensah" },
    "provider": "paystack",
    "balanceBefore": 520.5,
    "balanceAfter": 469.5,
    "createdAt": "2026-04-17T10:30:00Z"
  }
}
Check status
GET
/api/developer/v1/withdrawals/:reference
Returns the same shape as create. If still processing, we poll the provider fresh before responding.

Status lifecycle: pending → processing → completed OR failed → refunded

List withdrawals
GET
/api/developer/v1/withdrawals?status=completed&page=1&limit=20
Query params: status (optional), date (YYYY-MM-DD — shortcut for one day),from / to (YYYY-MM-DD or ISO timestamp), page, limit (max 100).

For a single day:

GET
/api/developer/v1/withdrawals?date=2026-05-01
For a date range:

GET
/api/developer/v1/withdrawals?from=2026-05-01&to=2026-05-07&status=completed
The response includes a summary object with count, totalAmount,completedCount, and completedAmount for the current page — useful for daily reconciliation without summing items client-side.

{
  "status": "success",
  "data": {
    "withdrawals": [ /* ... */ ],
    "summary": {
      "count": 12,
      "totalAmount": 1840.00,
      "completedCount": 11,
      "completedAmount": 1700.00
    },
    "filters": {
      "status": "completed",
      "from": "2026-05-01T00:00:00.000Z",
      "to":   "2026-05-01T23:59:59.999Z"
    },
    "pagination": { "page": 1, "limit": 20, "total": 12, "pages": 1 }
  }
}
Check your limits
GET
/api/developer/v1/withdrawals/meta/limits
{
  "status": "success",
  "data": {
    "walletBalance": 520.5,
    "feePercent": 2,
    "singleTxnLimit": 1000,
    "dailyLimit": 10000,
    "todayWithdrawn": 340,
    "todayRemaining": 9660,
    "totalWithdrawn": 12840,
    "hmacRequired": true
  }
}
HMAC Request Signing
Every mutating request must include a signature (when HMAC is enforced on your key).

Payload format:

{timestamp}.{method}.{path}.{rawBody}
Node.js example:

const crypto = require('crypto');
const axios = require('axios');

const API_KEY = 'your_api_key';
const SIGNING_SECRET = 'your_signing_secret';

async function sendWithdrawal(body, idemKey) {
  const timestamp = Date.now().toString();
  const path = '/api/developer/v1/withdrawals';
  const raw = JSON.stringify(body);
  const payload = `${timestamp}.POST.${path}.${raw}`;
  const signature = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');

  return axios.post('https://api.datamartgh.shop' + path, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'X-Idempotency-Key': idemKey,
      'X-Signature': signature,
      'X-Timestamp': timestamp
    }
  });
}
Python example:

import hmac, hashlib, json, time, requests

API_KEY = 'your_api_key'
SIGNING_SECRET = 'your_signing_secret'
BASE_URL = 'https://api.datamartgh.shop'

def send_withdrawal(body: dict, idem_key: str):
    timestamp = str(int(time.time() * 1000))
    path = '/api/developer/v1/withdrawals'
    raw = json.dumps(body, separators=(',', ':'))
    payload = f"{timestamp}.POST.{path}.{raw}"
    signature = hmac.new(SIGNING_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()

    return requests.post(BASE_URL + path, data=raw, headers={
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        'X-Idempotency-Key': idem_key,
        'X-Signature': signature,
        'X-Timestamp': timestamp
    })
⚠ Sign the EXACT bytes you POST. If your HTTP library re-serializes the body, the signature won't match.

Replay protection
Requests more than 5 minutes off server time are rejected with INVALID_TIMESTAMP.
After 5 invalid signatures in a 10-minute window, withdrawal access on your key is auto-disabled. Re-enable via support.
Idempotency
Supply a fresh UUID (or unique string) in X-Idempotency-Key per logical request.
If the same key is seen again within 24h on the same API key, we return the original response — no duplicate charge.
Safe retry: on timeout or 5xx, retry with the same idempotency key.
Error codes
HTTP	Code	Meaning
400	MISSING_IDEMPOTENCY_KEY	Header omitted
400	AMOUNT_TOO_SMALL	Below GHS 10
400	AMOUNT_EXCEEDS_LIMIT	Above your singleTxnLimit
400	INVALID_PHONE	Not a valid 10-digit GH number
400	INVALID_NETWORK	Not one of MTN/TELECEL/AIRTELTIGO
400	NETWORK_MISMATCH	Phone prefix doesn't match supplied network
400	INSUFFICIENT_BALANCE	Wallet < amount + fee
400	DAILY_LIMIT_REACHED	Daily cap would be exceeded
401	INVALID_SIGNATURE	HMAC mismatch
401	INVALID_TIMESTAMP	Outside 5-minute window
403	WITHDRAWAL_NOT_ENABLED	Admin hasn't enabled withdrawals on your key
403	IP_NOT_ALLOWED	Your IP is not in the allowlist
429	RATE_LIMIT_EXCEEDED	>30 requests/min
502	PROVIDER_FAILED	Provider rejected; wallet already refunded
Default limits
• Min single withdrawal: GHS 10
• Max single withdrawal: GHS 1,000 (admin-configurable up to GHS 50,000)
• Daily total: GHS 10,000 (admin-configurable)
• Fee: 2% on top (admin-configurable)
• Rate limit: 30 requests/minute
End-to-end cURL
curl -X POST https://api.datamartgh.shop/api/developer/v1/withdrawals \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $DM_API_KEY" \
  -H "X-Idempotency-Key: 7f83a3e0-1f3e-4d7e-b5f9-001" \
  -H "X-Timestamp: 1744849000000" \
  -H "X-Signature: $HMAC_HEX" \
  -d '{
    "amount": 50,
    "phoneNumber": "0541234567",
    "network": "MTN",
    "clientRef": "payout-001"
  }'

# Then poll:
curl https://api.datamartgh.shop/api/developer/v1/withdrawals/RSW-1744849000-A1B2C3D4 \
  -H "X-API-Key: $DM_API_KEY"
Recommended polling cadence

Webhook delivery is not implemented yet (v1). Until it ships, poll GET /:reference:

Immediately after creation (catches fast-provider completed)
Every 5–10 seconds for the first 2 minutes
Every 30 seconds until terminal status or 15 minutes
At 15 min stuck — contact support with the reference. Never retry with a new idempotency key, it'll double-charge.
⚠ Stuck in processing?

If a withdrawal stays in processing for more than 15 minutes, don't retry — contact support with the reference. Retrying with a different idempotency key will double-charge your wallet.




## Transactions
GET
/transactions?page=1&limit=20
{
  "status": "success",
  "data": {
    "transactions": [
      {
        "type": "purchase",
        "amount": 23.00,
        "status": "completed",
        "reference": "TRX-a1b2c3d4-...",
        "gateway": "wallet",
        "createdAt": "2024-01-15T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 92
    }
  }
}
Purchase History
GET
/purchase-history/:userId?page=1&limit=20
Returns detailed purchase records with balance tracking.

Claim Referral Bonus
POST
/claim-referral-bonus
Claim any pending referral bonuses for your account.




Usage Statistics
GET
/usage/stats

Load Stats
GET
/usage/history?page=1&limit=20
Get detailed API call history with pagination.


## Webhooks
How do I get my webhook secret?
Enter your API Key below and set your Webhook URL
Select the events you want to receive and click Save
Your webhook secret will be shown once after saving — copy it immediately
Use this secret to verify the X-DataMart-Signature header on incoming webhooks
The secret is only displayed once at configuration time. If you lose it, delete and reconfigure your webhook to get a new one.

Configure Webhook
Enter your API Key to load webhook config
Load My Webhook
https://your-server.com/webhook

Created
Processing
Completed
Failed
Refunded
Save
Payload Format
{
  "event": "order.completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "orderId": "60f1e5b3e6b39812345678",
    "orderReference": "GN-AB12CD34",
    "transactionId": "TRX-a1b2c3d4-...",
    "phone": "0551234567",
    "network": "YELLO",
    "capacity": 5,
    "price": 20.50,
    "status": "completed",
    "createdAt": "2024-01-15T10:28:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
Headers
X-DataMart-Signature: <HMAC-SHA256 signature>
X-DataMart-Event: order.completed
Content-Type: application/json
Verify Signature (Node.js)
const crypto = require('crypto');

app.post('/webhook', (req, res) => {
  const sig = req.headers['x-datamart-signature'];
  const expected = crypto
    .createHmac('sha256', YOUR_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (sig !== expected) return res.status(401).json({ error: 'Invalid' });

  const { event, data } = req.body;
  console.log(event, data.orderReference, data.status);
  res.json({ received: true });
});
Events
order.created
New order placed

order.processing
Order being processed

order.completed
Data delivered

order.failed
Order failed

order.refunded
Order refunded



## Delivery Tracker Widget
Drop a single <script> tag into your website and get a beautiful live delivery tracker. No coding, no dependencies — just paste and go.

NEW
Zero-config embeddable widget
One line. Live delivery tracking.
Your customers see real-time delivery status — updated every 15 seconds automatically.

<script src="https://api.datamartgh.shop/widgets/delivery-tracker.js"
        data-api-key="YOUR_API_KEY" data-theme="dark">
</script>
Live Preview
Dark
Light
Delivery Tracker · Live
×
Yello portal is processing orders steadily. Estimated delivery: 1-2 hours.

38
Delivered
4
Pending
45
Checked
Last Delivered
Tracking #1557392 — placed at Apr 03, 10:03 AM, delivered at Apr 03, 11:51 AM
Checking now: Batch #1557079
055****567
YELLO · 5GB
Delivered
020****890
TELECEL · 10GB
Pending
027****234
YELLO · 2GB
Delivered
Setup in 3 Steps
1. Get your API key
Go to your dashboard and generate an API key if you haven't already.

2. Paste the script tag
Add one line before </body> in your HTML.

3. Done! Widget auto-updates
The widget polls every 15 seconds and shows your customers live delivery status.

Configuration Options
Attribute	Default	Description
data-api-key	required	Your DataMart API key
data-theme	dark	dark or light
data-position	bottom-right	bottom-right | bottom-left | top-right | top-left
data-poll	15	Refresh interval in seconds (min 5)
data-container	—	ID of a div to embed inline (no floating button)
Floating Mode
A button appears in the corner. Users click to open the tracker panel.

<script
  src="https://api.datamartgh.shop/widgets/delivery-tracker.js"
  data-api-key="YOUR_KEY"
  data-theme="dark"
  data-position="bottom-right">
</script>
Inline Mode
Embeds directly inside a div on your page — no floating button.

<div id="tracker"></div>
<script
  src="https://api.datamartgh.shop/widgets/delivery-tracker.js"
  data-api-key="YOUR_KEY"
  data-theme="light"
  data-container="tracker">
</script>
What Your Customers See
🟢
Live Status
Green/yellow/gray dot shows scanner state in real-time

📊
Delivery Stats
Delivered, pending, and checked order counts

✅
Last Delivered
Tracking ID with placed & delivered timestamps

🔍
Currently Checking
Which batch is being scanned right now

📦
Their Orders
Customer sees their own orders with masked phone numbers

🏷️
Status Badges
Delivered (green), Pending (yellow), Failed (red) per order



## Code Samples
Node.js / Next.js
const axios = require('axios');
const { randomUUID } = require('crypto');

const datamart = axios.create({
  baseURL: 'https://api.datamartgh.shop/api/developer',
  headers: { 'X-API-Key': process.env.DATAMART_API_KEY }
});

// Purchase data — retry-safe via X-Idempotency-Key
const { data } = await datamart.post('/purchase', {
  phoneNumber: '0551234567',
  network: 'YELLO',
  capacity: '5',
  gateway: 'wallet'
}, {
  headers: { 'X-Idempotency-Key': randomUUID() }
});

console.log(data.data.orderReference); // GN-AB12CD34

// Check status
const status = await datamart.get(`/order-status/${data.data.orderReference}`);
console.log(status.data.data.orderStatus); // completed

// Bulk purchase (up to 50 orders) — one key for the whole batch
const bulk = await datamart.post('/bulk-purchase', {
  orders: [
    { phoneNumber: '0551234567', network: 'YELLO', capacity: '5', ref: 'MY-001' },
    { phoneNumber: '0201234567', network: 'TELECEL', capacity: '10', ref: 'MY-002' },
    { phoneNumber: '0271234567', network: 'AT_PREMIUM', capacity: '2' }
  ]
}, {
  headers: { 'X-Idempotency-Key': randomUUID() }
});

console.log(bulk.data.data.summary);
// { total: 3, successful: 3, failed: 0, totalCharged: 42.50 }
bulk.data.data.results.forEach(r =>
  console.log(`${r.ref}: ${r.status} - ${r.orderReference}`)
);
Python
import requests, uuid

API_KEY = "your_api_key_here"
BASE = "https://api.datamartgh.shop/api/developer"
headers = { "X-API-Key": API_KEY, "Content-Type": "application/json" }

# Purchase data — retry-safe via X-Idempotency-Key
res = requests.post(f"{BASE}/purchase", json={
    "phoneNumber": "0551234567",
    "network": "YELLO",
    "capacity": "5",
    "gateway": "wallet"
}, headers={ **headers, "X-Idempotency-Key": str(uuid.uuid4()) })

order = res.json()["data"]
print(f"Order: {order['orderReference']}, Status: {order['orderStatus']}")

# Check status
status = requests.get(f"{BASE}/order-status/{order['orderReference']}", headers=headers)
print(status.json()["data"]["orderStatus"])

# Bulk purchase (up to 50 orders) — one key for the whole batch
bulk = requests.post(f"{BASE}/bulk-purchase", json={
    "orders": [
        {"phoneNumber": "0551234567", "network": "YELLO", "capacity": "5", "ref": "MY-001"},
        {"phoneNumber": "0201234567", "network": "TELECEL", "capacity": "10", "ref": "MY-002"},
        {"phoneNumber": "0271234567", "network": "AT_PREMIUM", "capacity": "2"}
    ]
}, headers={ **headers, "X-Idempotency-Key": str(uuid.uuid4()) })

summary = bulk.json()["data"]["summary"]
print(f"Processed: {summary['successful']}/{summary['total']}, Charged: {summary['totalCharged']}")
for r in bulk.json()["data"]["results"]:
    print(f"  {r.get('ref', '-')}: {r['status']}")
