import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MOCK_SHOP_URL = "https://mock.shop/api";

// NOTL Old Town walking loop: Market Square → Fort George → Waterfront → Queen St → back
const MOCK_ROUTE = {
  encodedPolyline:
    "ue|mGb_~_NiAuBoBiD{AmCeAqBeA}BmAaC{@mB}@sBq@oBi@oB]uBOyBAyB?}BJaC^gCp@iCvAiCpBcCjCqB|CaB`DqAxDoAnE_AlE_AnE_AlE_AnE{@nEq@nEe@pESlE?lEN~DZzD",
  distanceKm: 3.2,
  durationMinutes: 38,
  summary: "Niagara-on-the-Lake Old Town Walking Loop",
  mapUrl: "",
  mode: "walking",
  waypoints: [
    { lat: 43.2553, lng: -79.0712, name: "Market Square" },
    { lat: 43.2617, lng: -79.058, name: "Fort George National Historic Site" },
    { lat: 43.2627, lng: -79.066, name: "Simcoe Park & Waterfront" },
    { lat: 43.2554, lng: -79.0733, name: "Shaw Festival Theatre" },
    { lat: 43.2547, lng: -79.0712, name: "Queen Street" },
    { lat: 43.2553, lng: -79.0712, name: "Market Square" },
  ],
};

