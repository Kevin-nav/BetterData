# 📄 Product Requirements Document
## Better Data — betterdatagh.com


## 1. Overview

**Better Data** is a Ghana-focused data bundle reselling platform that allows customers to purchase mobile data for MTN, Telecel, and AirtelTigo quickly and affordably. It will be available as a web app and a native mobile app with a shared backend. Data fulfillment is powered by the DataMartGH API.


## 2. Goals

- Make buying mobile data simple, fast, and reliable for Ghanaians
- Provide a trusted agent system for resellers
- Build a scalable platform that starts customer-facing and grows into a full agent network
- Maintain full control of the customer relationship — customers only interact with Better Data, never DataMart


## 3. User Roles

| Role | Description |
|---|---|
| **Guest** | Buys data without an account |
| **Registered User** | Has an account, can use wallet, save numbers, view history |
| **Agent** | Paid onboarding, gets discounted prices, has usage dashboard |
| **Admin** | Full platform control via separate admin app |


## 4. Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | Next.js (TypeScript) |
| Mobile App | Expo / React Native (TypeScript) |
| Backend | Node.js + TypeScript (fully typesafe) |
| Auth | Firebase Auth |
| Payments | Paystack (Mobile Money) |
| Email | Resend |
| Data Fulfillment | DataMartGH API |
| Admin App | Separate subdomain (`admin.betterdatagh.com`) |


## 5. Platforms

- **Web:** `betterdatagh.com` — Next.js, fully responsive
- **Mobile:** Expo app for Android & iOS — full dedicated UI, push notifications
- **Admin:** `admin.betterdatagh.com` — separate secured app, same backend

Both web and mobile share the same backend API.


## 6. Authentication

- **Providers:** Email/Password and Google Sign-In via Firebase Auth
- **Guest Access:** Users can buy data without creating an account
- **Device Fingerprinting:** Implemented to detect and prevent a single person from creating multiple accounts to abuse the first-time discount
- **First-Time Discount:** A fixed GHS amount discount applied automatically on the first purchase after a user creates a verified account. Prominently marketed as a banner/prompt during the guest purchase flow to encourage sign-ups


## 7. Supported Networks

| Display Name | DataMart Network Code |
|---|---|
| MTN | `YELLO` |
| Telecel | `TELECEL` |
| AirtelTigo | `AT_PREMIUM` |

Packages are fetched dynamically from the DataMart `/data-packages` endpoint so pricing and availability always stays in sync.


## 8. Core Features

### 8.1 Guest Purchase Flow
1. User selects network → selects package → enters recipient phone number
2. Disclaimer shown: *"Sending to a wrong number is your responsibility — double check before confirming"*
3. User ticks a checkbox confirming the number is correct
4. Pays via Momo through Paystack
5. Order placed via DataMart API
6. On-screen confirmation shown
7. If there is an issue, Better Data contacts them via the Paystack payment phone number

### 8.2 Registered User Purchase Flow
- Same as guest flow, plus:
  - Can select from saved numbers
  - Can pay via Better Data wallet or direct Momo
  - Access to full order/transaction history
  - Receipt downloadable on request (delivered via Resend email)

