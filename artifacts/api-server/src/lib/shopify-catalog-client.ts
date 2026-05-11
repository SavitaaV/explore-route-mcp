import { logger } from "./logger";

const CATALOG_CLIENT_ID = process.env.SHOPIFY_CATALOG_CLIENT_ID;
const CATALOG_CLIENT_SECRET = process.env.SHOPIFY_CATALOG_CLIENT_SECRET;
const CATALOG_RECORD_ID = "54c0b945864dc88b5bfd3fe5c20fe444";
const SHOPIFY_EXAMPLE_PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json";
const MCP_ENDPOINT = "https://catalog.shopify.com/api/ucp/mcp";

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

export async function getShopifyToken(): Promise<string | null> {
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
    logger.warn({ status: res.status }, "shopify-catalog-client: token fetch failed");
    return null;
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (data.error || !data.access_token) return null;

  _cachedToken = data.access_token;
  _tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  logger.info({ expiresIn: data.expires_in }, "shopify-catalog-client: token obtained");
  return _cachedToken;
}

export interface CatalogProduct {
  id?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  checkoutUrl?: string;
  shopDomain?: string;  // normalized base domain, e.g. "upsidedrinks.ca"
  minPrice?: number;    // in dollars (already ÷ 100)
  maxPrice?: number;
  currency?: string;
  categories: string[]; // product option names + query category tags
}

interface UcpVariant {
  id?: string;
  url?: string;
  price?: { amount?: number; currency?: string };
  availability?: { available?: boolean };
  media?: { url?: string }[];
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
  media?: { url?: string }[];
  options?: { name?: string; values?: { label?: string }[] }[];
}

function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function normalizeUcpProduct(p: UcpProduct, category: string): CatalogProduct {
  const firstVariant = p.variants?.[0];
  const checkoutUrl = firstVariant?.url ?? undefined;
  const shopDomain = checkoutUrl ? extractDomain(checkoutUrl) : undefined;
  // UCP prices are in minor units (cents) — divide by 100 for dollars
  const minPrice = p.price_range?.min?.amount != null ? p.price_range.min.amount / 100 : undefined;
  const maxPrice = p.price_range?.max?.amount != null ? p.price_range.max.amount / 100 : undefined;
  const currency = p.price_range?.min?.currency ?? firstVariant?.price?.currency;
  const categories = [
    category,
    ...(p.options ?? []).map((o) => o.name?.toLowerCase() ?? "").filter(Boolean),
  ];

  return {
    id: p.id,
    title: p.title ?? "Unknown product",
    description: p.description?.plain,
    imageUrl: p.media?.[0]?.url ?? firstVariant?.media?.[0]?.url,
    checkoutUrl,
    shopDomain,
    minPrice,
    maxPrice,
    currency,
    categories: [...new Set(categories)],
  };
}

export async function searchCatalog(
  query: string,
  opts: { limit?: number; shipsTo?: string; category?: string } = {}
): Promise<CatalogProduct[]> {
  const token = await getShopifyToken();
  if (!token) return [];

  const { limit = 6, shipsTo = "CA", category = query } = opts;

  const body = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: Date.now(),
    params: {
      name: "search_catalog",
      arguments: {
        meta: { "ucp-agent": { profile: SHOPIFY_EXAMPLE_PROFILE } },
        catalog: {
          query,
          filters: { available: true, ships_to: { country: shipsTo } },
          context: { address_country: shipsTo },
          pagination: { limit },
        },
      },
    },
  };

  try {
    const r = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = (await r.json()) as {
      result?: { structuredContent?: { products?: UcpProduct[] } };
      error?: unknown;
    };
    if (raw.error) {
      logger.warn({ error: raw.error, query }, "shopify-catalog-client: search error");
      return [];
    }
    return (raw.result?.structuredContent?.products ?? []).map((p) =>
      normalizeUcpProduct(p, category)
    );
  } catch (err) {
    logger.warn({ err, query }, "shopify-catalog-client: search threw");
    return [];
  }
}

// Normalize a URL or bare domain to a comparable base domain string
// "https://www.upsidedrinks.ca/products/..." → "upsidedrinks.ca"
export function normalizeDomain(urlOrDomain: string): string {
  try {
    const u = urlOrDomain.startsWith("http")
      ? new URL(urlOrDomain)
      : new URL(`https://${urlOrDomain}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return urlOrDomain.toLowerCase().replace(/^www\./, "");
  }
}