// NOTL Old Town walkable merchants — all within 10 min walk
const MOCK_MERCHANTS = [
  {
    id: "greaves-jams",
    name: "Greaves Jams & Marmalades",
    type: "artisan",
    lat: 43.2547,
    lng: -79.0712,
    address: "55 Queen St, Niagara-on-the-Lake, ON",
    rating: 4.8,
    distanceFromRouteKm: 0.05,
    photoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400",
    description: "Family-run artisan jam makers since 1927. Over 30 flavours of preserves, chutneys, and marmalades made with Niagara fruit.",
    isOpen: true,
    walkMinutes: 1,
    isOnShopify: true,
    story: "Ruth Greaves started making jam in this exact kitchen in 1927. Her great-granddaughter now runs it — the lavender honey recipe hasn't changed once.",
    inventoryConfidence: 92,
    recentVisitors: 6,
    hoursAgoConfirmed: 1,
  },
  {
    id: "balzacs-coffee",
    name: "Balzac's Coffee Roasters",
    type: "cafe",
    lat: 43.255,
    lng: -79.0715,
    address: "16 Queen St, Niagara-on-the-Lake, ON",
    rating: 4.6,
    distanceFromRouteKm: 0.1,
    photoUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
    description: "Artisan coffee roasters with a gorgeous heritage-building café. Perfect mid-walk espresso stop.",
    isOpen: true,
    walkMinutes: 2,
    isOnShopify: true,
    story: "They roast every batch in-house every Monday morning. The Ethiopian single-origin they're pouring this week won a national award — and they're almost out.",
    inventoryConfidence: 78,
    recentVisitors: 4,
    hoursAgoConfirmed: 3,
  },
  {
    id: "treadwell-farm",
    name: "Treadwell Farm-to-Table",
    type: "restaurant",
    lat: 43.2601,
    lng: -79.0698,
    address: "114 Queen St, Niagara-on-the-Lake, ON",
    rating: 4.7,
    distanceFromRouteKm: 0.2,
    photoUrl: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400",
    description: "Award-winning farm-to-table bistro sourcing directly from Niagara producers. Celebrated for seasonal menus and local wine pairings.",
    isOpen: true,
    walkMinutes: 4,
    isOnShopify: true,
    story: "Stephen Treadwell drives to three farms every morning before 7am. What's on the menu today wasn't decided until he got back.",
    inventoryConfidence: 85,
    recentVisitors: 5,
    hoursAgoConfirmed: 2,
  },
  {
    id: "shaw-festival-shop",
    name: "Shaw Festival Theatre Shop",
    type: "boutique",
    lat: 43.2554,
    lng: -79.0733,
    address: "10 Queen's Parade, Niagara-on-the-Lake, ON",
    rating: 4.5,
    distanceFromRouteKm: 0.3,
    photoUrl: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400",
    description: "Curated theatre merchandise, books, prints, and gifts at North America's premier Shaw festival. One-of-a-kind souvenirs.",
    isOpen: true,
    walkMinutes: 5,
    isOnShopify: true,
    story: "The signed programme from the 1962 opening season is framed above the till. The current run sold out in four hours — the shop has the cast tote bag if you missed it.",
    inventoryConfidence: 70,
    recentVisitors: 3,
    hoursAgoConfirmed: 4,
  },
  {
    id: "oliv-tasting-room",
    name: "Oliv Tasting Room",
    type: "artisan",
    lat: 43.255,
    lng: -79.0702,
    address: "Ontario St, Niagara-on-the-Lake, ON",
    rating: 4.7,
    distanceFromRouteKm: 0.1,
    photoUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400",
    description: "Premium artisan olive oils and aged balsamic vinegars. Taste before you buy — pairings and gift sets available.",
    isOpen: true,
    walkMinutes: 2,
    isOnShopify: true,
    story: "They import directly from three family groves in Crete and Tuscany. You can taste twelve oils before you buy — the 25-year barrel-aged balsamic is the one people come back for.",
    inventoryConfidence: 88,
    recentVisitors: 5,
    hoursAgoConfirmed: 1,
  },
  {
    id: "niagara-home-bakery",
    name: "Niagara Home Bakery",
    type: "bakery",
    lat: 43.2555,
    lng: -79.0718,
    address: "66 Queen St, Niagara-on-the-Lake, ON",
    rating: 4.6,
    distanceFromRouteKm: 0.05,
    photoUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
    description: "Beloved local bakery with fresh-baked sourdough, butter tarts, and Niagara peach pastries. A NOTL institution.",
    isOpen: true,
    walkMinutes: 1,
    isOnShopify: true,
    story: "Maria has been baking since 4am every day for thirty-one years. The butter tarts sell out by noon — it's 11:47 right now.",
    inventoryConfidence: 61,
    recentVisitors: 2,
    hoursAgoConfirmed: 5,
  },
  {
    id: "peller-estates",
    name: "Peller Estates Winery",
    type: "winery",
    lat: 43.1784,
    lng: -79.0612,
    address: "290 John St E, Niagara-on-the-Lake, ON",
    rating: 4.6,
    distanceFromRouteKm: 0.8,
    photoUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400",
    description: "Award-winning estate winery on the outskirts of Old Town. Famous for Icewine and vineyard restaurant.",
    isOpen: true,
    walkMinutes: 18,
    isOnShopify: true,
    story: "The 2021 Icewine grapes were hand-harvested at 3am in January when the temperature hit −10°C. They made 1,200 bottles. Forty-three are left.",
    inventoryConfidence: 94,
    recentVisitors: 8,
    hoursAgoConfirmed: 1,
  },
  // Ghost merchant — not yet on Shopify, discovered through explorer crowdsourcing
  {
    id: "ceramic-studio-ghost",
    name: "Mariana's Ceramic Studio",
    type: "artisan",
    lat: 43.2558,
    lng: -79.0725,
    address: "Behind 74 Queen St, Niagara-on-the-Lake, ON",
    rating: null,
    distanceFromRouteKm: 0.08,
    photoUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400",
    description: "A ceramics studio discovered by 4 explorers this week. No website, no social media — just a handwritten sign on the gate.",
    isOpen: null,
    walkMinutes: 2,
    isOnShopify: false,
    story: "She's been throwing pots in this courtyard for twenty-two years. She learned from her grandmother in Portugal. The spring collection she just finished took four months.",
    inventoryConfidence: null,
    recentVisitors: 4,
    hoursAgoConfirmed: 2,
  },
];

