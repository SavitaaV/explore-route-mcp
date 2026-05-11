# Build Journal — Explore Route MCP

> A full chronological record of what was built, what was tried, what worked, and what was removed. Written for any engineer or PM picking this up cold.

---

## Project Goal

Build a **Shopify Agentic Commerce MCP prototype** for Shopify PMs. The thesis: in a post-MCP world, an AI agent walking a physical route should be able to discover merchants, query live inventory, and surface purchase-ready cards — all grounded in real Shopify data.

The demo setting: a ~3.2 km walking loop through **Niagara-on-the-Lake Old Town**, Ontario.

---

## Phase 1 — Walking Route & Merchant Discovery

### What was built
- Express 5 API server with a contract-first OpenAPI spec (`lib/api-spec/openapi.yaml`)
- `GET /api/scenic-route` — calls Google Maps Directions API; falls back to a curated NOTL mock route (encoded polyline) when the API key is absent
- `GET /api/merchants` — returns `MOCK_MERCHANTS`: 8 hand-curated NOTL Old Town businesses (Peller Estates, Treadwell Farm-to-Table, Balzac's Coffee, etc.) with lat/lng, type, rating, walk-minute estimates, and inventory confidence scores
- React + Vite frontend: split-screen "dark phone" (Google Maps + walking route) and "light phone" (Claude AI chat)
- Apple Watch component: ambient haptic alert simulation when approaching a winery
- MCP Tools panel: displays `get_scenic_route` and `get_nearby_merchants` tool schemas so PMs can see exactly what an AI agent would call

### Architecture decisions
- **Walking loop stays within NOTL Old Town** — not a Toronto→NOTL driving route. Origin = Market Square, Destination = Fort George, so Google returns a real ~3km walkable loop
- **Graceful degradation** — all Google Maps calls fall back to curated mock data if the API key is absent; the SVG map placeholder shows a recognisable NOTL overview
- **Inventory Confidence Score** — not binary in-stock/out-of-stock. A time-decayed crowdsourced signal: `(visitCount × decayFactor) / categoryBaseline`, displayed as `80% in stock · 12 visitors · 2h ago`
- **Ghost merchant primitive** — physical businesses not on Shopify rendered as purple-blurred "UNDISCOVERED" cards with an "Invite to Shopify" CTA. First demo of what becomes the core graph insight later

---

## Phase 2 — Claude AI Chat (SSE Streaming)

### What was built
- `POST /api/anthropic/conversations/:id/messages` — streams Claude responses via SSE
- System prompt injects: current NOTL route waypoints, nearby merchants with types/ratings/walk-times, and MCP tool context
- Frontend uses raw `fetch` + `ReadableStream` + `TextDecoder` (not generated Orval hooks) — per Anthropic's guidance, generated hooks don't handle SSE cleanly
- Source citation extraction: AI responses scanned for merchant name mentions → surfaced as inline MCP source badges with walk-time
- `lib/integrations-anthropic-ai/` — shared Anthropic client wrapper using Replit AI Integrations proxy (no direct API key exposure)
- Model: `claude-sonnet-4-6`

### What was tried and abandoned
- **Generated hooks for SSE** — Orval-generated TanStack Query hooks don't support streaming; they buffer the full response. Reverted to raw fetch immediately
- **Conversation persistence** — Drizzle ORM schema exists (`conversations` + `messages` tables) but the demo is stateless. DB schema kept for future use but no production request path touches it

---

## Phase 3 — Mock.shop Integration (later fully removed)

### What was built
- `fetchShopifyProducts(merchantType)` — called Mock.shop's public GraphQL endpoint (`https://mock.shop/api`) to fetch real product data
- Mapped merchant types to Mock.shop collection handles: `winery → featured`, `restaurant → unisex`, `cafe → tops`, etc.
- `/api/merchant-card` returned real Mock.shop products with checkout URLs
- `/api/merchant-graph` used Mock.shop collection tags for Jaccard similarity scoring
- `/api/mockshop-catalog` route fetched and returned all Mock.shop collections for a sidebar display tab in the graph UI
- Frontend `MerchantGraph.tsx` showed a two-tab catalog panel: "Mock.shop" and "Global Catalog"

### Why Mock.shop was appealing
- Zero auth required — public GraphQL sandbox at `https://mock.shop/api`
- Real GraphQL product shape matching what a Shopify merchant would serve
- Free, reliable, no quota

### Why Mock.shop was removed
- **Not real Shopify merchant data** — Mock.shop is a demo sandbox with generic fashion/apparel products (shoes, tops, accessories). It has no connection to actual Shopify merchants
- **Disconnected from reality** — the graph was using Mock.shop fashion tags to compute Jaccard similarity between Ontario wineries and artisan food merchants. The tags (`women`, `unisex`, `shoes`) had zero semantic relationship to the actual domain
- **Replaced by a better signal** — Shopify Global Catalog provides real product data from actual Shopify merchants. The graph now uses curated ontological tag vocabularies derived from real catalog queries
- **UI clutter** — the Mock.shop tab in the sidebar added complexity with no PM-value demo value; removing it made the Global Catalog search the primary catalog interaction

### What replaced it
- Curated `CURATED_PRODUCTS` per merchant type for `/api/merchant-card` route-walk merchants
- `TYPE_TAGS` vocabulary (derived from Global Catalog category signals) for Jaccard similarity in `/api/merchant-graph`
- Shopify Global Catalog as the primary product data source for verified nodes in `/api/places-graph`

---

## Phase 4 — Merchant Similarity Graph (`/api/merchant-graph`)

### What was built
- `GET /api/merchant-graph` — co-purchase similarity graph for the 7 NOTL route merchants
- Force-directed d3-force simulation in `MerchantGraph.tsx`
- Edge scoring formula: `similarity = 0.60 × TypeAffinity + 0.40 × Jaccard(TYPE_TAGS)`
- `TYPE_AFFINITY` matrix: prior co-purchase probabilities (winery↔restaurant = 0.80, cafe↔bakery = 0.75, etc.)
- `get_merchant_graph` MCP tool schema exposed so Claude can call it and recommend "pairs well with" merchants

### Evolution of edge scoring
| Version | Formula | Data source |
|---------|---------|-------------|
| v1 | `0.40×TypeAff + 0.40×Jaccard + 0.20×PriceSim` | Mock.shop collections + prices |
| v2 (current) | `0.60×TypeAff + 0.40×Jaccard` | Curated TYPE_TAGS (catalog-derived) |

Price similarity was removed when Mock.shop was dropped — the Mock.shop variant prices (fashion apparel) were meaningless for Ontario food/drink merchants.

---

## Phase 5 — Shopify Global Catalog Integration

### What was built
- **Shopify Global Catalog API client** (`artifacts/api-server/src/lib/shopify-catalog-client.ts`)
  - OAuth2 client_credentials flow against `https://commerce.shopify.com`
  - 60-minute JWT token cache (tokens are reused across requests)
  - `searchCatalog(query, opts)` — calls UCP MCP endpoint with `tools/call` method
  - `normalizeDomain(url)` — strips `www.`, protocol, trailing slash for domain matching
  - `CatalogProduct` interface: `upid`, `title`, `vendor`, `shopDomain`, `minPrice`, `maxPrice`, `currency`, `imageUrl`, `checkoutUrl`, `tags`, `offersCount`
  - Prices converted from minor units (cents) to dollars on ingestion

- **`/api/shopify-catalog` routes** (in `shopify-catalog.ts`)
  - `GET /api/catalog/status` — reports whether credentials are configured
  - `GET /api/catalog/search` — proxied catalog search (used by frontend global search)
  - `GET /api/catalog/mcp` — raw MCP proxy for debugging

- **`/api/places-graph`** — the centerpiece endpoint (in `scenic.ts`)
  - Returns a spatial commerce graph of real Ontario businesses

### UCP MCP format (key learning)
The Shopify Global Catalog uses Shopify's **Universal Commerce Platform (UCP)** MCP format. The correct request structure is:
```json
{
  "method": "tools/call",
  "params": {
    "name": "search_catalog",
    "arguments": {
      "query": "artisan jam",
      "limit": 5,
      "ships_to": "CA",
      "meta": {
        "ucp-agent": {
          "profile": "https://explore-route-mcp.replit.app/api/catalog/agent-profile"
        }
      }
    }
  }
}
```
The response is in `result.structuredContent.products[]`. Prices are in minor units (cents).

### Credentials
- `SHOPIFY_CATALOG_CLIENT_ID` and `SHOPIFY_CATALOG_CLIENT_SECRET` from `dev.shopify.com/dashboard → Catalogs`
- **Critical**: the client_id is NOT the record ID shown in the list — it's on the key detail page. This caused significant confusion during development
- OAuth token endpoint: `https://commerce.shopify.com/api/2025-04/oauth/token`
- Token is a JWT, valid 60 minutes, cached in-process

---

## Phase 6 — Commerce Graph (`/api/places-graph`)

### What was built
The `/api/places-graph` endpoint is the full synthesis of everything above. It builds a spatial commerce graph of real Ontario merchants with Shopify verification.

### Three-step verification pipeline

**Step A — Domain matching**
- Fetch 10 Ontario catalog queries in parallel (wine, artisan jam, maple syrup, honey, cheese, craft beer, chocolate, coffee, artisan gift, tea)
- Extract unique merchant domains from catalog `checkoutUrl` values
- Fetch Google Places Nearby Search for NOTL Old Town area
- Match Places `website` domain against catalog domains
- Result: typically 0–2 verified nodes this way (catalog has niche artisan merchants; nearby Places results are often chains)

**Step B — Text search by merchant name**
- For each catalog domain's inferred merchant name, run `GET /api/place/textsearch` on Google
- Use `seenPlaceIds` Set to deduplicate across parallel results
- Result: ~6–9 real Ontario verified merchants (e.g., "In A Jam" London, "Gunn's Hill Artisan Cheese", "oddBird Niagara")

**Step C — Demo fallback**
- If Steps A+B produce 0 verified nodes, enrich top-rated mock merchants with catalog data matched by type category
- Guarantees a connected verified cluster for demo purposes even without API credentials

### Edge scoring
```
score = 0.50 × TypeAffinity
      + 0.25 × ProximityBonus (1.0 if <100m, 0.5 if <300m, 0.0 otherwise)
      + 0.25 × CatalogOverlap (only for verified↔verified pairs)
```

### Graph output (typical with Google Maps + Shopify credentials)
- ~58–60 nodes total
- ~9 verified Shopify merchants (from Global Catalog text search)
- ~50 ghost merchants (real Ontario businesses not on Shopify)
- ~1000–1050 edges
- Source: `"google"`

### Verified merchants found (real examples)
| Merchant | City | Catalog Match |
|---------|------|--------------|
| In A Jam | London | smallbatchjamco.com |
| Gunn's Hill Artisan Cheese | London | cheesyplace.com |
| Pluck Tea | Toronto | looseleafteamarket.com |
| oddBird | Niagara | thezeroproof.com |
| Woody's and SAILOR | Toronto | heritagegoodsandsupply.com |
| Two Hoots Studio | London | sansdrinks.com.au |

### Deduplication bug (fixed)
Early implementation: `seenPlaceIds` Set was checked at search dispatch time but not updated as results resolved, allowing parallel text searches to return the same `place_id` twice. Fixed by checking + adding to `seenPlaceIds` as each result is pushed to the `nodes` array.

---

## Graph UI (`MerchantGraph.tsx`)

### What the graph shows
- **Verified nodes** (Shopify green, larger): real Ontario merchants confirmed in the Shopify Global Catalog. Render in a cluster at center
- **Ghost nodes** (amber, smaller): real Ontario businesses not on Shopify. Rendered in an outer ring
- **Commerce edges** (green solid): connect verified↔verified nodes; weighted by type affinity + catalog category overlap
- **Shadow edges** (amber dashed): connect each ghost to its nearest verified node; computed client-side from spatial proximity. Represent LLM-inferred commercial proximity
- **Tooltip** for verified nodes: shows "🛍 SHOPIFY CATALOG" section with real product images, CAD prices, and live Buy → links

### Sidebar features
- City filter buttons (Toronto, Ottawa, Hamilton, London, Niagara)
- Merchant list sorted by verified-first, then rating
- Shopify Global Catalog search — live product search across all Shopify merchants worldwide

---

## What Was Removed

| Feature | Reason |
|---------|--------|
| Mock.shop GraphQL calls | Not real Shopify data; replaced by Shopify Global Catalog |
| `/api/mockshop-catalog` endpoint | No longer needed; UI tab removed |
| Mock.shop sidebar tab | Cluttered UI; Global Catalog search is more valuable |
| Mock.shop product tags for Jaccard | Fashion tags irrelevant to Ontario food/drink merchants |
| Price similarity in edge scoring | Was based on Mock.shop apparel prices; meaningless for the domain |
| `fetchShopifyProducts` function | Replaced by `getCuratedProducts` for route-walk merchants |

---

## What Remains (as of May 2026)

### Active data sources
| Source | Usage |
|--------|-------|
| Google Maps Directions API | Real walking route for NOTL loop |
| Google Maps Places Nearby Search | ~50 nearby merchant nodes per city |
| Google Maps Text Search | Merchant-by-name lookup for Global Catalog verification |
| Shopify Global Catalog (UCP MCP) | Verified merchant lookup, real products + checkout URLs |
| Anthropic Claude Sonnet | AI chat streaming, merchant storytelling |

### API surface
| Endpoint | Purpose |
|----------|---------|
| `GET /api/scenic-route` | Walking route via Google Maps |
| `GET /api/merchants` | NOTL Old Town merchants with inventory confidence |
| `POST /api/merchant-card` | Merchant card with curated products |
| `GET /api/merchant-graph` | NOTL co-purchase similarity graph (TYPE_TAGS-based Jaccard) |
| `GET /api/places-graph` | Full Ontario spatial commerce graph (Places + Global Catalog) |
| `GET /api/catalog/status` | Shopify Global Catalog credential status |
| `GET /api/catalog/search` | Live search across Shopify Global Catalog |
| `POST /api/anthropic/conversations/:id/messages` | Claude SSE streaming chat |
| `GET /api/mcp-tools` | MCP tool schemas for inspector panel |

---

## Environment Variables Required

| Variable | Purpose |
|---------|---------|
| `GOOGLE_MAPS_API_KEY` | Backend Google Maps Routes + Places API |
| `VITE_GOOGLE_MAPS_API_KEY` | Frontend Google Maps JS embed (same value, VITE_ prefixed) |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Via Replit Anthropic AI Integration |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Via Replit Anthropic AI Integration |
| `SHOPIFY_CATALOG_CLIENT_ID` | From dev.shopify.com/dashboard → Catalogs → key detail page |
| `SHOPIFY_CATALOG_CLIENT_SECRET` | Same key detail page |
| `SESSION_SECRET` | Express session signing |
| `DATABASE_URL` | PostgreSQL connection (schema exists; not used in production paths) |

---

## Key Gotchas for Future Engineers

1. **SHOPIFY_CATALOG_CLIENT_ID is NOT the record ID** shown in the Catalogs list. Navigate into the key detail page to find the real OAuth `client_id`
2. **Frontend needs VITE_GOOGLE_MAPS_API_KEY** — Vite only exposes env vars prefixed with `VITE_` to the client bundle. Set both `GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` to the same value
3. **API server bundles with esbuild** — restart the workflow after any route changes; `tsc --noEmit` doesn't rebuild the bundle
4. **UCP prices are in minor units** — divide by 100 before displaying
5. **Parallel Places searches need synchronized dedup** — check AND add `place_id` to `seenPlaceIds` when pushing results, not just at dispatch time
6. **SSE streaming** — use raw `fetch` + `ReadableStream` for the Anthropic chat route; generated Orval hooks buffer the full response before resolving

---

## Monorepo Structure

```
explore-route-mcp/
├── artifacts/
│   ├── api-server/src/
│   │   ├── routes/
│   │   │   ├── scenic.ts          # Route, merchant, graph, MCP tools
│   │   │   ├── anthropic.ts       # Claude SSE streaming chat
│   │   │   └── shopify-catalog.ts # Global Catalog OAuth + search routes
│   │   └── lib/
│   │       └── shopify-catalog-client.ts  # Shared catalog client
│   └── scenic-routes/src/
│       ├── pages/home.tsx          # Main split-screen UI
│       └── components/
│           ├── AiChat.tsx          # Claude chat + merchant cards
│           ├── MapView.tsx         # Google Maps integration
│           ├── MerchantGraph.tsx   # d3-force commerce graph
│           ├── AppleWatch.tsx      # Wearable ambient alerts
│           ├── McpToolsPanel.tsx   # MCP tool schema inspector
│           └── DiscoveryFeed.tsx   # Journey event feed
├── lib/
│   ├── api-spec/openapi.yaml       # OpenAPI source of truth
│   ├── api-client-react/           # Generated React Query hooks (Orval)
│   ├── api-zod/                    # Generated Zod schemas (Orval)
│   ├── db/                         # Drizzle ORM schema (conversations/messages)
│   └── integrations-anthropic-ai/  # Anthropic client wrapper
└── docs/
    └── BUILD_JOURNAL.md            # This file
```
