# Threat Model

## Project Overview

Scenic Routes MCP is a React + Vite frontend backed by an Express 5 API that proxies Google Maps and Anthropic requests to deliver a route-planning and merchant-discovery demo. Production-relevant surfaces are the `artifacts/scenic-routes` frontend and the `artifacts/api-server` backend; `artifacts/mockup-sandbox` is a dev-only sandbox and should be ignored unless production reachability is demonstrated.

Assumptions for this scan:
- Production traffic is served over platform-managed TLS.
- `NODE_ENV` is `production` in deployed environments.
- The mockup sandbox is not deployed to production.
- The current app has no end-user authentication layer; all production API routes are effectively public unless protected by infrastructure not present in this repo.
- The chat feature is intentionally stateless in application code; the Drizzle conversation/message schema exists but is not currently used by production request paths.

## Assets

- **Anthropic integration credentials and spend** — the backend holds the Anthropic base URL and API key and can incur paid usage on behalf of the app. Abuse would burn credits and degrade availability.
- **Google Maps API credentials and quota** — the backend holds the Google Maps server key and can consume billable Directions / Places quota.
- **Service availability** — the API exposes public endpoints that call third-party services and stream SSE responses; these are susceptible to abuse-driven resource exhaustion.
- **User location and route context** — the frontend sends user position, route details, and nearby merchant context to the backend and then to Anthropic. This data is not highly regulated here, but it is still user-derived context that should not be leaked or overexposed.
- **Merchant discovery data and downstream purchase links** — merchant cards, stories, ratings, and checkout links influence user decisions and should not be trivially tampered with in ways that abuse the app’s trust.
- **Application secrets and environment variables** — `GOOGLE_MAPS_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_*`, and `DATABASE_URL` remain sensitive even though the current demo uses limited persistence.

## Trust Boundaries

- **Browser to API (`/api`)** — all frontend requests cross from an untrusted client into the Express server. Request bodies, query parameters, and route params must be treated as attacker-controlled.
- **API to Anthropic** — `/api/anthropic/conversations/:id/messages` converts untrusted client input into a paid model invocation and SSE stream.
- **API to Google Maps** — `/api/scenic-route` and `/api/merchants` proxy untrusted parameters into Google Directions and Places requests using a server-side key.
- **API to Mock.shop** — `/api/merchant-card` fetches product data from a third-party GraphQL endpoint and returns derived checkout links.
- **API to PostgreSQL** — database code exists in shared libraries, but current production request paths do not use it. This boundary matters if future conversation persistence is enabled.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox` and Vite dev-only settings are out of scope unless they are shown to affect the deployed production app.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/scenic-routes/src/main.tsx`, `artifacts/scenic-routes/src/pages/home.tsx`.
- **Highest-risk code areas:** `artifacts/api-server/src/routes/anthropic.ts`, `artifacts/api-server/src/routes/scenic.ts`, `lib/integrations-anthropic-ai/src/client.ts`.
- **Public surface:** all current Express routes under `/api` are public in repo code; no auth or role separation is implemented.
- **Dev-only areas to usually ignore:** `artifacts/mockup-sandbox/**`, Vite dev plugins, generated `dist/**` outputs.

## Threat Categories

### Spoofing

The app currently has no user authentication boundary in repo code, so the primary spoofing risk is service misuse rather than account impersonation. The backend must not treat any browser caller as trusted simply because it originates from the frontend; every public endpoint should assume arbitrary callers and enforce any access policy server-side or through edge controls.

### Tampering

Client-supplied route context, merchant context, and coordinates are injected into downstream requests and AI prompts. The backend must validate shape, size, and allowed values for parameters that influence external requests or generated prompts so attackers cannot arbitrarily reshape the application’s behavior or increase downstream cost.

### Information Disclosure

The app handles user position, route context, merchant metadata, and sensitive server-held API keys. Secrets must never appear in client bundles, logs, or error responses. Error handling should avoid returning provider internals, and logging should continue redacting credentials and cookies.

### Denial of Service

This is the highest-priority threat for the current architecture. Public endpoints can trigger billable or long-running external operations: Google Directions, Google Places, Mock.shop fetches, and especially Anthropic SSE streaming. Production must enforce rate limiting, concurrency limits, bounded request sizes, and timeouts so unauthenticated callers cannot exhaust credits, quota, or worker capacity.

### Elevation of Privilege

There is no role model today, so classic role-escalation is less relevant than privilege transfer through backend proxies. The server holds privileged API keys for Anthropic and Google Maps; untrusted clients must not be able to use the backend as an unrestricted proxy for those capabilities. Any future persistence of conversations/messages must continue using parameterized queries and server-enforced authorization if user accounts are introduced.