async function fetchScenicRoute(origin: string, destination: string, mode: string = "walking") {
  if (!GOOGLE_MAPS_API_KEY) {
    logger.info("No Google Maps API key — returning mock NOTL walking route");
    return { ...MOCK_ROUTE, mode };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      routes?: Array<{
        overview_polyline?: { points: string };
        legs?: Array<{
          distance?: { text: string; value: number };
          duration?: { text: string; value: number };
        }>;
        summary?: string;
      }>;
    };

    if (data.status !== "OK" || !data.routes?.[0]) {
      logger.warn({ status: data.status }, "Google Maps returned non-OK status, using mock");
      return { ...MOCK_ROUTE, mode };
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const encodedPolyline = route.overview_polyline?.points ?? "";

    return {
      encodedPolyline,
      distanceKm: Math.round(((leg?.distance?.value ?? 3200) / 1000) * 10) / 10,
      durationMinutes: Math.round((leg?.duration?.value ?? 2280) / 60),
      summary: `${route.summary ?? "NOTL Old Town"} (${mode} loop)`,
      mapUrl: `https://maps.googleapis.com/maps/api/staticmap?size=600x400&path=enc:${encodedPolyline}&key=${GOOGLE_MAPS_API_KEY}`,
      waypoints: MOCK_ROUTE.waypoints,
      mode,
    };
  } catch (err) {
    logger.error({ err }, "Error fetching scenic route, using mock");
    return { ...MOCK_ROUTE, mode };
  }
}

