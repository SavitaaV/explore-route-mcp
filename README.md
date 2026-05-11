# Explore Route MCP

> **Shopify Agentic Commerce — a working MCP prototype for Shopify PMs.** A Claude AI agent walks a real route in Niagara-on-the-Lake, discovers merchants via Google Places, verifies them against the **Shopify Global Catalog**, and surfaces one-tap purchase links. Built to demonstrate what spatially-aware, MCP-native commerce feels like.

<p align="center">
  <img src="https://img.shields.io/badge/Shopify-Global%20Catalog-96BF48?style=for-the-badge&logo=shopify&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude-Sonnet-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Google%20Maps-Places%20API-4285F4?style=for-the-badge&logo=googlemaps&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/pnpm-workspace-F69220?style=for-the-badge&logo=pnpm&logoColor=white" />
</p>

---

## What Is This?

Shopify's [2025 Agentic Commerce vision](https://shopify.dev/docs/agents) introduced a new primitive: **shopping as an ambient, spatially-aware agent experience** — not a storefront you navigate to, but commerce that finds you where you are.

This prototype is a working implementation of that thesis:

- A **Claude AI agent** walks you through Niagara-on-the-Lake Old Town, grounded in real MCP tool data
- **Google Maps** renders the walking route and discovers real businesses via Places API
- **Shopify Global Catalog** verifies which discovered businesses are real Shopify merchants, pulling live product data and checkout URLs
- A **spatial commerce graph** shows which merchants are verified (connected cluster) vs undiscovered (ghost nodes, isolated with shadow edges)
- Three new **agentic commerce primitives** are demonstrated: inventory confidence scoring, merchant storytelling, and undiscovered merchant digital twins

---

## The UX — Cinematic Split Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  EXPLORE ROUTE MCP          Shopify × Google Maps × Claude      │
├───────────────────────┬─────────────────────────────────────────┤
│   📍 Navigation       │   🤖 Agentic Commerce                   │
│                       │                                         │
│  ┌───────────────┐   │  ┌───────────────────────────────────┐  │
│  │  DARK PHONE   │   │  │         LIGHT PHONE               │  │
│  │               │   │  │                                   │  │
│  │  Google Maps  │   │  │  Claude AI Chat (Perplexity-     │  │
│  │  + Walking    │   │  │  style streaming, source badges) │  │
│  │    Route      │   │  │                                   │  │
│  │               │   │  │  ┌──────────────────────────┐    │  │
│  │  [Map][Graph] │   │  │  │  🍷 Peller Estates       │    │  │
│  └───────────────┘   │  │  │  ★★★★½  · 8 min walk    │    │  │
│                       │  │  │  80% in stock · 12 vis. │    │  │
│  ⌚ Apple Watch       │  │  │  [Shop ↗] [📍 Map]       │    │  │
│  Haptic alerts +      │  │  └──────────────────────────┘    │  │
│  ambient proximity    │  └───────────────────────────────────┘  │
└───────────────────────┴─────────────────────────────────────────┘
```

**Left phone (dark):** Google Maps zoomed into NOTL Old Town, with real walking route + animated walker marker. Toggle to force-directed **Spatial Commerce Graph** (d3-force).

**Right phone (light):** Claude AI streaming responses, grounded in MCP tool data. Merchant cards surface inline with inventory confidence, stories, and products.

**Apple Watch:** Ambient haptic alerts when approaching a winery. Simulates always-on wearable commerce context.

---

## Three New Agentic Commerce Primitives

### 1. Inventory Confidence Score
> *"How likely is this product to be in stock right now?"*

A **time-decayed, crowdsourced confidence score** — not binary in-stock/out-of-stock, but a live signal:
- Recent visitor confirmations (crowdsourced)
- Hours since last confirmation (time decay)
- Merchant category baseline

Displayed as: **`80% in stock · 12 visitors · 2h ago`**

### 2. Merchant Storytelling by Claude
> *"One human sentence that makes you feel something."*

Claude generates a single italicised human sentence per merchant — not a product description:

> *"Elena's grandmother taught her to make jam in this kitchen forty years ago — and she still uses the same copper pot."*

### 3. Undiscovered Merchant Digital Twin
> *"Invite this business to Shopify."*

When the AI detects a physical business that isn't on Shopify, it renders a **ghost merchant card** — purple-themed, blurred, "UNDISCOVERED" badge — with an "Invite to Shopify" CTA.

This is the primitive that turns every walk into a merchant acquisition channel.

---

## Spatial Commerce Graph (`/api/places-graph`)

The centrepiece: a force-directed graph of real Ontario merchants with Shopify verification.

### Three-step verification pipeline

```
Step A: Domain match
  Google Places website domain ↔ Shopify Global Catalog checkout URL domain

