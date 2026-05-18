# Upstash Redis Design

Better Data will use Upstash Redis over REST for shared operational state. Redis is not the durable order store and is not the primary queue; Convex remains the order database and CloudAMQP/LavinMQ remains the durable queue.

## Scope

- Metrics counters use Upstash hashes so API and worker processes aggregate into one shared view.
- DataMart read-heavy calls use Redis TTL caching to avoid unnecessary vendor requests.
- Production startup fails if shared Redis is required but Upstash credentials are missing.
- In-memory adapters remain only for tests and local development fallback.

## Environment

The API and worker both use:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `UPSTASH_REDIS_KEY_PREFIX`

DataMart cache TTLs are configurable through:

- `DATAMART_PACKAGES_CACHE_TTL_SECONDS`
- `DATAMART_BALANCE_CACHE_TTL_SECONDS`
- `DATAMART_DELIVERY_TRACKER_CACHE_TTL_SECONDS`

## Design

Create a small Upstash REST client around `fetch`. Keep commands narrow: `GET`, `SET EX`, `DEL`, `HINCRBYFLOAT`, `HGET`, and `HGETALL`. This avoids long-lived TCP sockets and keeps the code compatible with serverless or container deployments.

Metrics use a pluggable backend. Production uses Upstash. Tests can inject memory or fake adapters.

DataMart caching wraps mapped responses rather than raw HTTP transport responses. This keeps cached values stable for the app and avoids coupling cache entries to vendor response shape changes.

Queueing stays on CloudAMQP/LavinMQ. Redis will not replace AMQP for purchase delivery because ack/retry/dead-letter behavior is already better represented by AMQP.