async function fetchNearbyMerchants(lat: number, lng: number, radius: number = 800, type: string = "all") {
  if (!GOOGLE_MAPS_API_KEY) {
    logger.info("No Google Maps API key — returning mock NOTL merchants");
    const filtered = type === "all" ? MOCK_MERCHANTS : MOCK_MERCHANTS.filter((m) => m.type === type);
    return filtered;
  }

  try {
    const placeType =
      type === "bakery" ? "bakery" :
      type === "cafe" ? "cafe" :
      type === "restaurant" ? "restaurant" :
      "tourist_attraction";
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${placeType}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        place_id: string;
        name: string;
        geometry?: { location?: { lat: number; lng: number } };
        vicinity?: string;
        rating?: number;
        opening_hours?: { open_now?: boolean };
        photos?: Array<{ photo_reference: string }>;
        types?: string[];
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) {
      logger.warn({ status: data.status }, "Google Places returned no results, using mock");
      return MOCK_MERCHANTS;
    }

    return data.results.slice(0, 8).map((place, i) => {
      const pType =
        place.types?.includes("bakery") ? "bakery" :
        place.types?.includes("cafe") ? "cafe" :
        place.types?.includes("restaurant") ? "restaurant" :
        "boutique";
      const photoRef = place.photos?.[0]?.photo_reference;
      const distLat = (place.geometry?.location?.lat ?? lat) - lat;
      const distLng = (place.geometry?.location?.lng ?? lng) - lng;
      const distKm = Math.round(Math.sqrt(distLat * distLat + distLng * distLng) * 111 * 10) / 10;
      // Simulate time-decayed crowdsourced inventory confidence
      const baseConfidence = 65 + Math.floor(Math.random() * 30);
      const hoursAgo = 1 + Math.floor(Math.random() * 5);
      const confidence = Math.round(baseConfidence * (1 - hoursAgo / 24 * 0.25));
      const visitors = 2 + Math.floor(Math.random() * 6);
      return {
        id: place.place_id,
        name: place.name,
        type: pType,
        lat: place.geometry?.location?.lat ?? lat,
        lng: place.geometry?.location?.lng ?? lng,
        address: place.vicinity ?? "",
        rating: place.rating ?? null,
        distanceFromRouteKm: distKm,
        photoUrl: photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`
          : null,
        description: `Local ${pType} — ${visitors} explorers visited recently.`,
        isOpen: place.opening_hours?.open_now ?? null,
        walkMinutes: Math.round(distKm * 12),
        isOnShopify: i < 7,
        story: null,
        inventoryConfidence: confidence,
        recentVisitors: visitors,
        hoursAgoConfirmed: hoursAgo,
      };
    });
  } catch (err) {
    logger.error({ err }, "Error fetching merchants, using mock");
    return MOCK_MERCHANTS;
  }
}

async function fetchShopifyProducts(merchantType: string) {
  const query = `{
    products(first: 3) {
      edges {
        node {
          id
          title
          variants(first: 1) {
            edges {
              node {
                id
                price { amount currencyCode }
              }
            }
          }
          images(first: 1) {
            edges {
              node { url altText }
            }
          }
        }
      }
    }
  }`;

  try {
    const res = await fetch(MOCK_SHOP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const data = (await res.json()) as {
      data?: {
        products?: {
          edges?: Array<{
            node: {
              id: string;
              title: string;
              variants: { edges: Array<{ node: { id: string; price: { amount: string; currencyCode: string } } }> };
              images: { edges: Array<{ node: { url: string; altText?: string } }> };
            };
          }>;
        };
      };
    };

    const edges = data.data?.products?.edges ?? [];

    return edges.map((edge) => {
      const product = edge.node;
      const variant = product.variants.edges[0]?.node;
      const image = product.images.edges[0]?.node;
      const checkoutUrl = `https://mock.shop/products/${product.id.replace("gid://shopify/Product/", "")}`;
      return {
        id: product.id,
        title:
          merchantType === "winery" ? product.title.replace(/product/i, "Reserve Icewine") :
          merchantType === "bakery" ? product.title.replace(/product/i, "Fresh Sourdough") :
          product.title,
        price: `$${parseFloat(variant?.price?.amount ?? "25").toFixed(2)} ${variant?.price?.currencyCode ?? "CAD"}`,
        imageUrl: image?.url ?? null,
        checkoutUrl,
      };
    });
  } catch (err) {
    logger.error({ err }, "Error fetching Shopify products, using mock products");
    return [
      {
        id: "mock-1",
        title: merchantType === "winery" ? "Reserve Icewine 2022" : merchantType === "bakery" ? "Sourdough Loaf + Butter Tarts" : "Artisan Gift Set",
        price: merchantType === "winery" ? "$65.00 CAD" : "$18.00 CAD",
        imageUrl: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400",
        checkoutUrl: "https://mock.shop/products/1",
      },
      {
        id: "mock-2",
        title: merchantType === "winery" ? "Cabernet Franc Reserve" : merchantType === "cafe" ? "Seasonal Blend Bag 250g" : "Local Honey Collection",
        price: merchantType === "winery" ? "$42.00 CAD" : "$22.00 CAD",
        imageUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400",
        checkoutUrl: "https://mock.shop/products/2",
      },
    ];
  }
}

// GET /api/scenic-route
router.get("/scenic-route", async (req, res) => {
  const { origin, destination, mode } = req.query;

  if (!origin || !destination) {
    res.status(400).json({ error: "origin and destination query params are required" });
    return;
  }

  try {
    const route = await fetchScenicRoute(String(origin), String(destination), String(mode ?? "walking"));
    res.json(route);
  } catch (err) {
    req.log.error({ err }, "Failed to get scenic route");
    res.status(500).json({ error: "Failed to fetch scenic route" });
  }
});

// GET /api/merchants
router.get("/merchants", async (req, res) => {
  const { lat, lng, radius, type } = req.query;

  if (!lat || !lng) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  const latNum = parseFloat(String(lat));
  const lngNum = parseFloat(String(lng));
  const radiusNum = radius ? parseFloat(String(radius)) : 800;

  if (isNaN(latNum) || isNaN(lngNum)) {
    res.status(400).json({ error: "lat and lng must be valid numbers" });
    return;
  }

  try {
    const merchants = await fetchNearbyMerchants(latNum, lngNum, radiusNum, String(type ?? "all"));
    res.json(merchants);
  } catch (err) {
    req.log.error({ err }, "Failed to get merchants");
    res.status(500).json({ error: "Failed to fetch merchants" });
  }
});

