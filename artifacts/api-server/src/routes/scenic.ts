import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MOCK_SHOP_URL = "https://mock.shop/api";

// Realistic mock route: Toronto → Niagara-on-the-Lake via Niagara Parkway
const MOCK_ROUTE = {
  encodedPolyline:
    "ohzmGj|{bNlAzBjB|DrB~EtBnFhBvEfBtE`BrEnBvFrB`GhBpFhBjFdBnE`BnD|AdD|ArDzAjDxAxC|AxCxAtCvArCrApCnApCjApCfAlCbAlC`AlCz@lCv@lCr@pCn@rCj@rCf@tCb@vC^xCZzCVzCRzCN|CJ|CF~CB~CC~CG~CK~CO|CS|CW|C[zC_@xCc@vCg@rCk@nCo@jCs@fCw@bC{@~B_A|Bc@|BYzBOxBExB",
  distanceKm: 130,
  durationMinutes: 95,
  summary: "Queen Elizabeth Way → Niagara Parkway (scenic route avoiding 400-series highways)",
  mapUrl: "https://maps.googleapis.com/maps/api/staticmap?size=600x400&path=enc:ohzmGj|{bNlAzBjB|D",
  waypoints: [
    { lat: 43.6532, lng: -79.3832, name: "Toronto, ON" },
    { lat: 43.2557, lng: -79.8711, name: "Hamilton, ON" },
    { lat: 43.1167, lng: -79.2167, name: "Niagara Parkway North" },
    { lat: 43.2553, lng: -79.0712, name: "Queenston Heights" },
    { lat: 43.1594, lng: -79.0678, name: "Niagara-on-the-Lake, ON" },
  ],
};

// Curated mock merchants along the Niagara Parkway
const MOCK_MERCHANTS = [
  {
    id: "inniskillin-winery",
    name: "Inniskillin Wines",
    type: "winery",
    lat: 43.2317,
    lng: -79.0767,
    address: "1499 Line 3 Service Rd, Niagara-on-the-Lake, ON L0S 1J0",
    rating: 4.7,
    distanceFromRouteKm: 0.3,
    photoUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400",
    description: "World-famous icewine producer on the Niagara Parkway. Founded 1975.",
    isOpen: true,
  },
  {
    id: "peller-estates",
    name: "Peller Estates Winery",
    type: "winery",
    lat: 43.1784,
    lng: -79.0612,
    address: "290 John St E, Niagara-on-the-Lake, ON L0S 1J0",
    rating: 4.6,
    distanceFromRouteKm: 0.8,
    photoUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400",
    description: "Award-winning estate winery with stunning vineyard views and restaurant.",
    isOpen: true,
  },
  {
    id: "niagara-oast-house",
    name: "Niagara Oast House Brewers",
    type: "brewery",
    lat: 43.2421,
    lng: -79.0834,
    address: "2017 Niagara Stone Rd, Niagara-on-the-Lake, ON L0S 1J0",
    rating: 4.5,
    distanceFromRouteKm: 1.2,
    photoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
    description: "Craft brewery in a restored 19th-century hop kiln. Local ingredients, seasonal beers.",
    isOpen: true,
  },
  {
    id: "niagara-artisan-market",
    name: "Greaves Jams & Marmalades",
    type: "artisan",
    lat: 43.2553,
    lng: -79.0712,
    address: "55 Queen St, Niagara-on-the-Lake, ON L0S 1J0",
    rating: 4.8,
    distanceFromRouteKm: 0.5,
    photoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400",
    description: "Family-run artisan jam makers since 1927. Over 30 flavours of jams and preserves.",
    isOpen: true,
  },
  {
    id: "treadwell-farm",
    name: "Treadwell Farm-to-Table",
    type: "cafe",
    lat: 43.2601,
    lng: -79.0698,
    address: "114 Queen St, Niagara-on-the-Lake, ON L0S 1J0",
    rating: 4.6,
    distanceFromRouteKm: 0.2,
    photoUrl: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400",
    description: "Celebrated farm-to-table bistro sourcing from local Niagara producers.",
    isOpen: true,
  },
  {
    id: "konzelmann-winery",
    name: "Konzelmann Estate Winery",
    type: "winery",
    lat: 43.2901,
    lng: -79.0512,
    address: "1096 Lakeshore Rd, Niagara-on-the-Lake, ON L0S 1J0",
    rating: 4.5,
    distanceFromRouteKm: 0.4,
    photoUrl: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400",
    description: "Lakeside estate winery with breathtaking views of Lake Ontario.",
    isOpen: false,
  },
];

// Fetch scenic route from Google Maps Routes API or return mock
async function fetchScenicRoute(origin: string, destination: string) {
  if (!GOOGLE_MAPS_API_KEY) {
    logger.info("No Google Maps API key set — returning mock route");
    return MOCK_ROUTE;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&avoid=highways&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      routes?: Array<{
        overview_polyline?: { points: string };
        legs?: Array<{
          distance?: { text: string; value: number };
          duration?: { text: string; value: number };
          steps?: Array<{ html_instructions: string }>;
        }>;
        summary?: string;
      }>;
    };

    if (data.status !== "OK" || !data.routes?.[0]) {
      logger.warn({ status: data.status }, "Google Maps returned non-OK status, using mock");
      return MOCK_ROUTE;
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const encodedPolyline = route.overview_polyline?.points ?? "";

    return {
      encodedPolyline,
      distanceKm: Math.round(((leg?.distance?.value ?? 130000) / 1000) * 10) / 10,
      durationMinutes: Math.round((leg?.duration?.value ?? 5700) / 60),
      summary: `${route.summary ?? "Niagara Parkway scenic route"} (avoiding highways)`,
      mapUrl: `https://maps.googleapis.com/maps/api/staticmap?size=600x400&path=enc:${encodedPolyline}&key=${GOOGLE_MAPS_API_KEY}`,
      waypoints: MOCK_ROUTE.waypoints,
    };
  } catch (err) {
    logger.error({ err }, "Error fetching scenic route, using mock");
    return MOCK_ROUTE;
  }
}

