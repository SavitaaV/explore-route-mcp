# Explore Route MCP

> **A Shopify Agentic Commerce prototype** — walking discovery in Niagara-on-the-Lake Old Town, powered by Google Maps, Claude AI, and Mock.shop. Built to demonstrate what the next generation of spatially-aware, MCP-native commerce UX looks like.

<p align="center">
  <img src="https://img.shields.io/badge/Shopify-MCP-96BF48?style=for-the-badge&logo=shopify&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude-Sonnet-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Google%20Maps-Routes%20API-4285F4?style=for-the-badge&logo=googlemaps&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/pnpm-workspace-F69220?style=for-the-badge&logo=pnpm&logoColor=white" />
</p>

---

## What Is This?

Shopify's [2025 Agentic Commerce reveal](https://shopify.dev/docs/agents) introduced a new primitive: **shopping as an ambient, spatially-aware agent experience** — not a storefront you navigate to, but commerce that finds you where you are.

This prototype is a working implementation of that vision:

- A **Claude AI agent** grounded in real MCP merchant data walks you through Niagara-on-the-Lake Old Town
- It calls **Shopify MCP tools** (`get_scenic_route`, `get_nearby_merchants`, `get_merchant_graph`) to fetch live context
- **Google Maps** renders the walking route in a real phone frame
- **Mock.shop** (Shopify's free GraphQL sandbox) powers real product data and checkout links
- Three new **agentic commerce primitives** are demonstrated: inventory confidence scoring, merchant storytelling, and undiscovered merchant digital twins

---

## The UX — Cinematic Split Screen

Inspired directly by Shopify's agentic commerce design language:

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

**Left phone (dark):** Google Maps zoomed into NOTL Old Town, with real walking route + animated walker marker. Toggle to force-directed **Merchant Similarity Graph** powered by d3-force.

**Right phone (light):** Claude AI agent streaming responses, grounded in MCP tool data. Cards surface inline — merchant cards, product listings, inventory confidence, ghost merchants.

**Apple Watch:** Ambient haptic alerts when you approach a winery. Simulates always-on wearable commerce context.

---

## Three New Agentic Commerce Primitives

### 1. Inventory Confidence Score
> *"How likely is this product to be in stock right now?"*

A **time-decayed, crowdsourced confidence score** — not just "in stock / out of stock" binary state, but a live signal computed from:
- Recent visitor confirmations (crowdsourced)
- Hours since last confirmation (time decay)
- Merchant category baseline

Displayed as a badge: **`80% in stock · 12 visitors · 2h ago`**

This is the commerce signal that makes an AI agent trustworthy — it can say "Peller Estates has high confidence for Icewine right now" and mean it.

### 2. Merchant Storytelling by Claude
> *"One human sentence that makes you feel something."*

Every Shopify merchant has a story. Claude generates a single italicized human sentence — not a product description, not marketing copy:

> *"Elena's grandmother taught her to make jam in this kitchen forty years ago — and she still uses the same copper pot."*

Surfaced in merchant cards as a story quote. The differentiator between a product page and an agent that knows the neighbourhood.

### 3. Undiscovered Merchant Digital Twin
> *"Invite this business to Shopify."*

When the AI detects a physical business that isn't yet on Shopify, it renders a **ghost merchant card** — purple-themed, blurred photo, "UNDISCOVERED" badge — with an **"Invite to Shopify"** CTA.

This is the primitive that turns every walk into a merchant acquisition channel. The agent scouts new inventory sources in real-time.

---

## Merchant Similarity Graph (Task #2)

The **co-purchase similarity graph** is a force-directed network showing which merchants a shopper who visits one is likely to also visit. Nodes are merchants; edges are weighted by a 3-factor blend:

```
Similarity = 0.40 × TypeAffinity + 0.40 × Jaccard(real_product_tags) + 0.20 × PriceSimilarity
```

- **TypeAffinity** — prior co-purchase probability matrix (winery↔restaurant = 0.80, cafe↔bakery = 0.75, etc.)
- **Jaccard(product_tags)** — real product tags fetched from Mock.shop's GraphQL API per merchant category. Each merchant type maps to a distinct Mock.shop collection handle so tag overlap is genuinely data-driven.
- **PriceSimilarity** — normalised price proximity from real Mock.shop variant prices

**Result:** 7 Shopify merchant nodes, 21 weighted edges. Hover any node to see "Pairs well with" — the top 3 most likely co-purchase neighbours with % similarity score and shared product tags.

The `get_merchant_graph` MCP tool exposes this to Claude so it can recommend "shoppers who visit Peller Estates also tend to visit Oliv Tasting Room" in chat.

---

## MCP Tools

Three tools exposed via `/api/mcp-tools` — these are the primitives Claude calls:

| Tool | Description |
|------|-------------|
| `get_scenic_route` | Walking/biking route between two points via Google Maps Directions API. Returns waypoints, distance, duration. |
| `get_nearby_merchants` | Discover Shopify-linked merchants within radius of a location. Returns merchant cards with products + checkout links. |
| `get_merchant_graph` | Co-purchase similarity graph. Returns nodes + weighted edges computed from real Mock.shop product tags + price data. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite, Tailwind CSS, TanStack Query, Wouter |
| **API** | Express 5, contract-first OpenAPI, Zod v4 validation |
| **Database** | PostgreSQL + Drizzle ORM |
| **AI** | Anthropic `claude-sonnet-4-6`, SSE streaming |
| **Maps** | Google Maps JS API + Routes/Directions API |
| **Commerce** | Mock.shop (free Shopify GraphQL sandbox) |
| **Graph** | d3-force (forceSimulation + forceLink + forceManyBody) |
| **Monorepo** | pnpm workspaces, TypeScript 5.9, Orval codegen |

---

## Project Structure

```
explore-route-mcp/
├── artifacts/
│   ├── api-server/              # Express 5 backend
│   │   └── src/routes/
│   │       ├── scenic.ts        # Route, merchant, graph, MCP tools
│   │       └── anthropic.ts     # Claude SSE streaming chat
│   └── scenic-routes/           # React + Vite frontend
│       └── src/
│           ├── pages/home.tsx   # Main split-screen UI
│           └── components/
│               ├── AiChat.tsx          # Claude chat + merchant cards
│               ├── MapView.tsx         # Google Maps integration
│               ├── MerchantGraph.tsx   # d3-force similarity graph
│               ├── AppleWatch.tsx      # Wearable ambient alerts
│               ├── McpToolsPanel.tsx   # MCP tool schema inspector
│               └── DiscoveryFeed.tsx   # Journey event feed
├── lib/
│   ├── api-spec/openapi.yaml    # OpenAPI source of truth
│   ├── api-client-react/        # Generated React Query hooks (Orval)
│   ├── api-zod/                 # Generated Zod schemas (Orval)
│   ├── db/                      # Drizzle ORM schema
│   └── integrations-anthropic-ai/  # Anthropic client wrapper
├── scripts/                     # Utility scripts
├── pnpm-workspace.yaml          # Workspace config + catalog pins
└── tsconfig.json                # TypeScript solution file
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 10+
- PostgreSQL database
- Google Maps API key (with Maps JS + Directions API enabled)
- Anthropic API key

### 1. Clone & Install

```bash
git clone https://github.com/SavitaaV/explore-route-mcp.git
cd explore-route-mcp
pnpm install
```

### 2. Environment Variables

Create a `.env` file (or set via your platform's secrets manager):

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

# Session secret
SESSION_SECRET=your_random_secret_here
```

> **Note:** Mock.shop (`https://mock.shop/api`) is a free public sandbox — no token or account needed.

### 3. Database Setup

```bash
pnpm --filter @workspace/db run push
```

### 4. Run Development Servers

In two terminals:

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port auto-assigned via PORT env)
pnpm --filter @workspace/scenic-routes run dev
```

Then open `http://localhost:5173` (or whatever port Vite assigns).