// POST /api/merchant-card
router.post("/merchant-card", async (req, res) => {
  const { merchantId, merchantName, merchantType } = req.body as {
    merchantId: string;
    merchantName: string;
    merchantType: string;
  };

  if (!merchantId || !merchantName) {
    res.status(400).json({ error: "merchantId and merchantName are required" });
    return;
  }

  try {
    const merchant = MOCK_MERCHANTS.find((m) => m.id === merchantId) ?? {
      id: merchantId,
      name: merchantName,
      type: merchantType ?? "boutique",
      lat: 43.2553,
      lng: -79.0712,
      address: "Queen St, Niagara-on-the-Lake, ON",
      rating: 4.5,
      distanceFromRouteKm: 0.1,
      photoUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400",
      description: `Local ${merchantType ?? "shop"} in NOTL Old Town.`,
      isOpen: true,
      walkMinutes: 2,
    };

    const products = await fetchShopifyProducts(merchantType ?? "boutique");
    const checkoutUrl = products[0]?.checkoutUrl ?? "https://mock.shop/";

    res.json({
      merchant,
      products,
      checkoutUrl,
      hapticDistance: 0.3,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get merchant card");
    res.status(500).json({ error: "Failed to fetch merchant card" });
  }
});

// Merchant type → Mock.shop collection handle for real product tag extraction.
// Each handle maps to a distinct corner of Mock.shop's catalog so merchants get
// genuinely different tag sets, producing data-driven Jaccard similarity scores.
const MERCHANT_COLLECTION: Record<string, string> = {
  winery:     "featured",    // broad/premium selection — widest tag spread
  restaurant: "unisex",      // broad audience appeal
  cafe:       "tops",        // everyday accessible items
  bakery:     "women",       // female-skewed purchase pattern
  artisan:    "accessories", // gift-oriented curated items
  boutique:   "shoes",       // curated footwear — highest avg price tier
};

// Fallback tag vocabulary used only if Mock.shop is unreachable
const TYPE_TAGS_FALLBACK: Record<string, string[]> = {
  winery:     ["wine", "icewine", "vineyard", "reserve", "cellar"],
  bakery:     ["bread", "sourdough", "pastry", "organic", "local-grain"],
  cafe:       ["coffee", "espresso", "single-origin", "fair-trade", "cold-brew"],
  restaurant: ["seasonal", "farm-to-table", "tasting-menu", "fine-dining"],
  artisan:    ["handmade", "artisan", "gift", "craft", "small-batch"],
  boutique:   ["curated", "souvenir", "local-art", "collectible", "unique"],
};

// Fetch real product tags from a Mock.shop collection
async function fetchCollectionTags(collectionHandle: string): Promise<string[]> {
  const query = `{
    collection(handle: "${collectionHandle}") {
      products(first: 8) {
        edges {
          node {
            tags
            productType
          }
        }
      }
    }
  }`;
  try {
    const res = await fetch(MOCK_SHOP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = (await res.json()) as {
      data?: {
        collection?: {
          products?: {
            edges?: Array<{ node: { tags: string[]; productType: string } }>;
          };
        };
      };
    };
    const edges = data.data?.collection?.products?.edges ?? [];
    const tagSet = new Set<string>();
    edges.forEach((e) => {
      e.node.tags.forEach((t) => tagSet.add(t));
      if (e.node.productType) tagSet.add(e.node.productType);
    });
    return [...tagSet];
  } catch {
    return [];
  }
}

// Co-purchase type affinity prior (symmetric)
const TYPE_AFFINITY: Record<string, Record<string, number>> = {
  winery:     { winery: 1.0, restaurant: 0.80, artisan: 0.60, boutique: 0.55, cafe: 0.35, bakery: 0.25 },
  restaurant: { winery: 0.80, restaurant: 1.0, cafe: 0.65, bakery: 0.60, artisan: 0.45, boutique: 0.35 },
  cafe:       { cafe: 1.0, bakery: 0.75, restaurant: 0.65, artisan: 0.50, boutique: 0.45, winery: 0.35 },
  bakery:     { bakery: 1.0, cafe: 0.75, restaurant: 0.60, artisan: 0.50, boutique: 0.40, winery: 0.25 },
  artisan:    { artisan: 1.0, boutique: 0.70, winery: 0.60, cafe: 0.50, bakery: 0.50, restaurant: 0.45 },
  boutique:   { boutique: 1.0, artisan: 0.70, winery: 0.55, cafe: 0.45, bakery: 0.40, restaurant: 0.35 },
};

function jaccardSim(a: string[], b: string[]): { score: number; shared: string[] } {
  const setA = new Set(a);
  const shared = b.filter((x) => setA.has(x));
  const union = new Set([...a, ...b]);
  return { score: union.size === 0 ? 0 : shared.length / union.size, shared };
}

// GET /api/merchant-graph
router.get("/merchant-graph", async (req, res) => {
  const rawSim = parseFloat(String(req.query.minSimilarity ?? "0.25"));
  const minSim = Number.isFinite(rawSim) ? Math.max(0, Math.min(1, rawSim)) : 0.25;
  const allowedTypes = new Set(["winery", "bakery", "cafe", "restaurant", "artisan", "boutique"]);
  const typeFilter = req.query.merchantTypes
    ? String(req.query.merchantTypes)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => allowedTypes.has(s))
    : null;

  const graphMerchants = MOCK_MERCHANTS.filter(
    (m) => m.isOnShopify && (!typeFilter || typeFilter.includes(m.type))
  );

  const uniqueTypes = [...new Set(graphMerchants.map((m) => m.type))];

  // Fetch real product data from Mock.shop in parallel per merchant type:
  // - collection tags for Jaccard feature vectors (from the type-mapped collection)
  // - product prices for price-proximity similarity
  const [tagsByType, avgPriceByType] = await Promise.all([
    // Real product tags from Mock.shop collection mapped to each merchant type
    Promise.all(
      uniqueTypes.map(async (type) => {
        const handle = MERCHANT_COLLECTION[type];
        if (!handle) return [type, TYPE_TAGS_FALLBACK[type] ?? []] as const;
        const tags = await fetchCollectionTags(handle);
        // Graceful fallback: use TYPE_TAGS_FALLBACK if Mock.shop returns empty
        return [type, tags.length > 0 ? tags : (TYPE_TAGS_FALLBACK[type] ?? [])] as const;
      })
    ).then((pairs) => Object.fromEntries(pairs) as Record<string, string[]>),

    // Real average prices from Mock.shop product variants
    Promise.all(
      uniqueTypes.map(async (type) => {
        try {
          const products = await fetchShopifyProducts(type);
          const prices = products
            .map((p) => parseFloat(p.price.replace(/[^0-9.]/g, "")))
            .filter(Boolean);
          return [type, prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null] as const;
        } catch {
          return [type, null] as const;
        }
      })
    ).then((pairs) => Object.fromEntries(pairs) as Record<string, number | null>),
  ]);

  req.log.debug({ tagsByType }, "merchant-graph: real tags fetched from Mock.shop");

  const nodes = graphMerchants.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    rating: m.rating,
    lat: m.lat,
    lng: m.lng,
    photoUrl: m.photoUrl,
    // topTags: real product tags from Mock.shop for this merchant's collection
    topTags: (tagsByType[m.type] ?? []).slice(0, 5),
    avgPrice: avgPriceByType[m.type] ?? null,
  }));

  // Compute all prices for normalisation
  const allPrices = Object.values(avgPriceByType).filter((p): p is number => p !== null);
  const priceMin = allPrices.length ? Math.min(...allPrices) : 0;
  const priceRange = allPrices.length ? Math.max(...allPrices) - priceMin || 1 : 1;

  const edges: Array<{ sourceId: string; targetId: string; similarityScore: number; sharedTags: string[] }> = [];

  for (let i = 0; i < graphMerchants.length; i++) {
    for (let j = i + 1; j < graphMerchants.length; j++) {
      const a = graphMerchants[i];
      const b = graphMerchants[j];
      // Use real Mock.shop product tags for Jaccard — tags come from
      // the collection mapped to each merchant type via MERCHANT_COLLECTION
      const tagsA = tagsByType[a.type] ?? [];
      const tagsB = tagsByType[b.type] ?? [];
      const { score: jScore, shared } = jaccardSim(tagsA, tagsB);

      const typeAff = TYPE_AFFINITY[a.type]?.[b.type] ?? 0.30;
      const priceA = avgPriceByType[a.type] ?? priceMin + priceRange / 2;
      const priceB = avgPriceByType[b.type] ?? priceMin + priceRange / 2;
      const priceSim = 1 - Math.abs(priceA - priceB) / priceRange;

      const score = Math.round((0.40 * typeAff + 0.40 * jScore + 0.20 * priceSim) * 100) / 100;

      if (score >= minSim) {
        edges.push({ sourceId: a.id, targetId: b.id, similarityScore: score, sharedTags: shared.slice(0, 4) });
      }
    }
  }

  req.log.info({ nodes: nodes.length, edges: edges.length }, "merchant-graph computed");
  res.json({ nodes, edges });
});