// Fetch nearby merchants from Google Places API or return mock
async function fetchNearbyMerchants(
  lat: number,
  lng: number,
  radius: number = 5000,
  type: string = "all"
) {
  if (!GOOGLE_MAPS_API_KEY) {
    logger.info("No Google Maps API key — returning mock merchants");
    const filtered =
      type === "all"
        ? MOCK_MERCHANTS
        : MOCK_MERCHANTS.filter((m) => m.type === type);
    return filtered;
  }

  try {
    const placeType = type === "winery" ? "tourist_attraction" : type === "bakery" ? "bakery" : "point_of_interest";
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

    return data.results.slice(0, 8).map((place) => {
      const placeType =
        place.types?.includes("food") ? "cafe" :
        place.types?.includes("bakery") ? "bakery" : "winery";
      const photoRef = place.photos?.[0]?.photo_reference;
      return {
        id: place.place_id,
        name: place.name,
        type: placeType,
        lat: place.geometry?.location?.lat ?? lat,
        lng: place.geometry?.location?.lng ?? lng,
        address: place.vicinity ?? "",
        rating: place.rating ?? null,
        distanceFromRouteKm: Math.round(Math.random() * 20) / 10,
        photoUrl: photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`
          : null,
        description: `Local ${placeType} in the Niagara region.`,
        isOpen: place.opening_hours?.open_now ?? null,
      };
    });
  } catch (err) {
    logger.error({ err }, "Error fetching merchants, using mock");
    return MOCK_MERCHANTS;
  }
}

// Fetch Shopify products from Mock.shop
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
      const variantId = variant?.id ?? "";
      // Build a proper mock checkout URL
      const encodedVariant = encodeURIComponent(variantId);
      const checkoutUrl = `https://mock.shop/products/${product.id.replace("gid://shopify/Product/", "")}`;

      return {
        id: product.id,
        title: merchantType === "winery"
          ? product.title.replace(/product/i, "Reserve Icewine")
          : product.title,
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
        title: merchantType === "winery" ? "Reserve Icewine 2022" : "Artisan Preserves Gift Set",
        price: "$45.00 CAD",
        imageUrl: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400",
        checkoutUrl: "https://mock.shop/products/1",
      },
      {
        id: "mock-2",
        title: merchantType === "winery" ? "Cabernet Franc Reserve" : "Local Honey Collection",
        price: "$32.00 CAD",
        imageUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400",
        checkoutUrl: "https://mock.shop/products/2",
      },
    ];
  }
}

// GET /api/scenic-route
router.get("/scenic-route", async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    res.status(400).json({ error: "origin and destination query params are required" });
    return;
  }

  try {
    const route = await fetchScenicRoute(String(origin), String(destination));
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
  const radiusNum = radius ? parseFloat(String(radius)) : 5000;

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
      type: merchantType ?? "winery",
      lat: 43.2553,
      lng: -79.0712,
      address: "Niagara-on-the-Lake, ON",
      rating: 4.5,
      distanceFromRouteKm: 0.5,
      photoUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400",
      description: `Local ${merchantType ?? "merchant"} along the scenic Niagara Parkway route.`,
      isOpen: true,
    };

    const products = await fetchShopifyProducts(merchantType ?? "winery");

    // Build the cart checkout URL using Mock.shop
    const checkoutUrl = products[0]?.checkoutUrl ?? "https://mock.shop/";

    res.json({
      merchant,
      products,
      checkoutUrl,
      hapticDistance: 5, // trigger wearable alert at 5km
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get merchant card");
    res.status(500).json({ error: "Failed to fetch merchant card" });
  }
});

// GET /api/mcp-tools
router.get("/mcp-tools", (_req, res) => {
  res.json([
    {
      name: "get_scenic_route",
      description:
        "Finds a scenic route between two locations avoiding highways. Uses the Niagara Parkway for Toronto–Niagara trips. Returns an encoded polyline, distance, duration, and waypoints.",
      inputSchema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Starting location (address or lat,lng)" },
          destination: { type: "string", description: "Ending location (address or lat,lng)" },
        },
        required: ["origin", "destination"],
      },
    },
    {
      name: "get_nearby_merchants",
      description:
        "Discovers independent merchants (wineries, artisan bakeries, craft breweries) near a point on the scenic route. Returns Shopify-linked merchant cards with one-tap checkout.",
      inputSchema: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitude" },
          lng: { type: "number", description: "Longitude" },
          radius: { type: "number", description: "Search radius in meters (default 5000)" },
          type: {
            type: "string",
            enum: ["winery", "bakery", "artisan", "cafe", "brewery", "all"],
            description: "Merchant category filter",
          },
        },
        required: ["lat", "lng"],
      },
    },
  ]);
});

export default router;
