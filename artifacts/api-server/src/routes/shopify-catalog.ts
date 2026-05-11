import { Router } from "express";
import { logger } from "../lib/logger";
import { getShopifyToken, searchCatalog, normalizeDomain } from "../lib/shopify-catalog-client";

const router = Router();

// ─── UCP Agent Profile ────────────────────────────────────────────────────────
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
const CATALOG_CLIENT_ID = process.env.SHOPIFY_CATALOG_CLIENT_ID;
const CATALOG_CLIENT_SECRET = process.env.SHOPIFY_CATALOG_CLIENT_SECRET;
const CATALOG_RECORD_ID = "54c0b945864dc88b5bfd3fe5c20fe444";

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
  const isPlaceholder =
    CATALOG_CLIENT_ID === CATALOG_RECORD_ID || CATALOG_CLIENT_SECRET === CATALOG_RECORD_ID;

  if (!CATALOG_CLIENT_ID || !CATALOG_CLIENT_SECRET) {
    res.json({ ok: false, reason: "Missing SHOPIFY_CATALOG_CLIENT_ID or SHOPIFY_CATALOG_CLIENT_SECRET" });
    return;
  }
  if (isPlaceholder) {
    res.json({ ok: false, reason: "Credentials are the dashboard record ID — update both secrets with real OAuth values" });
    return;
  }

  const token = await getShopifyToken();
  if (!token) {
    res.json({ ok: false, reason: "Token exchange failed — check CLIENT_ID and CLIENT_SECRET" });
    return;
  }

  const products = await searchCatalog("coffee", { limit: 1, shipsTo: "CA" });
  const pingOk = products.length >= 0;

  res.json({
    ok: pingOk,
    tokenObtained: true,
    productsFound: products.length,
    reason: pingOk ? "Shopify Global Catalog API is live" : "Catalog ping returned no results",
  });
});

// ─── GET /api/catalog/search ──────────────────────────────────────────────────
router.get("/catalog/search", async (req, res) => {
  const { q, limit = "8", shipsTo = "CA" } = req.query as Record<string, string>;

  if (!q) {
    res.status(400).json({ error: "q query param is required" });
    return;
  }

  const token = await getShopifyToken();
  if (!token) {
    res.json({
      source: "unavailable",
      products: [],
      reason: "Shopify Catalog credentials not configured. Update SHOPIFY_CATALOG_CLIENT_ID and SHOPIFY_CATALOG_CLIENT_SECRET.",
    });
    return;
  }

  try {
    const limitNum = Math.min(10, Math.max(1, parseInt(limit, 10) || 8));
    const products = await searchCatalog(q, { limit: limitNum, shipsTo, category: q });

    const normalized = products.map((p) => ({
      upid: p.id,
      title: p.title,
      description: p.description,
      vendor: p.shopDomain,
      shopDomain: p.shopDomain,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      currency: p.currency,
      imageUrl: p.imageUrl,
      checkoutUrl: p.checkoutUrl,
      tags: p.categories,
      productType: p.categories[0],
      offersCount: 1,
    }));

    res.json({ source: "shopify-global-catalog", query: q, shipsTo, count: normalized.length, products: normalized });
  } catch (err) {
    logger.error({ err }, "shopify-catalog: search threw");
    res.status(500).json({ error: "Failed to search Shopify Catalog", detail: String(err) });
  }
});

// ─── POST /api/catalog/mcp ────────────────────────────────────────────────────
// Proxy — body: { toolName, catalogArgs, profileUrl? }
// Places profile URL in params.arguments.meta (the correct UCP location).
const SHOPIFY_EXAMPLE_PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json";

router.post("/catalog/mcp", async (req, res) => {
  const {
    toolName = "search_catalog",
    catalogArgs = {},
    profileUrl,
  } = req.body as { toolName?: string; catalogArgs?: Record<string, unknown>; profileUrl?: string };

  const token = await getShopifyToken();
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
    const body = {
      jsonrpc: "2.0",
      method: "tools/call",
      id: Date.now(),
      params: {
        name: toolName,
        arguments: {
          meta: { "ucp-agent": { profile } },
          catalog: catalogArgs,
        },
      },
    };
    const r = await fetch("https://catalog.shopify.com/api/ucp/mcp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await r.json()) as unknown;
    res.status(r.status).json(data);
  } catch (err) {
    logger.error({ err }, "shopify-catalog: mcp proxy threw");
    res.status(500).json({ error: "MCP proxy failed", detail: String(err) });
  }
});

export { normalizeDomain };
export default router;
