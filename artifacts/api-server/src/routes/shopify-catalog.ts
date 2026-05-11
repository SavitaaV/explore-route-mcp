import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const CATALOG_CLIENT_ID = process.env.SHOPIFY_CATALOG_CLIENT_ID;
const CATALOG_CLIENT_SECRET = process.env.SHOPIFY_CATALOG_CLIENT_SECRET;
const CATALOG_RECORD_ID = "54c0b945864dc88b5bfd3fe5c20fe444";

// Shopify's validated example profile — used as fallback / for testing.
// Swap for your own hosted profile once it advertises the right capabilities.
const SHOPIFY_EXAMPLE_PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json";

const MCP_ENDPOINT = "https://catalog.shopify.com/api/ucp/mcp";

// ─── JWT token cache (60-min TTL) ────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  if (!CATALOG_CLIENT_ID || !CATALOG_CLIENT_SECRET) return null;
  if (CATALOG_CLIENT_ID === CATALOG_RECORD_ID && CATALOG_CLIENT_SECRET === CATALOG_RECORD_ID) return null;

  if (_cachedToken && Date.now() < _tokenExpiresAt - 30_000) return _cachedToken;

  const res = await fetch("https://api.shopify.com/auth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CATALOG_CLIENT_ID,
      client_secret: CATALOG_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.warn({ status: res.status, err }, "shopify-catalog: token fetch failed");
    return null;
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    logger.warn({ error: data.error, desc: data.error_description }, "shopify-catalog: auth error");
    return null;
  }

  _cachedToken = data.access_token;
  _tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  logger.info({ expiresIn: data.expires_in }, "shopify-catalog: token obtained");
  return _cachedToken;
}

// ─── Core MCP caller ─────────────────────────────────────────────────────────
// The UCP profile URL MUST live inside params.arguments.meta (not top-level meta).
async function callMcp(
  token: string,
  toolName: string,
  catalogArgs: Record<string, unknown>,
  profileUrl: string = SHOPIFY_EXAMPLE_PROFILE,
): Promise<unknown> {
  const body = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: Date.now(),
    params: {
      name: toolName,
      arguments: {
        meta: { "ucp-agent": { profile: profileUrl } },
        catalog: catalogArgs,
      },
    },
  };

  const r = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return r.json();
}

// ─── UCP product shape ────────────────────────────────────────────────────────
interface UcpVariant {
  id?: string;
  title?: string;
  url?: string;
  price?: { amount?: number; currency?: string };
  availability?: { available?: boolean };
  options?: { name?: string; label?: string }[];
  media?: { type?: string; url?: string; alt_text?: string }[];
}

interface UcpProduct {
  id?: string;
  title?: string;
  description?: { plain?: string };
  variants?: UcpVariant[];
  price_range?: {
    min?: { amount?: number; currency?: string };
    max?: { amount?: number; currency?: string };
  };
  media?: { type?: string; url?: string; alt_text?: string }[];
  options?: { name?: string; values?: { label?: string }[] }[];
}

interface McpSearchResult {
  result?: {
    structuredContent?: {
      products?: UcpProduct[];
      ucp?: unknown;
      messages?: unknown[];
    };
  };
  error?: { code?: number; message?: string; data?: unknown };
}

function normalizeProducts(raw: UcpProduct[]) {
  return raw.map((p) => {
    const firstVariant = p.variants?.[0];
    const checkoutUrl = firstVariant?.url ?? null;
    return {
      id: p.id,
      title: p.title ?? "Unknown product",
      description: p.description?.plain,
      imageUrl: p.media?.[0]?.url ?? firstVariant?.media?.[0]?.url,
      minPrice: p.price_range?.min?.amount,
      maxPrice: p.price_range?.max?.amount,
      currency: p.price_range?.min?.currency ?? firstVariant?.price?.currency,
      checkoutUrl,
      variantId: firstVariant?.id,
      available: firstVariant?.availability?.available ?? true,
      options: p.options ?? [],
      variants: (p.variants ?? []).map((v) => ({
        id: v.id,
        title: v.title,
        price: v.price?.amount,
        currency: v.price?.currency,
        url: v.url,
        available: v.availability?.available ?? true,
        options: v.options ?? [],
        imageUrl: v.media?.[0]?.url,
      })),
    };
  });
}

// ─── UCP Agent Profile ────────────────────────────────────────────────────────
// This profile is fetched by Shopify when the MCP request includes its URL.
// Capabilities advertised here determine which tools Shopify returns.
router.get("/ucp-agent-profile", (_req, res) => {
  res.json({
    ucp: {
      version: "2026-04-08",
      capabilities: {
        "dev.ucp.shopping.catalog.search": [{ version: "2026-04-08" }],
        "dev.ucp.shopping.catalog.lookup": [{ version: "2026-04-08" }],
        "dev.ucp.shopping.cart": [{ version: "2026-04-08" }],
        "dev.ucp.shopping.checkout": [{ version: "2026-04-08" }],
      },
    },
  });
});

