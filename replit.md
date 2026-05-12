# Explore Route MCP

An MCP server prototype for Shopify PMs that surfaces independent local merchants to AI agents based on route context and movement intent — solving the invisibility problem for small businesses structurally excluded from paid search and traditional agentic commerce discovery.

A Claude AI agent walks a real walking loop in Niagara-on-the-Lake Old Town, discovers merchants via Google Places, verifies them against the Shopify Global Catalog, and surfaces purchase-ready cards. The system also generates verified foot traffic and agent-intent signals for non-Shopify merchants, giving Shopify's acquisition team proof-of-demand data that converts cold outreach into a quantified missed-revenue conversation.

## What it actually does

- **MCP-native merchant discovery**: Three MCP tools (`get_scenic_route`, `get_nearby_merchants`, `get_merchant_graph`) expose route and merchant data to Claude. The AI uses these to plan discovery, surface stops, and answer questions grounded in real spatial context.
- **Split-screen UI**: Left pane is Google Maps zoomed into NOTL Old Town (zoom 15) with colour-coded merchant pins. Right pane is a Perplexity-style Claude AI chat that streams responses with source badges naming each merchant and walk time.
- **Streaming AI chat (SSE)**: Claude responses stream token-by-token via Server-Sent Events. The system prompt injects live route and merchant context so every answer is grounded in what is actually nearby on the current walk.
- **Merchant cards**: Clicking a pin fetches a card with merchant name, category, products from the Shopify Global Catalog, price, and a "Pay with Shop Pay" button — available only for merchants already on Shopify or a compatible digital platform (Shopify, Facebook Shop, Instagram, TikTok Shop, Google). Completely offline merchants do not have a checkout to attach Shop Pay to; their cards show visit confirmation instead.
- **Geofence visit confirmation**: When a walker enters a merchant's geofence radius, the visit is confirmed. For Shopify-verified merchants the confirmation can trigger a Shop Cash reward on the user's Shop account — no merchant action required, reward fires on the user side regardless of how the merchant accepts payment. For offline merchants the visit signal is recorded as a foot-traffic data point for Shopify's acquisition team.
- **Apple Watch ambient alerts**: A simulated Watch face surfaces haptic proximity alerts ("Ravine Vineyard 180m away — tap to explore") as the walker approaches merchants. Non-intrusive, location-aware, no interaction required.
- **Merchant graph**: A force-directed spatial commerce graph distinguishes verified Shopify merchants (green nodes, clustered) from ghost businesses (amber nodes, isolated). Shadow edges accumulate as the same merchant appears in multiple walk sessions — the graph grows over time into a proof-of-demand dataset.
- **Demo video**: A 12-scene ~75-second animated conference reel (Explore Route MCP) with voiceover, scene jump controls, and loop-lock. Exported directly from the browser preview pane.

## Honest product framing

**"Shop Local by Shopify" does not exist as a platform product.** Shopify has merchant-specific loyalty apps in its App Store (Smile.io, Rivo, BON), but there is no platform-wide Shopify rewards program that fires across arbitrary local merchants. The reward mechanism described above — Shop Cash on geofence confirmation — is a feasible design pattern that Shopify *could* build, but it is not a shipping product today.

**Shop Pay for non-Shopify merchants**: Shop Pay expanded in 2024 to merchants on Facebook, Instagram, TikTok, and Google. It is not available to completely offline merchants with no digital storefront. A cash-only ceramics studio cannot accept Shop Pay because there is no checkout page to put the button on.

**The two honest things this prototype demonstrates:**

1. An MCP server that surfaces independent local merchants to AI agents based on route context and movement intent — rewarding verified visits through geofence confirmation and decoupling user value from merchant payment infrastructure.

2. A self-expanding merchant graph connecting Google Places and Shopify's Global Catalog — accumulating verified foot traffic signals for offline merchants and feeding Shopify's acquisition team proof-of-demand data that converts cold outreach into a quantified missed-revenue conversation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm --filter @workspace/scenic-routes run dev` — React frontend (port auto-assigned via `PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema migrations

