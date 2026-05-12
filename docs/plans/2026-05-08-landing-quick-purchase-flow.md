# Landing Quick Purchase Flow

## Goal

Turn the homepage quick purchase widget into a working guest purchase surface backed by the simulated vendor API.

## Scope

This flow is intentionally narrow:

- Load packages from `GET /data-packages`.
- Let a guest select network, package, and recipient phone number.
- Require the wrong-number responsibility confirmation.
- Submit to `POST /orders`.
- Show the returned reference, status, vendor, and estimated delivery time.
- Allow manual status refresh through `GET /orders/:reference/status`.

This does not add auth, wallet payments, Paystack collection, saved numbers, receipts, or order persistence UI yet.

## UX Flow

1. User chooses MTN, Telecel, or AirtelTigo.
2. The widget displays packages for that network from the active vendor.
3. User enters a recipient phone number.
4. User checks the confirmation box that the recipient number is correct.
5. User submits the order.
6. The widget displays a result panel with the simulated vendor response.
7. User can refresh the order status.

## API Wiring

The web app reads:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

The API defaults to:

```env
BETTERDATA_ACTIVE_DATA_VENDOR=sandbox-fast
```

Other useful local modes:

- `sandbox-delayed`: 30-minute processing, or 60 minutes when the phone ends in `60`.
- `sandbox-flaky`: failure path when the phone ends in `99`.
- `datamart`: DataMart-shaped fake transport with no real HTTP calls.

## Deployment Notes

The deployed web app must receive `NEXT_PUBLIC_API_BASE_URL` at build time. Kubernetes already loads `betterdata-web-env`; that secret should include the public API base URL for the deployed API.

For local development, `.env.example` documents both `API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL`.