// ─── GET /api/catalog/status ──────────────────────────────────────────────────
router.get("/catalog/status", (_req, res) => {
  const hasId = !!CATALOG_CLIENT_ID;
  const hasSecret = !!CATALOG_CLIENT_SECRET;
  const isPlaceholder =
    CATALOG_CLIENT_ID === CATALOG_RECORD_ID || CATALOG_CLIENT_SECRET === CATALOG_RECORD_ID;

  res.json({
    configured: hasId && hasSecret && !isPlaceholder,
    hasClientId: hasId,
    hasClientSecret: hasSecret,
    isPlaceholder,
    instructions: isPlaceholder
      ? "Go to dev.shopify.com/dashboard → Catalogs → click your key → copy Client ID and Client secret (not the record ID in the list)"
      : !hasId || !hasSecret
        ? "Set SHOPIFY_CATALOG_CLIENT_ID and SHOPIFY_CATALOG_CLIENT_SECRET in Replit Secrets"
        : null,
  });
});

// ─── GET /api/catalog/health ──────────────────────────────────────────────────
router.get("/catalog/health", async (_req, res) => {
  const hasCredentials = !!(CATALOG_CLIENT_ID && CATALOG_CLIENT_SECRET);
  const credentialsArePlaceholder =
    CATALOG_CLIENT_ID === CATALOG_RECORD_ID || CATALOG_CLIENT_SECRET === CATALOG_RECORD_ID;

  if (!hasCredentials) {
    res.json({ ok: false, reason: "Missing SHOPIFY_CATALOG_CLIENT_ID or SHOPIFY_CATALOG_CLIENT_SECRET" });
    return;
  }
  if (credentialsArePlaceholder) {
    res.json({ ok: false, reason: "Credentials are the dashboard record ID — update both secrets with real OAuth values" });
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    res.json({ ok: false, reason: "Token exchange failed — check CLIENT_ID and CLIENT_SECRET" });
    return;
  }

  // Quick search ping via MCP
  const ping = (await callMcp(token, "search_catalog", {
    query: "coffee",
    filters: { available: true, ships_to: { country: "CA" } },
    context: { address_country: "CA" },
    pagination: { limit: 1 },
  })) as McpSearchResult;

  const products = ping.result?.structuredContent?.products ?? [];
  const pingOk = !ping.error && products.length >= 0;

  res.json({
    ok: pingOk,
    tokenObtained: true,
    productsFound: products.length,
    reason: pingOk
      ? "Shopify Global Catalog API is live"
      : `Catalog ping error: ${ping.error?.message ?? "unknown"}`,
    detail: ping.error ?? undefined,
  });
});

// ─── GET /api/catalog/search ──────────────────────────────────────────────────
// Query params: q (required), limit (1-10), shipsTo (ISO-2, default CA),
//               intent (buyer intent string), maxPrice (cents)
router.get("/catalog/search", async (req, res) => {
  const { q, limit = "8", shipsTo = "CA", intent, maxPrice } = req.query as Record<string, string>;

  if (!q) {
    res.status(400).json({ error: "q query param is required" });
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    res.json({
      source: "unavailable",
      products: [],
      reason:
        "Shopify Catalog credentials not configured. Update SHOPIFY_CATALOG_CLIENT_ID and SHOPIFY_CATALOG_CLIENT_SECRET.",
    });
    return;
  }

  const limitNum = Math.min(10, Math.max(1, parseInt(limit, 10) || 8));

  const catalogArgs: Record<string, unknown> = {
    query: q,
    filters: {
      available: true,
      ships_to: { country: shipsTo },
      ...(maxPrice ? { price: { max: parseInt(maxPrice, 10) } } : {}),
    },
    context: {
      address_country: shipsTo,
      ...(intent ? { intent } : {}),
    },
    pagination: { limit: limitNum },
  };

  try {
    const raw = (await callMcp(token, "search_catalog", catalogArgs)) as McpSearchResult;

    if (raw.error) {
      logger.warn({ error: raw.error }, "shopify-catalog: search error");
      res.status(500).json({ error: "Catalog search failed", detail: raw.error });
      return;
    }

    const items = raw.result?.structuredContent?.products ?? [];
    const products = normalizeProducts(items);

    res.json({ source: "shopify-global-catalog", query: q, shipsTo, count: products.length, products });
  } catch (err) {
    logger.error({ err }, "shopify-catalog: search threw");
    res.status(500).json({ error: "Failed to search Shopify Catalog", detail: String(err) });
  }
});

// ─── POST /api/catalog/mcp ────────────────────────────────────────────────────
// Raw MCP proxy — body: { toolName, catalogArgs, profileUrl? }
// Handles the correct params.arguments.meta placement automatically.
router.post("/catalog/mcp", async (req, res) => {
  const {
    toolName = "search_catalog",
    catalogArgs = {},
    profileUrl,
  } = req.body as { toolName?: string; catalogArgs?: Record<string, unknown>; profileUrl?: string };

  const token = await getAccessToken();
  if (!token) {
    res.json({ source: "unavailable", reason: "Shopify Catalog credentials not configured" });
    return;
  }

  const profile =
    profileUrl ??
    (() => {
      const proto = req.headers["x-forwarded-proto"] ?? "https";
      const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
      return host ? `${proto}://${host}/api/ucp-agent-profile` : SHOPIFY_EXAMPLE_PROFILE;
    })();

  try {
    const data = await callMcp(token, toolName, catalogArgs, profile);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "shopify-catalog: mcp proxy threw");
    res.status(500).json({ error: "MCP proxy failed", detail: String(err) });
  }
});

export default router;