### 8.3 Buy for Someone Else
- The phone number input field accepts any number (not just the user's own)
- Disclaimer + mandatory checkbox confirmation on every purchase
- No restriction — user takes full responsibility

### 8.4 Saved Numbers
- Registered users can save and name frequently used numbers (e.g. "My MTN", "Mum Telecel")
- Reduces errors, speeds up repeat purchases
- Only available to registered users

### 8.5 Wallet System
- Registered users and agents can load a Better Data wallet
- **Minimum top-up:** GHS 10 (exact amount TBD)
- **Top-up method:** Mobile Money via Paystack only (bank transfer to be added later via Paystack)
- Admin can manually credit or debit any wallet from the admin panel
- Refunds for failed orders are credited back to the user's Better Data wallet

### 8.6 Pricing & Markup
- Admin can set either:
  - A **percentage markup** on top of the DataMart cost, or
  - A **fixed GHS amount markup** per package
- Both options configurable per package or applied globally from the admin panel
- **Agents** receive a **percentage discount** off the standard user-facing price
- There is currently **one agent tier**

### 8.7 Order Management
- All orders tracked with statuses: `pending` → `processing` → `completed` / `failed` / `refunded`
- Real-time status updates via DataMart webhooks
- DataMart Delivery Tracker widget embeddable in the web app
- Registered users can view full order history
- Receipt available on request — user requests it, Better Data emails it via Resend
- Agents have a dedicated usage/transaction dashboard showing spend, volume, and history

### 8.8 Failed Orders & Refunds
- All failed order handling is managed entirely by Better Data internally
- Customers never deal with DataMart directly
- Failed orders (post-payment) → refund credited to Better Data wallet
- Guest user failed orders → handled case-by-case via Paystack contact number


## 9. Agent System

- **Onboarding:** Prospective agents pay a **one-time fee** (amount TBD with partner)
- **Approval:** Admin reviews and approves/rejects via admin panel. Activation is automatic once approved
- **Pricing:** Agents buy at a discounted rate (% off the standard user price)
- **Tier:** Single agent tier for now (multi-tier expandable later)
- **Dashboard:** Agents see their own transaction history, data volume purchased, and account balance
- **Receipts:** Downloadable on request, delivered via email (Resend)


## 10. Notifications

| Channel | Trigger |
|---|---|
| **Push (mobile app)** | Order placed, order completed, order failed, wallet top-up |
| **Email (Resend)** | Announcements, promotions, receipt on request |
| **In-app (web + mobile)** | Order status updates, account alerts |


## 11. Support Channels

- **WhatsApp button** — visible on web and mobile app
- **In-app support** — available on both web and mobile
- **Support email** — for formal/escalated issues


## 12. Admin Panel (`admin.betterdatagh.com`)

Completely separate app on its own subdomain for security.

**Features:**
- Revenue overview — daily, weekly, monthly
- DataMart wallet balance display + low-balance alerts
- All orders across all users and agents
- User management (view, suspend, wallet credit/debit)
- Agent management (approve, reject, suspend, view stats)
- Pricing markup configuration (% or fixed per package)
- First-time discount amount configuration
- Minimum wallet top-up configuration
- Announcement/email broadcast via Resend
- Usage stats (pulled from DataMart `/usage-stats` endpoint)


## 13. Public Pages (Web)

- **Homepage** — Hero, networks supported, how it works, CTA
- **About Us**
- **FAQs**
- **Contact Us**
- **Terms & Conditions** *(important given the wrong-number disclaimer)*
- **Privacy Policy**
- Basic SEO setup: meta tags, sitemap, Open Graph


## 14. DataMart API Integration Summary

| Feature | Endpoint Used |
|---|---|
| Single purchase | `POST /purchase` |
| Bulk purchase (agents, future) | `POST /bulk-purchase` |
| Order status check | `GET /order-status/:reference` |
| Delivery tracking | `GET /delivery-tracker` + widget |
| Fetch data packages | `GET /data-packages` |
| DataMart wallet balance | `GET /balance` |
| Transaction records | `GET /transactions` |
| Usage stats | `GET /usage-stats` |
| Real-time order events | Webhooks (`order.created`, `order.completed`, `order.failed`, `order.refunded`) |

**Auth:** All requests use `X-API-Key` header
**Idempotency:** `X-Idempotency-Key` sent on every purchase to prevent duplicate charges
**Rate limits:** 150 req/min purchases, 200 req/min general, 120 req/min balance checks


## 15. Out of Scope (for v1)

- Referral/reward system
- Multi-tier agents
- Airtime top-up (data only for now)
- Bank transfer top-up (Paystack, added later)
- Bulk purchase UI for end users (agent feature, future)
- Withdrawal API usage


## 16. Open Items (To Be Decided)

| Item | Owner |
|---|---|
| Agent onboarding fee amount | Kevin + Partner |
| First-time discount fixed GHS amount | Kevin + Partner |
| Minimum wallet top-up exact amount | Kevin + Partner |
| DataMartGH pricing tier confirmation | Kevin |
| Agent % discount rate | Kevin + Partner |