Required env secrets:
- `GOOGLE_MAPS_API_KEY` — backend Google Maps Routes + Places API (falls back to mock if absent)
- `VITE_GOOGLE_MAPS_API_KEY` — frontend Google Maps JS embed (same value, must be VITE_ prefixed)
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — provisioned via Replit Anthropic AI integration
- `SHOPIFY_CATALOG_CLIENT_ID` — OAuth client_id for Shopify Global Catalog API (from dev.shopify.com/dashboard → Catalogs → key detail page, NOT the record ID shown in the list)
- `SHOPIFY_CATALOG_CLIENT_SECRET` — OAuth client_secret for same key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, TanStack Query, Wouter, `@workspace/api-client-react`
- API: Express 5 (contract-first via OpenAPI)
- DB: PostgreSQL + Drizzle ORM (schema has conversations/messages; app is currently stateless)
- Validation: Zod (v4), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- AI: `@workspace/integrations-anthropic-ai` → `claude-sonnet-4-6`, SSE streaming
- External APIs: Google Maps Directions/Places, Shopify Global Catalog (UCP MCP format, OAuth2)
- Demo video: React + Framer Motion + GSAP, exported from browser preview

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI source of truth
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/integrations-anthropic-ai/src/` — Anthropic client wrapper
- `artifacts/scenic-routes/src/pages/home.tsx` — main split-screen UI
- `artifacts/scenic-routes/src/components/` — MapView, AiChat, AppleWatch, McpToolsPanel, MerchantGraph
- `artifacts/api-server/src/routes/scenic.ts` — route/merchant/graph handlers + `/api/places-graph`
- `artifacts/api-server/src/routes/anthropic.ts` — Claude SSE streaming chat route
- `artifacts/api-server/src/routes/shopify-catalog.ts` — Shopify Global Catalog API routes
- `artifacts/api-server/src/lib/shopify-catalog-client.ts` — shared catalog client (OAuth2, token cache, search)
- `artifacts/demo-video/src/components/video/` — 12-scene animated demo reel
- `docs/BUILD_JOURNAL.md` — full engineering journal

## Architecture decisions

- **Walking loop in NOTL Old Town**: Route is Market Square → Fort George → Waterfront → Shaw Festival → Queen St (~3.2km, ~38 min). Origin/destination sent to Google Maps are Market Square → Fort George so Google returns a real walking route.
- **Graceful API degradation**: All Google Maps calls fall back to curated NOTL Old Town mock data (8 merchants) when key is absent. SVG map placeholder shows zoomed-into-NOTL view.
- **Claude AI chat (SSE)**: `/api/anthropic/conversations/:id/messages` streams Claude responses via SSE. System prompt injects MCP route + merchant context. Frontend uses raw `fetch` + `ReadableStream` (NOT generated hooks) per Anthropic skill guidance.
- **Stateless chat**: Chat is conversation-scoped to the browser session; no DB persistence needed for demo.
- **Shopify Global Catalog**: Real verified merchant lookup via UCP MCP format. OAuth2 client_credentials, 60-min token cache. Replaced Mock.shop — Mock.shop is a demo sandbox with generic fashion products unrelated to actual Shopify merchants.
- **Source citations**: AI responses automatically extract merchant name mentions and surface them as MCP source badges with walk time.
- **Shop Pay gating**: "Pay with Shop Pay" button only renders for merchants verified in the Shopify Global Catalog. Offline-only merchants get a visit confirmation card instead. This accurately reflects that Shop Pay requires a digital storefront.
- **Merchant graph accumulation**: Ghost businesses (amber nodes) are merchants found via Google Places but absent from the Shopify catalog. Over repeated walk sessions their nodes accumulate foot-traffic edge weights — forming the acquisition signal dataset.
- **Discovery defaults**: Claude recommends top 2 stops by default; "+N more" expands the list. System prompt instructs Claude to surface only 2 unless the user asks for more, keeping the chat conversational rather than a dump of results.

## Gotchas

- Frontend needs `VITE_GOOGLE_MAPS_API_KEY` (different env var from `GOOGLE_MAPS_API_KEY`) — set both to the same value
- `SHOPIFY_CATALOG_CLIENT_ID` is NOT the record ID shown in the Catalogs list — click into the key detail page
- After OpenAPI spec change, run `pnpm --filter @workspace/api-spec exec orval --config ./orval.config.ts` then restart the frontend workflow
- `lib/api-zod/src/index.ts` exports only from `./generated/api` (not types/) to avoid duplicate export errors
- API server bundles with esbuild — restart workflow after route changes
- Shopify Global Catalog UCP prices are in minor units (cents) — divide by 100 for display
- Parallel Places text searches need synchronized dedup: check AND add `place_id` to `seenPlaceIds` when pushing results
- Demo video exports via the browser preview pane export button — do not use `pnpm build` for the video artifact

## User preferences

- Walking/biking loop WITHIN Niagara-on-the-Lake Old Town (not Toronto→NOTL driving)
- AI chat styled like Perplexity — streaming, source-grounded
- Google Maps API key provided via Secrets panel
- Shopify Global Catalog API (not Mock.shop) as the Shopify data source
- Product framing should be honest — no invented Shopify products or infeasible reward mechanisms

## Pointers

- See `.local/skills/pnpm-workspace` for workspace conventions
- See `.local/skills/ai-integrations-anthropic` for SSE streaming patterns
- Shopify Global Catalog: `https://commerce.shopify.com`
- Google Maps Console: https://console.cloud.google.com
- Full engineering journal: `docs/BUILD_JOURNAL.md`
