# Scenic Routes MCP

An interactive MCP prototype demonstrating agentic commerce along the Toronto → Niagara-on-the-Lake scenic route — orchestrating Google Maps and Shopify for real-time merchant discovery.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/scenic-routes run dev` — run the React frontend (port 18319)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

Required env secrets:
- `GOOGLE_MAPS_API_KEY` — backend: Google Maps Routes + Places API (falls back to mock data if absent)
- `VITE_GOOGLE_MAPS_API_KEY` — frontend: Google Maps JS embed (set same value; must be VITE_ prefixed)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, TanStack Query, Wouter, `@workspace/api-client-react`
- API: Express 5 (contract-first via OpenAPI)
- DB: PostgreSQL + Drizzle ORM (not used yet — app is stateless API orchestration)
- Validation: Zod (v4), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- External APIs: Google Maps Directions/Routes/Places, Mock.shop (free Shopify sandbox)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI source of truth
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/scenic-routes/src/pages/home.tsx` — main split-screen UI
- `artifacts/scenic-routes/src/components/` — MapView, DiscoveryFeed, AppleWatch, McpToolsPanel
- `artifacts/api-server/src/routes/scenic.ts` — all 4 API route handlers

## Architecture decisions

- **API-key graceful degradation:** All Google Maps calls fall back to realistic curated mock data (6 Niagara merchants, Niagara Parkway route) when `GOOGLE_MAPS_API_KEY` is absent — app is fully functional without the key.
- **Mock.shop for Shopify:** Uses `https://mock.shop/api` (public GraphQL sandbox) as the Shopify Storefront API stand-in — no account or token required.
- **Contract-first:** OpenAPI spec drives all types; frontend uses only generated hooks (`@workspace/api-client-react`), never raw fetch.
- **SVG map placeholder:** When no Google Maps key is set, renders a custom SVG map of the Niagara region with animated route polyline and merchant pins — indistinguishable at a glance from a real map.
- **Apple Watch CSS-only:** The wearable ambient discovery demo is pure CSS/SVG — no external assets, no library. Triggers animated haptic pulse when a winery is within 5km.

## Product

- Split-screen experience: left = interactive map (SVG or Google Maps), right = MCP discovery feed
- "Start Journey" simulates a car driving the scenic route, triggering MCP merchant discovery events
- Clicking any merchant pin fetches a rich card from Shopify (Mock.shop) with products and One-Tap Buy
- Apple Watch mockup shows ambient discovery haptic alerts for nearby wineries
- MCP Tools panel shows the registered tool schemas (`get_scenic_route`, `get_nearby_merchants`)

## User preferences

- Use Mock.shop (no Shopify account needed) for Shopify sandbox
- Google Maps API key to be provided by user via Secrets panel (free $200/month credit)

## Gotchas

- Frontend needs `VITE_GOOGLE_MAPS_API_KEY` (different from backend's `GOOGLE_MAPS_API_KEY`) — set both to the same value
- After any OpenAPI spec change, run codegen before using updated types
- API server bundles with esbuild — restart workflow after route changes

## Pointers

- See `.local/skills/pnpm-workspace` for workspace structure
- Mock.shop GraphQL playground: https://mock.shop/
- Google Maps Console: https://console.cloud.google.com