### 5. Try It

1. Type *"Show me a walk in Niagara-on-the-Lake"* in the Claude chat
2. Watch the route load on the left phone map
3. Click **Start Walk** to animate the journey — Apple Watch fires haptic alerts
4. Toggle **Map → Graph** to explore the merchant similarity network
5. Click any graph node to open its Shopify merchant card with real products

---

## Codegen

After changing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec exec orval --config ./orval.config.ts
```

This regenerates React Query hooks (`lib/api-client-react/src/generated/`) and Zod schemas (`lib/api-zod/src/generated/`). Restart workflows after.

---

## Key Design Decisions

**Walking loop in NOTL Old Town:** Origin = Market Square, Destination = Fort George — Google Maps returns a real ~3.2km walking route covering the historic district. The 8 mock merchants are placed along this actual route.

**Graceful API degradation:** All Google Maps calls fall back to curated NOTL Old Town mock data when the API key is absent. The SVG map placeholder renders a recognisable NOTL overview.

**Stateless chat:** Conversation is browser-session-scoped. The DB schema (conversations/messages tables) exists but isn't used for persistence — the demo is self-contained.

**Real Mock.shop data for graph:** The merchant similarity graph maps each merchant type to a different Mock.shop collection handle (`winery→featured`, `restaurant→unisex`, `cafe→tops`, etc.) so Jaccard tag similarity is computed from real GraphQL product data, not synthetic vocabularies.

**SSE streaming:** Claude responses stream via `ReadableStream` + `TextDecoder` on the frontend — not generated hooks — per Anthropic's streaming guidance. Each chunk is parsed as `data: {...}` SSE events.

---

## API Reference

### `GET /api/scenic-route`
Returns a walking/biking route between two points.

**Query params:** `origin`, `destination`, `mode` (`walking` | `cycling`)

**Response:** `{ summary, distanceKm, durationMinutes, waypoints[] }`

### `GET /api/merchants`
Returns nearby Shopify merchants for a location.

**Query params:** `lat`, `lng`, `radius` (metres), `type`

**Response:** `Merchant[]` with inventory confidence, story, Shopify status

### `GET /api/merchant-graph`
Returns the co-purchase similarity graph.

**Query params:** `minSimilarity` (0–1, default 0.25), `merchantTypes` (comma-separated)

**Response:** `{ nodes: MerchantNode[], edges: MerchantEdge[] }`

### `POST /api/anthropic/conversations/:id/messages`
Streams a Claude response as SSE.

**Body:** `{ content: string }`

**Response:** `text/event-stream` — chunks of `{ type: "delta", content: string }`

### `GET /api/mcp-tools`
Returns all available MCP tool schemas.

**Response:** `Array<{ name, description, inputSchema }>`

---

## Inspired By

- [Shopify Agentic Commerce](https://shopify.dev/docs/agents) — the product vision this prototype demonstrates
- [Perplexity](https://perplexity.ai) — streaming, source-grounded AI chat UX pattern
- [Model Context Protocol](https://modelcontextprotocol.io) — the open standard powering tool-grounded AI agents

---

## License

MIT — build on it, fork it, show it to Shopify PMs.
