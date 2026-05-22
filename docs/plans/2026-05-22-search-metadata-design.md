# Search Metadata Design

## Goal

Improve how Better Data is represented in search results and link previews without changing the visible landing page content.

## Approved Positioning

Better Data should be presented as a Ghana-focused mobile data bundle platform with better offers and a memorable purchase experience. Metadata must avoid promising instant delivery because fulfillment timing depends on networks, vendors, payment confirmation, and other external systems.

## Scope

- Update global landing metadata for the customer web app.
- Add richer legal page metadata.
- Add sitemap and robots metadata routes.
- Add structured data for Better Data as an online mobile data bundle service.
- Keep visible landing page copy and legal body content unchanged.

## Search Surfaces

- Google title/snippet candidates through Next.js metadata.
- Social preview cards through Open Graph and Twitter metadata.
- Crawler discovery through `/sitemap.xml`.
- Crawler permissions and sitemap location through `/robots.txt`.
- Entity understanding through JSON-LD structured data.

## Constraints

- Do not claim guaranteed or instant data delivery.
- Use canonical production domain `https://betterdatagh.com`.
- Keep public routes discoverable while excluding authenticated dashboard/payment flows from the sitemap.
- Use existing Next.js App Router metadata conventions.