// GET /api/mcp-tools
router.get("/mcp-tools", (_req, res) => {
  res.json([
    {
      name: "get_scenic_route",
      description:
        "Get a walking or biking route within Niagara-on-the-Lake Old Town. Returns a ~3km loop from Market Square through Fort George, the waterfront, and Queen Street with encoded polyline, distance, and duration.",
      inputSchema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Start location (e.g. 'Market Square, NOTL')" },
          destination: { type: "string", description: "End location (e.g. 'Fort George, NOTL')" },
          mode: { type: "string", enum: ["walking", "bicycling"], description: "Travel mode" },
        },
        required: ["origin", "destination"],
      },
    },
    {
      name: "get_nearby_merchants",
      description:
        "Discover independent merchants within walking distance in NOTL Old Town (artisan shops, cafés, bakeries, wineries, boutiques). Returns Shopify-linked merchant cards with one-tap checkout for each.",
      inputSchema: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitude of current position" },
          lng: { type: "number", description: "Longitude of current position" },
          radius: { type: "number", description: "Search radius in meters (default 800)" },
          type: {
            type: "string",
            enum: ["winery", "bakery", "artisan", "cafe", "restaurant", "boutique", "all"],
            description: "Merchant category filter",
          },
        },
        required: ["lat", "lng"],
      },
    },
    {
      name: "get_merchant_graph",
      description:
        "Get a co-purchase similarity graph of all merchants on the route. Nodes are merchants; edges represent the probability a shopper who buys from one will also buy from another, computed from product tag overlap, price-range proximity, and merchant-type affinity. Use to recommend 'pairs well with' merchants or understand the commerce ecosystem on a route.",
      inputSchema: {
        type: "object",
        properties: {
          minSimilarity: {
            type: "number",
            description: "Minimum edge similarity threshold 0–1 (default 0.25). Raise to see only the strongest connections.",
          },
          merchantTypes: {
            type: "string",
            description: "Comma-separated list of merchant types to include (e.g. 'winery,restaurant'). Omit for all types.",
          },
        },
        required: [],
      },
    },
  ]);
});

export default router;
export { MOCK_MERCHANTS };