Step B: Text search by merchant name
  Catalog merchant names → Google Places Text Search → verified node

Step C: Demo fallback
  If 0 verified nodes found, enrich top-rated mock merchants with
  catalog data matched by type category
```

### What the graph shows

| Node type | Visual | Meaning |
|-----------|--------|---------|
| Verified (Shopify) | Green, large, centered | Confirmed in Shopify Global Catalog — real products + checkout |
| Ghost | Amber, small, outer ring | Real Ontario business, not on Shopify yet |

| Edge type | Visual | Meaning |
|-----------|--------|---------|
| Commerce edge | Green solid | Verified↔verified; weighted by type affinity + catalog category overlap |
| Shadow edge | Amber dashed | Ghost→nearest verified; LLM-inferred commercial proximity |

### Real verified merchants found (examples)

| Merchant | City | Catalog domain |
|---------|------|---------------|
| In A Jam | London | smallbatchjamco.com |
| Gunn's Hill Artisan Cheese | London | cheesyplace.com |
| Pluck Tea | Toronto | looseleafteamarket.com |
| oddBird | Niagara | thezeroproof.com |
| Woody's and SAILOR | Toronto | heritagegoodsandsupply.com |

Typical result: **~59 nodes** (9 verified / 50 ghost), **~1000+ edges**

---

## MCP Tools

Three tools exposed via `/api/mcp-tools`:

| Tool | Description |
|------|-------------|
| `get_scenic_route` | Walking/biking route via Google Maps Directions API. Returns waypoints, distance, duration. |
| `get_nearby_merchants` | Discover Shopify-linked merchants within radius. Returns merchant cards with products + checkout links. |
| `get_merchant_graph` | Co-purchase similarity graph. Returns nodes + weighted edges (TypeAffinity × Jaccard tag similarity). |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite, Tailwind CSS, TanStack Query, Wouter |
| **API** | Express 5, contract-first OpenAPI, Zod v4 validation |
| **Database** | PostgreSQL + Drizzle ORM (schema exists; stateless in current demo) |
| **AI** | Anthropic `claude-sonnet-4-6`, SSE streaming |
| **Maps** | Google Maps JS API + Routes/Directions/Places API |
| **Commerce** | Shopify Global Catalog API (UCP MCP format, OAuth2) |
| **Graph** | d3-force (forceSimulation + forceLink + forceManyBody) |
| **Monorepo** | pnpm workspaces, TypeScript 5.9, Orval codegen |

---

## Project Structure

```
explore-route-mcp/
├── artifacts/
│   ├── api-server/              # Express 5 backend
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── scenic.ts          # Route, merchant, graph, MCP tools
│   │       │   ├── anthropic.ts       # Claude SSE streaming chat
│   │       │   └── shopify-catalog.ts # Global Catalog OAuth + search routes
│   │       └── lib/
│   │           └── shopify-catalog-client.ts  # Shared catalog client
│   └── scenic-routes/           # React + Vite frontend
│       └── src/
│           ├── pages/home.tsx          # Main split-screen UI
│           └── components/
│               ├── AiChat.tsx          # Claude chat + merchant cards
│               ├── MapView.tsx         # Google Maps integration
│               ├── MerchantGraph.tsx   # d3-force spatial commerce graph
│               ├── AppleWatch.tsx      # Wearable ambient alerts
│               ├── McpToolsPanel.tsx   # MCP tool schema inspector
│               └── DiscoveryFeed.tsx   # Journey event feed
├── lib/
│   ├── api-spec/openapi.yaml    # OpenAPI source of truth
│   ├── api-client-react/        # Generated React Query hooks (Orval)
│   ├── api-zod/                 # Generated Zod schemas (Orval)
│   ├── db/                      # Drizzle ORM schema
│   └── integrations-anthropic-ai/  # Anthropic client wrapper
├── docs/
│   └── BUILD_JOURNAL.md         # Full engineering journal (what was tried, what worked, what was removed)
├── pnpm-workspace.yaml          # Workspace config + catalog pins
└── tsconfig.json                # TypeScript solution file
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 10+
- PostgreSQL database
- Google Maps API key (Maps JS + Directions + Places APIs enabled)
- Anthropic API key (or Replit AI Integrations)
- Shopify Global Catalog credentials (from [dev.shopify.com/dashboard](https://dev.shopify.com/dashboard) → Catalogs)

### 1. Clone & Install

```bash
git clone https://github.com/SavitaaV/explore-route-mcp.git
cd explore-route-mcp
pnpm install
```

### 2. Environment Variables

```env
# Google Maps — backend Directions/Places API
GOOGLE_MAPS_API_KEY=your_key_here

# Google Maps — frontend JS embed (same value, must be VITE_ prefixed)
VITE_GOOGLE_MAPS_API_KEY=your_key_here

# PostgreSQL
DATABASE_URL=postgres://user:password@localhost:5432/explore_route_mcp

# Anthropic (via Replit AI Integrations or direct)
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_INTEGRATIONS_ANTHROPIC_API_KEY=your_key_here

# Shopify Global Catalog (from dev.shopify.com → Catalogs → key detail page)
SHOPIFY_CATALOG_CLIENT_ID=your_client_id
SHOPIFY_CATALOG_CLIENT_SECRET=your_client_secret

# Session secret
SESSION_SECRET=your_random_secret_here
```

> **Shopify credentials note:** `SHOPIFY_CATALOG_CLIENT_ID` is NOT the record ID shown in the Catalogs list — navigate into the key detail page to find the real OAuth `client_id`.

### 3. Database Setup

```bash
pnpm --filter @workspace/db run push
```

### 4. Run Development Servers

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port auto-assigned via PORT env)
pnpm --filter @workspace/scenic-routes run dev
```

### 5. Try It

1. Type *"Show me a walk in Niagara-on-the-Lake"* in the Claude chat
2. Watch the route load on the left phone map
3. Click **Start Walk** to animate the journey — Apple Watch fires haptic alerts
4. Toggle **Map → Graph** to explore the spatial commerce network
5. Click any green (verified) graph node to see real Shopify products with live Buy → links
6. Use the **Global Catalog search** in the sidebar to query any Shopify product worldwide

---

## How Shopify Global Catalog Verification Works

The `/api/places-graph` endpoint runs a three-step verification pipeline:

1. **Fetch catalog domains** — 10 Ontario-scoped queries (wine, artisan jam, maple syrup, honey, cheese, craft beer, chocolate, coffee, artisan gifts, loose leaf tea) retrieve merchant domains from the Shopify Global Catalog
2. **Domain match** — compare each Google Places result's `website` domain against the catalog domains
3. **Text search** — for catalog merchant names with no direct domain match, run Google Text Search to find their physical location

Verified merchants get their catalog products (real images, CAD prices, live checkout URLs) embedded in the graph node tooltip.

---

## Codegen

After changing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec exec orval --config ./orval.config.ts
```

Regenerates React Query hooks and Zod schemas. Restart workflows after.

---

## Key Design Decisions

**Shopify Global Catalog over Mock.shop:** The prototype originally used Mock.shop (a free public Shopify GraphQL sandbox) for product data. Mock.shop was removed — it's a demo sandbox with generic fashion/apparel products that have no connection to actual Shopify merchants or Ontario artisan goods. The Shopify Global Catalog API provides real verified merchant data.

**Walking loop in NOTL Old Town:** Origin = Market Square, Destination = Fort George. Google Maps returns a real ~3.2km walking route covering the historic district.

**Graceful API degradation:** All Google Maps calls fall back to curated NOTL mock data when the key is absent. The SVG map placeholder renders a recognisable NOTL overview.

**Stateless chat:** Conversation is browser-session-scoped. The DB schema (conversations/messages) exists but isn't used for persistence in the current demo.

**SSE streaming:** Claude responses stream via `ReadableStream` + `TextDecoder` — not generated Orval hooks — per Anthropic's streaming guidance.

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scenic-route` | GET | Walking route via Google Maps |
| `/api/merchants` | GET | Nearby merchants with inventory confidence |
| `/api/merchant-card` | POST | Merchant card with curated products |
| `/api/merchant-graph` | GET | NOTL co-purchase similarity graph |
| `/api/places-graph` | GET | Ontario spatial commerce graph (Places + Global Catalog) |
| `/api/catalog/status` | GET | Shopify Global Catalog credential status |
| `/api/catalog/search` | GET | Live global product search |
| `/api/anthropic/conversations/:id/messages` | POST | Claude SSE streaming chat |
| `/api/mcp-tools` | GET | MCP tool schemas |

---

## Inspired By

- [Shopify Agentic Commerce](https://shopify.dev/docs/agents) — the product vision this prototype demonstrates
- [Perplexity](https://perplexity.ai) — streaming, source-grounded AI chat UX pattern
- [Model Context Protocol](https://modelcontextprotocol.io) — the open standard powering tool-grounded AI agents

---

## Full Engineering Journal

See [`docs/BUILD_JOURNAL.md`](./docs/BUILD_JOURNAL.md) for the complete record of what was built, what was tried (including Mock.shop and why it was removed), key bugs fixed, and gotchas for future engineers.

---

## License

MIT — build on it, fork it, show it to Shopify PMs.
