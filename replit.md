# Explore Route MCP

A Shopify Agentic Commerce MCP prototype for Shopify PMs — a Claude AI agent walks a real route in Niagara-on-the-Lake, discovers merchants via Google Places, verifies them against the Shopify Global Catalog, and surfaces purchase-ready cards. Demonstrates spatially-aware, MCP-native commerce in a working prototype.

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
- `docs/BUILD_JOURNAL.md` — full engineering journal

## Architecture decisions

- **Walking loop in NOTL Old Town**: Route is Market Square → Fort George → Waterfront → Shaw Festival → Queen St (~3.2km, ~38 min). Origin/destination sent to Google Maps are Market Square → Fort George so Google returns a real walking route.
- **Graceful API degradation**: All Google Maps calls fall back to curated NOTL Old Town mock data (8 merchants) when key is absent. SVG map placeholder shows zoomed-into-NOTL view.
- **Claude AI chat (SSE)**: `/api/anthropic/conversations/:id/messages` streams Claude responses via SSE. System prompt injects MCP route + merchant context. Frontend uses raw `fetch` + `ReadableStream` (NOT generated hooks) per Anthropic skill guidance.
- **Stateless chat**: Chat is conversation-scoped to the browser session; no DB persistence needed for demo.
- **Shopify Global Catalog**: Real verified merchant lookup via UCP MCP format. OAuth2 client_credentials, 60-min token cache. Replaced Mock.shop which was removed — Mock.shop is a demo sandbox with generic fashion products unrelated to actual Shopify merchants.
- **Source citations**: AI responses automatically extract merchant name mentions and surface them as MCP source badges with walk time.

## Product

- Split-screen: left = Google Maps zoomed into NOTL Old Town (zoom 15) with merchant pins; right = Perplexity-style Claude AI chat
- "Start Walk" animates a walker along the loop, triggers merchant discovery at milestones
- AI chat streams Claude responses grounded in real MCP merchant data from the route
- Clicking merchant pins fetches merchant card with products + one-tap Buy links
- Apple Watch shows ambient haptic alerts for winery proximity
- MCP Tools panel shows `get_scenic_route`, `get_nearby_merchants`, and `get_merchant_graph` tool schemas
- Graph view: force-directed spatial commerce graph — verified Shopify merchants (green, clustered) vs ghost businesses (amber, isolated)

## User preferences

- Walking/biking loop WITHIN Niagara-on-the-Lake Old Town (not Toronto→NOTL driving)
- AI chat styled like Perplexity — streaming, source-grounded
- Google Maps API key provided via Secrets panel
- Shopify Global Catalog API (not Mock.shop) as the Shopify data source

## Gotchas

- Frontend needs `VITE_GOOGLE_MAPS_API_KEY` (different env var from `GOOGLE_MAPS_API_KEY`) — set both to the same value
- `SHOPIFY_CATALOG_CLIENT_ID` is NOT the record ID shown in the Catalogs list — click into the key detail page
- After OpenAPI spec change, run `pnpm --filter @workspace/api-spec exec orval --config ./orval.config.ts` then restart the frontend workflow
- `lib/api-zod/src/index.ts` exports only from `./generated/api` (not types/) to avoid duplicate export errors
- API server bundles with esbuild — restart workflow after route changes
- Shopify Global Catalog UCP prices are in minor units (cents) — divide by 100 for display
- Parallel Places text searches need synchronized dedup: check AND add `place_id` to `seenPlaceIds` when pushing results

## Pointers

- See `.local/skills/pnpm-workspace` for workspace conventions
- See `.local/skills/ai-integrations-anthropic` for SSE streaming patterns
- Shopify Global Catalog: `https://commerce.shopify.com`
- Google Maps Console: https://console.cloud.google.com
- Full engineering journal: `docs/BUILD_JOURNAL.md`
