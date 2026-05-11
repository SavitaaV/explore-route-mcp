import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const CATALOG_CLIENT_ID = process.env.SHOPIFY_CATALOG_CLIENT_ID;
const CATALOG_CLIENT_SECRET = process.env.SHOPIFY_CATALOG_CLIENT_SECRET;
const CATALOG_RECORD_ID = "54c0b945864dc88b5bfd3fe5c20fe444"; // dashboard record ID (not auth credential)

// ─── JWT token cache (60-min TTL) ────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  if (!CATALOG_CLIENT_ID || !CATALOG_CLIENT_SECRET) return null;
  // Both secrets equal the record ID → credentials not yet updated
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

// ─── UCP Agent Profile (required for MCP endpoint) ───────────────────────────
// Served at /api/ucp-agent-profile so it has a stable public URL.
router.get("/ucp-agent-profile", (_req, res) => {
  res.json({
    ucp: {
      version: "2026-04-08",
      capabilities: {
        "dev.ucp.shopping.cart": [{ version: "2026-04-08" }],
        "dev.ucp.shopping.checkout": [{ version: "2026-04-08" }],
      },
    },
  });
});

// ─── GET /api/catalog/health ──────────────────────────────────────────────────
// Returns credential status and a live token test.
router.get("/catalog/health", async (_req, res) => {
  const hasCredentials = !!(CATALOG_CLIENT_ID && CATALOG_CLIENT_SECRET);
  const credentialsArePlaceholder =
    CATALOG_CLIENT_ID === CATALOG_RECORD_ID || CATALOG_CLIENT_SECRET === CATALOG_RECORD_ID;

  if (!hasCredentials) {
    res.json({ ok: false, reason: "Missing SHOPIFY_CATALOG_CLIENT_ID or SHOPIFY_CATALOG_CLIENT_SECRET" });
    return;
  }
  if (credentialsArePlaceholder) {
    res.json({
      ok: false,
      reason: "Credentials contain dashboard record ID instead of OAuth client credentials. Please update both secrets with the Client ID and Client secret from the key detail page on dev.shopify.com.",
    });
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    res.json({ ok: false, reason: "Token exchange failed — check CLIENT_ID and CLIENT_SECRET" });
    return;
  }

  // Quick search ping to verify token works
  const ping = await fetch(
    "https://catalog.shopify.com/global/v2/search?query=coffee&limit=1&ships_to=CA",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const pingData = (await ping.json()) as { errors?: unknown };
  const pingOk = ping.ok && !pingData.errors;

  res.json({
    ok: pingOk,
    tokenObtained: true,
    catalogPing: ping.status,
    reason: pingOk ? "Shopify Global Catalog API is live" : `Catalog ping returned ${ping.status}`,
  });
});

// ─── Type definitions for catalog responses ───────────────────────────────────
interface CatalogOffer {
  shop?: { name?: string; domain?: string };
  price?: { amount?: number; currency_code?: string };
  available_for_sale?: boolean;
  checkout_url?: string;
  variant_id?: string;
}

interface CatalogProduct {
  upid?: string;
  title?: string;
  description?: string;
  vendor?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  image_url?: string;
  offers?: CatalogOffer[];
  tags?: string[];
  product_type?: string;
}

interface CatalogSearchResponse {
  universal_products?: CatalogProduct[];
  products?: CatalogProduct[];
  results?: CatalogProduct[];
  errors?: unknown;
  cursor?: string;
}

// ─── GET /api/catalog/search ──────────────────────────────────────────────────
// Searches the Shopify Global Catalog.
// Query params: q (required), limit (1-10), shipsTo (ISO country, default CA),
//               shipsFrom, minPrice, maxPrice
router.get("/catalog/search", async (req, res) => {
  const { q, limit = "8", shipsTo = "CA", shipsFrom, minPrice, maxPrice } = req.query as Record<string, string>;

  if (!q) {
    res.status(400).json({ error: "q query param is required" });
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    res.json({
      source: "unavailable",
      products: [],
      reason: "Shopify Catalog credentials not yet configured. Update SHOPIFY_CATALOG_CLIENT_ID and SHOPIFY_CATALOG_CLIENT_SECRET with real OAuth credentials from dev.shopify.com.",
    });
    return;
  }

  const limitNum = Math.min(10, Math.max(1, parseInt(limit, 10) || 8));
  const params = new URLSearchParams({
    query: q,
    limit: String(limitNum),
    ships_to: shipsTo,
  });
  if (shipsFrom) params.set("ships_from", shipsFrom);
  if (minPrice) params.set("min_price", minPrice);
  if (maxPrice) params.set("max_price", maxPrice);

  try {
    const r = await fetch(`https://catalog.shopify.com/global/v2/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const raw = (await r.json()) as CatalogSearchResponse;

    if (!r.ok || raw.errors) {
      logger.warn({ status: r.status, errors: raw.errors }, "shopify-catalog: search error");
      res.status(r.ok ? 500 : r.status).json({ error: "Catalog search failed", detail: raw.errors });
      return;
    }

    const items: CatalogProduct[] = raw.universal_products ?? raw.products ?? (raw.results as CatalogProduct[] | undefined) ?? [];

    const products = items.map((p) => ({
      upid: p.upid,
      title: p.title ?? "Unknown product",
      description: p.description,
      vendor: p.vendor ?? p.offers?.[0]?.shop?.name,
      shopDomain: p.offers?.[0]?.shop?.domain,
      minPrice: p.min_price ?? p.offers?.[0]?.price?.amount,
      maxPrice: p.max_price,
      currency: p.currency ?? p.offers?.[0]?.price?.currency_code,
      imageUrl: p.image_url,
      checkoutUrl: p.offers?.[0]?.checkout_url,
      variantId: p.offers?.[0]?.variant_id,
      tags: p.tags ?? [],
      productType: p.product_type,
      offersCount: p.offers?.length ?? 0,
    }));

    res.json({ source: "shopify-global-catalog", query: q, shipsTo, count: products.length, products });
  } catch (err) {
    logger.error({ err }, "shopify-catalog: search fetch threw");
    res.status(500).json({ error: "Failed to search Shopify Catalog", detail: String(err) });
  }
});

// ─── POST /api/catalog/mcp ────────────────────────────────────────────────────
// Proxies a raw JSON-RPC call to the Global Catalog MCP endpoint.
// Body: { method, params } — we add jsonrpc/id/meta.ucp-agent.profile automatically.
router.post("/catalog/mcp", async (req, res) => {
  const { method = "tools/call", params = {} } = req.body as { method?: string; params?: unknown };

  const token = await getAccessToken();
  if (!token) {
    res.json({
      source: "unavailable",
      reason: "Shopify Catalog credentials not yet configured",
    });
    return;
  }

  // Build profile URL from incoming request host
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const profileUrl = `${proto}://${host}/api/ucp-agent-profile`;

  const body = {
    jsonrpc: "2.0",
    method,
    id: Date.now(),
    params,
    meta: { "ucp-agent": { profile: profileUrl } },
  };

  try {
    const r = await fetch("https://catalog.shopify.com/api/ucp/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await r.json()) as unknown;
    res.status(r.status).json(data);
  } catch (err) {
    logger.error({ err }, "shopify-catalog: mcp proxy threw");
    res.status(500).json({ error: "MCP proxy failed", detail: String(err) });
  }
});

// ─── GET /api/catalog/status ──────────────────────────────────────────────────
// Returns configuration status for the UI credential banner.
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
      ? "Go to dev.shopify.com/dashboard → Catalogs → click your key → copy the Client ID and Client secret (not the record ID shown in the list)"
      : !hasId || !hasSecret
      ? "Set SHOPIFY_CATALOG_CLIENT_ID and SHOPIFY_CATALOG_CLIENT_SECRET in Replit Secrets"
      : null,
  });
});

export default router;
