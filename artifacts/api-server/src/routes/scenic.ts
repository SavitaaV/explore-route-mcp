import { Router } from "express";
import { logger } from "../lib/logger";
import { searchCatalog, normalizeDomain } from "../lib/shopify-catalog-client";
import type { CatalogProduct } from "../lib/shopify-catalog-client";

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

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

// Ontario-wide local merchants — used in mock graph fallback to give province-level coverage
const ONTARIO_MOCK_MERCHANTS = [
  {
    id: "soma-chocolate-toronto",
    name: "Soma Chocolate Maker",
    type: "artisan",
    city: "Toronto",
    lat: 43.6449, lng: -79.4022,
    address: "443 King St W, Toronto, ON",
    rating: 4.9, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400",
    description: "Award-winning bean-to-bar chocolate maker in Toronto's Distillery District. Single-origin bars and seasonal confections.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "Their 70% Madagascar has won four International Chocolate Awards.", inventoryConfidence: 88, recentVisitors: 7, hoursAgoConfirmed: 2,
  },
  {
    id: "nadege-patisserie",
    name: "Nadège Patisserie",
    type: "bakery",
    city: "Toronto",
    lat: 43.6753, lng: -79.4099,
    address: "780 Queen St W, Toronto, ON",
    rating: 4.7, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1587668178277-295251f900ce?w=400",
    description: "Parisian-style patisserie with inventive macarons and entremets made fresh daily.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "Each macaron flavour is a two-week experiment. The salty caramel took eleven tries.", inventoryConfidence: 75, recentVisitors: 5, hoursAgoConfirmed: 1,
  },
  {
    id: "holt-renfrew-toronto",
    name: "Holt Renfrew",
    type: "boutique",
    city: "Toronto",
    lat: 43.6692, lng: -79.3878,
    address: "50 Bloor St W, Toronto, ON",
    rating: 4.5, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400",
    description: "Iconic Canadian luxury department store with curated local designers and international labels.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "Founded in 1837 — Canada's oldest luxury retailer. The fur vault below street level still holds a few heirlooms.", inventoryConfidence: 72, recentVisitors: 9, hoursAgoConfirmed: 3,
  },
  {
    id: "ten-thousand-coffees",
    name: "Pilot Coffee Roasters",
    type: "cafe",
    city: "Toronto",
    lat: 43.6425, lng: -79.3965,
    address: "49 Wagstaff Dr, Toronto, ON",
    rating: 4.7, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
    description: "Toronto's premier specialty coffee roaster. Wholesale, retail, and café all under one roof.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "They source directly from 12 farms across 3 continents. The Kenya Karogoto is in season right now.", inventoryConfidence: 83, recentVisitors: 6, hoursAgoConfirmed: 2,
  },
  {
    id: "bookmarkd-toronto",
    name: "Glad Day Bookshop",
    type: "boutique",
    city: "Toronto",
    lat: 43.6626, lng: -79.3949,
    address: "499 Church St, Toronto, ON",
    rating: 4.8, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400",
    description: "World's oldest LGBTQ+ bookshop and café, now with a curated Shopify store for rare and local titles.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "Open since 1970. Every Wednesday the community table is packed for author readings.", inventoryConfidence: 68, recentVisitors: 4, hoursAgoConfirmed: 3,
  },
  {
    id: "thyme-and-truffles",
    name: "Thyme & Truffles Herb Shoppe",
    type: "artisan",
    city: "Ottawa",
    lat: 45.4266, lng: -75.6906,
    address: "717 Bank St, Ottawa, ON",
    rating: 4.8, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
    description: "Family-run herb and spice shop in the Glebe. Over 200 culinary herbs, artisan salts, and spice blends.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "Three generations of the Picard family have run this shop. Grandmère's ras el hanout is still the bestseller.", inventoryConfidence: 91, recentVisitors: 5, hoursAgoConfirmed: 1,
  },
  {
    id: "bridgehead-ottawa",
    name: "Bridgehead Coffee",
    type: "cafe",
    city: "Ottawa",
    lat: 45.4231, lng: -75.6994,
    address: "378 Dalhousie St, Ottawa, ON",
    rating: 4.6, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
    description: "Ottawa's beloved independent coffee chain — fair-trade, single-origin, and deeply local. All beans roasted in the city.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "Founded in 1983 as a poverty-relief project. Now a certified B Corp with 16 Ottawa cafés, every bean traceable.", inventoryConfidence: 79, recentVisitors: 8, hoursAgoConfirmed: 2,
  },
  {
    id: "hintonburg-public-house",
    name: "Mill Street Brewery",
    type: "winery",
    city: "Ottawa",
    lat: 45.4298, lng: -75.6894,
    address: "555 Wellington St W, Ottawa, ON",
    rating: 4.5, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400",
    description: "Ottawa's craft brewery in a historic former railway workshop. Seasonal small-batch ales brewed on-site.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "The Head Brewer left a career in biochemistry to perfect the IPA. The seasonal pumpkin ale sells out province-wide every October.", inventoryConfidence: 86, recentVisitors: 7, hoursAgoConfirmed: 1,
  },
  {
    id: "hamilton-farmer-market",
    name: "Hamilton Farmers' Market",
    type: "artisan",
    city: "Hamilton",
    lat: 43.2561, lng: -79.8686,
    address: "35 York Blvd, Hamilton, ON",
    rating: 4.7, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400",
    description: "One of Ontario's oldest farmers' markets — local produce, cheeses, meats, and artisan crafts since 1837.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: false, story: "Over 50 vendors sell their goods under one roof every Tuesday, Thursday, and Saturday. The Mennonite bakers sell out by 10am.", inventoryConfidence: null, recentVisitors: 12, hoursAgoConfirmed: 1,
  },
  {
    id: "tally-ho-ice-cream",
    name: "Tally Ho Ice Cream",
    type: "artisan",
    city: "Stratford",
    lat: 43.3706, lng: -80.9820,
    address: "80 Ontario St, Stratford, ON",
    rating: 4.8, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400",
    description: "Beloved soft-serve and handmade ice cream shop in the heart of Stratford. Local dairy, 24 rotating flavours.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: false, story: "The same family has been making the base recipe since 1957. The seasonal strawberry-rhubarb is Stratford's unofficial civic flavour.", inventoryConfidence: null, recentVisitors: 6, hoursAgoConfirmed: 2,
  },
  {
    id: "elora-brewing",
    name: "Elora Brewing Company",
    type: "winery",
    city: "Guelph",
    lat: 43.6857, lng: -80.4274,
    address: "45 Metcalfe St, Elora, ON",
    rating: 4.8, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400",
    description: "Award-winning craft brewery in a renovated 19th-century building beside the Elora Gorge. Farm-to-glass philosophy.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: true, story: "All their grains come from farms within 100km. The Elora Gorge Amber is named after the canyon it overlooks.", inventoryConfidence: 90, recentVisitors: 8, hoursAgoConfirmed: 1,
  },
  {
    id: "kingston-public-market",
    name: "Kingston Public Market",
    type: "artisan",
    city: "Kingston",
    lat: 44.2333, lng: -76.4806,
    address: "Springer Market Square, Kingston, ON",
    rating: 4.6, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400",
    description: "Historic open-air market in Kingston's downtown core. 200+ years of local artisans, farmers, and food vendors.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: false, story: "One of Canada's oldest continuously operating outdoor markets. The same family has sold cheese here for four generations.", inventoryConfidence: null, recentVisitors: 10, hoursAgoConfirmed: 2,
  },
  {
    id: "sudbury-blueberry",
    name: "Blueberry Fields Farm",
    type: "artisan",
    city: "Sudbury",
    lat: 46.4833, lng: -80.9891,
    address: "Rural Route 1, Greater Sudbury, ON",
    rating: 4.7, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400",
    description: "Family-run blueberry farm and preserves shop. U-pick in season, artisan jams and wild berry honeys year-round.",
    isOpen: true, walkMinutes: 0,
    isOnShopify: false, story: "Northern Ontario blueberries grow smaller and sweeter because of the granite soil. The farm has been in the Pelletier family since 1962.", inventoryConfidence: null, recentVisitors: 3, hoursAgoConfirmed: 4,
  },
  // Ghost merchants — local businesses not yet on Shopify
  {
    id: "ghost-barrie-pottery",
    name: "Barrie Pottery Collective",
    type: "artisan",
    city: "Barrie",
    lat: 44.3893, lng: -79.6944,
    address: "58 Dunlop St W, Barrie, ON",
    rating: null, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400",
    description: "A ceramics and pottery collective with six local artists sharing studio space. No website yet.",
    isOpen: null, walkMinutes: 0,
    isOnShopify: false, story: null, inventoryConfidence: null, recentVisitors: 2, hoursAgoConfirmed: 6,
  },
  {
    id: "ghost-kitchener-tailor",
    name: "Main Street Bespoke Tailor",
    type: "boutique",
    city: "Kitchener",
    lat: 43.4524, lng: -80.4941,
    address: "12 King St W, Kitchener, ON",
    rating: null, distanceFromRouteKm: 0, photoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
    description: "Bespoke tailoring shop with 30 years of local craftsmanship. Word-of-mouth only — no online presence.",
    isOpen: null, walkMinutes: 0,
    isOnShopify: false, story: null, inventoryConfidence: null, recentVisitors: 1, hoursAgoConfirmed: 8,
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

// Curated product catalogue per merchant type — used by /api/merchant-card for
// route-walk merchants that aren't yet verified against the Shopify Global Catalog.
const CURATED_PRODUCTS: Record<string, Array<{ id: string; title: string; price: string; imageUrl: string | null; checkoutUrl: string }>> = {
  winery: [
    { id: "w1", title: "Reserve Icewine 2022", price: "$65.00 CAD", imageUrl: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400", checkoutUrl: "https://shopify.dev/docs/agents" },
    { id: "w2", title: "Cabernet Franc Reserve", price: "$42.00 CAD", imageUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400", checkoutUrl: "https://shopify.dev/docs/agents" },
  ],
  bakery: [
    { id: "b1", title: "Sourdough Loaf", price: "$12.00 CAD", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", checkoutUrl: "https://shopify.dev/docs/agents" },
    { id: "b2", title: "Butter Tart Box (6)", price: "$18.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
  ],
  cafe: [
    { id: "c1", title: "Seasonal Blend Bag 250g", price: "$22.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
    { id: "c2", title: "Cold Brew Concentrate 500ml", price: "$16.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
  ],
  restaurant: [
    { id: "r1", title: "Farm-to-Table Tasting Menu (2 pax)", price: "$95.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
    { id: "r2", title: "House Charcuterie Board", price: "$38.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
  ],
  artisan: [
    { id: "a1", title: "Artisan Gift Set", price: "$48.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
    { id: "a2", title: "Local Honey Collection", price: "$22.00 CAD", imageUrl: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400", checkoutUrl: "https://shopify.dev/docs/agents" },
  ],
  boutique: [
    { id: "bt1", title: "NOTL Souvenir Set", price: "$35.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
    { id: "bt2", title: "Local Artisan Print", price: "$55.00 CAD", imageUrl: null, checkoutUrl: "https://shopify.dev/docs/agents" },
  ],
};

function getCuratedProducts(merchantType: string) {
  return CURATED_PRODUCTS[merchantType] ?? CURATED_PRODUCTS.artisan;
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

    const products = getCuratedProducts(merchantType ?? "boutique");
    const checkoutUrl = products[0]?.checkoutUrl ?? "https://shopify.dev/docs/agents";

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

// Curated tag vocabulary per merchant type — used for Jaccard similarity in /api/merchant-graph.
// Derived from Shopify Global Catalog category signals across real Ontario artisan merchants.
const TYPE_TAGS: Record<string, string[]> = {
  winery:     ["wine", "icewine", "vineyard", "reserve", "cellar", "non-alcoholic", "sparkling"],
  bakery:     ["bread", "sourdough", "pastry", "organic", "local-grain", "baked-goods"],
  cafe:       ["coffee", "espresso", "single-origin", "fair-trade", "cold-brew", "tea"],
  restaurant: ["seasonal", "farm-to-table", "tasting-menu", "fine-dining", "local"],
  artisan:    ["handmade", "artisan", "gift", "craft", "small-batch", "jam", "honey", "preserves"],
  boutique:   ["curated", "souvenir", "local-art", "collectible", "unique", "accessories"],
};

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

  const tagsByType = Object.fromEntries(uniqueTypes.map((t) => [t, TYPE_TAGS[t] ?? []])) as Record<string, string[]>;

  const nodes = graphMerchants.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    rating: m.rating,
    lat: m.lat,
    lng: m.lng,
    photoUrl: m.photoUrl,
    topTags: (TYPE_TAGS[m.type] ?? []).slice(0, 5),
  }));

  const edges: Array<{ sourceId: string; targetId: string; similarityScore: number; sharedTags: string[] }> = [];

  for (let i = 0; i < graphMerchants.length; i++) {
    for (let j = i + 1; j < graphMerchants.length; j++) {
      const a = graphMerchants[i];
      const b = graphMerchants[j];
      const tagsA = tagsByType[a.type] ?? [];
      const tagsB = tagsByType[b.type] ?? [];
      const { score: jScore, shared } = jaccardSim(tagsA, tagsB);
      const typeAff = TYPE_AFFINITY[a.type]?.[b.type] ?? 0.30;
      const score = Math.round((0.60 * typeAff + 0.40 * jScore) * 100) / 100;

      if (score >= minSim) {
        edges.push({ sourceId: a.id, targetId: b.id, similarityScore: score, sharedTags: shared.slice(0, 4) });
      }
    }
  }

  req.log.info({ nodes: nodes.length, edges: edges.length }, "merchant-graph computed");
  res.json({ nodes, edges });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/places-graph
// Commerce graph powered by Google Places Nearby Search.
// Nodes = real businesses in NOTL Old Town (Google Places).
// Edges = proximity (<300 m walk) × co-visit affinity (type pair score).
// Each node is tagged: shopifyStatus "verified" | "ghost" | "unknown".
// Includes a commerceRoute: suggested walk order (time-sensitive first → rating → cluster).
// ─────────────────────────────────────────────────────────────────────────────

interface PlacesResult {
  place_id: string;
  name: string;
  types: string[];
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now?: boolean };
  vicinity?: string;
}

// Map Google Places type arrays → our merchant type
function googleTypesToMerchantType(types: string[]): string {
  if (types.includes("bar") || types.includes("liquor_store")) return "winery";
  if (types.includes("bakery") || types.includes("meal_takeaway")) return "bakery";
  if (types.includes("cafe") || types.includes("coffee_shop")) return "cafe";
  if (types.includes("restaurant") || types.includes("food")) return "restaurant";
  if (types.includes("clothing_store") || types.includes("shoe_store")) return "boutique";
  if (types.includes("grocery_or_supermarket") || types.includes("supermarket")) return "artisan";
  if (types.includes("store") || types.includes("point_of_interest")) return "artisan";
  return "boutique";
}

// Haversine distance in metres
function haversineMetre(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fuzzy name match (normalise → check containment)
function nameMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = norm(a);
  const nb = norm(b);
  return na.includes(nb) || nb.includes(na);
}

// Commerce urgency score for route ordering
function urgencyScore(node: { type: string; rating: number | null; openNow: boolean | null }): number {
  let s = node.rating ?? 4.0;
  if (node.type === "bakery") s += 3;        // sell-out risk
  if (node.type === "cafe") s += 1;          // good early/mid walk
  if (node.type === "winery") s -= 0.5;      // best saved for end
  if (node.openNow === false) s -= 5;        // closed = deprioritise
  return s;
}

// Ontario city centres for multi-city Places search
const ONTARIO_CITIES = [
  { name: "Toronto",          lat: 43.6532, lng: -79.3832, radius: 20_000 },
  { name: "Ottawa",           lat: 45.4215, lng: -75.6972, radius: 20_000 },
  { name: "Hamilton",         lat: 43.2557, lng: -79.8711, radius: 15_000 },
  { name: "London",           lat: 42.9849, lng: -81.2453, radius: 15_000 },
  { name: "Niagara",          lat: 43.2553, lng: -79.0725, radius:  8_000 },
  { name: "Kitchener",        lat: 43.4516, lng: -80.4925, radius: 15_000 },
  { name: "Kingston",         lat: 44.2312, lng: -76.4860, radius: 12_000 },
  { name: "Barrie",           lat: 44.3894, lng: -79.6903, radius: 12_000 },
  { name: "Windsor",          lat: 42.3149, lng: -83.0364, radius: 12_000 },
  { name: "Sudbury",          lat: 46.4917, lng: -80.9930, radius: 12_000 },
  { name: "Peterborough",     lat: 44.3091, lng: -78.3197, radius: 10_000 },
  { name: "Guelph",           lat: 43.5448, lng: -80.2482, radius: 10_000 },
  { name: "St. Catharines",   lat: 43.1594, lng: -79.2469, radius: 10_000 },
  { name: "Stratford",        lat: 43.3703, lng: -80.9822, radius:  8_000 },
];
const PLACES_SEARCH_TYPES = [
  "restaurant", "cafe", "bakery", "store",
  "gift_shop", "clothing_store", "food", "art_gallery",
  "florist", "jewelry_store", "book_store",
  "farmer_market", "market",
];

// ─────────────────────────────────────────────────────────────────────────────
// Enterprise chain blocklist — names or name fragments that identify national /
// multinational chains to exclude from the local commerce graph.
// ─────────────────────────────────────────────────────────────────────────────
// normalizeBrand: canonical form for brand matching.
// Strips diacritics, lowercases, and replaces all punctuation/symbols with spaces,
// then collapses runs of whitespace. Applied to BOTH the business name AND each
// blocklist term before comparison so that "McDonald's" ↔ "mcdonald s",
// "A&W" ↔ "a w", "Petro-Canada" ↔ "petro canada", etc. always match.
function normalizeBrand(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // strip diacritics
    .replace(/[^a-z0-9\s]/g, " ")                        // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

// matchesBrand: safe, normalized brand-name matching.
//
// After normalizing both sides:
// • Multi-word (normalized) terms use substring match on the normalized name —
//   "hudson s bay" won't appear inside "bayfield bakery" (no "hudson").
// • Single-word (normalized) terms require an exact token match so "bay"
//   (from "the bay") does NOT match "bayfield" (tokens: ["bayfield"]).
//
// Examples:
//   "McDonald's Restaurant" ↔ "mcdonald's"  → norm names: "mcdonald s restaurant"
//                                              norm term: "mcdonald s" (multi-word) → ✓
//   "A&W Burger Bar"        ↔ "a&w"         → "a w burger bar" ↔ "a w" (multi) → ✓
//   "Petro-Canada"          ↔ "petro-canada"→ "petro canada"  ↔ "petro canada" → ✓
//   "Bayfield Bakery"       ↔ "bay"         → tokens ["bayfield","bakery"] ↔ "bay" → ✗
//   "Shelley's Boutique"    ↔ "shell"       → tokens ["shelley","s","boutique"] → ✗
function matchesBrand(name: string, term: string): boolean {
  const normName = normalizeBrand(name);
  const normTerm = normalizeBrand(term);
  if (normTerm.includes(" ")) return normName.includes(normTerm);
  const tokens = normName.split(/\s+/).filter(Boolean);
  return tokens.includes(normTerm);
}

const ENTERPRISE_CHAIN_BLOCKLIST: string[] = [
  // Grocery / supermarket chains (Loblaw & subsidiaries)
  "loblaws", "loblaw", "no frills", "nofrills", "real canadian superstore", "valu-mart", "fortinos",
  "zehrs", "valumart", "superstore", "maxi store", "maxi supermarche", "provigo",
  // Metro & subsidiaries
  "metro supermarché", "metro grocery", "food basics", "super c",
  // Other grocery
  "walmart", "costco", "sobeys", "freshco", "iga grocery", "giant tiger", "farm boy",
  "whole foods", "trader joe's", "save-on-foods", "buy-low foods",
  // Pharmacy chains
  "shoppers drug mart", "rexall", "london drugs", "pharmasave", "guardian pharmacy",
  // Fast food / QSR
  "tim horton", "mcdonald", "subway", "harvey's", "wendy's", "burger king",
  "kfc", "pizza pizza", "pizza hut", "domino's", "a&w", "dairy queen",
  "popeyes", "five guys", "chipotle", "taco bell", "dunkin",
  // Coffee chains
  "starbucks", "second cup", "coffee time", "country style",
  // Alcohol retail
  "lcbo", "the beer store", "beer store", "wine rack",
  // Home improvement & hardware
  "canadian tire", "home depot", "rona", "home hardware", "lowe's", "lowes",
  "true value", "princess auto",
  // Department / big-box — use full phrases to avoid short-fragment collisions
  "winners", "homesense", "marshalls", "hudson's bay", "the bay",
  "sears", "target", "dollarama", "dollar tree", "dollar general",
  "value village", "goodwill",
  // Gas / convenience — "shell" and "esso" as tokens are fine; "petro-canada" is multi-word
  "petro-canada", "shell", "esso", "ultramar", "circle k", "couche-tard",
  "mac's convenience", "7-eleven",
  // Telecom retail — "bell" and "rogers" are distinctive enough as tokens
  "bell", "rogers", "telus", "freedom mobile", "public mobile",
  // Banks / financial
  "td bank", "rbc", "bmo", "scotiabank", "cibc", "national bank",
  "tangerine", "hsbc", "desjardins",
  // Large apparel chains
  "h&m", "zara", "gap", "old navy", "banana republic", "forever 21",
  "uniqlo", "sport chek", "reitmans", "thyme maternity",
  "addition elle", "penningtons", "le château",
  // Other large chains
  "best buy", "the source", "future shop", "staples", "business depot",
  "chapters", "indigo", "coles bookstore",
  "aldo", "shoe company", "sport expert",
  // Large-format global brand kept here so classifyChainTier starts it as
  // "enterprise"; verifyAndPromote() upgrades it to "regional" if Shopify-verified.
  "ikea",
];

// Explicit allowlist — brands that would otherwise hit the blocklist but are
// Shopify-verified and should remain visible.
const ENTERPRISE_CHAIN_ALLOWLIST: string[] = ["ikea"];

// Large Canadian multi-province brands filtered unless Shopify-verified.
// These are national-scale but not global franchise chains.
const NATIONAL_CHAIN_LIST: string[] = [
  "holt renfrew", "roots canada", "roots clothing", "lush cosmetics", "lush fresh",
  "arc'teryx", "marks work", "l'occitane", "anthropologie", "williams-sonoma",
  "pottery barn", "restoration hardware", "rh", "crate and barrel", "west elm",
  "indochino", "frank and oak", "aritzia", "simons", "ten thousand villages",
  "highland farms", "summerhill market", "pusateri's", "longo's", "longos",
];

// Ontario-rooted multi-location brands that are clearly regional and should show
// in the graph unconditionally (no Shopify verification required).
const REGIONAL_BRAND_LIST: string[] = [
  "balzac's", "pilot coffee", "bridgehead", "elora brewing", "mill street brewery",
  "soma chocolate", "nadège", "nadege", "glad day", "greaves jams",
  "peller estates", "inniskillin", "jackson-triggs", "trius winery", "stratus",
  "reif estate", "thirty bench", "tawse winery", "cave spring", "henry of pelham",
  "flat rock cellars", "kacaba vineyard", "fielding estate", "sue-ann staff",
  "treadwell", "oliv tasting", "niagara home bakery",
];

// Google Places type patterns that signal a large-format enterprise store
// even if the name doesn't appear in any list.
const ENTERPRISE_PLACE_TYPES = new Set([
  "department_store", "furniture_store", "car_dealer",
  "car_rental", "car_repair", "moving_company", "storage",
]);

// isEnterpriseChain: used at Places dedup stage.
// Allowlisted brands pass through so they can be Shopify-verified and promoted later.
function isEnterpriseChain(name: string): boolean {
  const lower = name.toLowerCase();
  if (ENTERPRISE_CHAIN_ALLOWLIST.some((a) => matchesBrand(lower, a))) return false;
  return ENTERPRISE_CHAIN_BLOCKLIST.some((b) => matchesBrand(lower, b));
}

// classifyChainTier: assigns an initial tier using name lists AND Google Place types.
// "local"      — single-location independent business
// "regional"   — Ontario/multi-city brand (5–50 locations); shown unconditionally
// "national"   — large Canadian multi-province brand; needs verification to appear
// "enterprise" — blocked chain; removed unless allowlisted + Shopify-verified
function classifyChainTier(name: string, types: string[]): "local" | "regional" | "national" | "enterprise" {
  const lower = name.toLowerCase();
  // Blocklist (includes "ikea") → enterprise; verifyAndPromote() handles allowlist promotion
  if (ENTERPRISE_CHAIN_BLOCKLIST.some((b) => matchesBrand(lower, b))) return "enterprise";
  // Large-format type signals → treat as enterprise even if name not in list
  if (types.some((t) => ENTERPRISE_PLACE_TYPES.has(t))) return "enterprise";
  // National brands → need verification
  if (NATIONAL_CHAIN_LIST.some((b) => matchesBrand(lower, b))) return "national";
  // Known Ontario regional brands → always shown
  if (REGIONAL_BRAND_LIST.some((b) => matchesBrand(lower, b))) return "regional";
  return "local";
}

// verifyAndPromote: after shopifyStatus is known, promote allowlisted brands that
// are Shopify-verified from "enterprise" → "regional" so they survive the filter.
function verifyAndPromote(
  node: { name: string; chainTier: string; shopifyStatus: string }
): void {
  if (node.chainTier === "enterprise" && node.shopifyStatus === "verified") {
    const lower = node.name.toLowerCase();
    if (ENTERPRISE_CHAIN_ALLOWLIST.some((a) => matchesBrand(lower, a))) {
      node.chainTier = "regional";
    }
  }
}

// nameSimilarity: normalized Jaccard token overlap between two strings.
// Returns 0–1. Used to gate reverse text-search matches.
function nameSimilarity(a: string, b: string): number {
  const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean));
  const ta = tokens(a);
  const tb = tokens(b);
  const shared = [...tb].filter((t) => ta.has(t));
  const union = new Set([...ta, ...tb]);
  return union.size === 0 ? 0 : shared.length / union.size;
}

// Shopify Global Catalog queries scoped to Ontario product categories
const ONTARIO_CATALOG_QUERIES: Array<{ q: string; category: string }> = [
  // Food & beverage — artisan
  { q: "wine",                  category: "wine" },
  { q: "artisan jam",           category: "artisan-food" },
  { q: "maple syrup",           category: "artisan-food" },
  { q: "honey",                 category: "artisan-food" },
  { q: "cheese",                category: "artisan-food" },
  { q: "craft beer",            category: "beer" },
  { q: "chocolate",             category: "chocolate" },
  { q: "coffee roaster",        category: "coffee" },
  { q: "loose leaf tea",        category: "tea" },
  { q: "hot sauce",             category: "artisan-food" },
  { q: "canola oil",            category: "artisan-food" },
  // Gifts & home
  { q: "artisan gift",          category: "gifts" },
  { q: "handmade candles",      category: "home" },
  { q: "local pottery",         category: "home" },
  { q: "beeswax",               category: "home" },
  { q: "handmade soap",         category: "home" },
  // Apparel & accessories
  { q: "canadian clothing",     category: "apparel" },
  { q: "handmade jewelry",      category: "jewelry" },
  { q: "wool clothing",         category: "apparel" },
  { q: "leather goods",         category: "accessories" },
  // Wellness & beauty
  { q: "natural skincare",      category: "beauty" },
  { q: "aromatherapy",          category: "wellness" },
  { q: "herbal wellness",       category: "wellness" },
  // Art & books
  { q: "local artist prints",   category: "art" },
  { q: "independent bookstore", category: "books" },
  // Outdoor & sporting
  { q: "outdoor adventure gear", category: "outdoor" },
  { q: "cycling accessories",   category: "outdoor" },
];

// Map merchant type → catalog category for mock-graph enrichment
const TYPE_CATEGORY: Record<string, string> = {
  winery:     "wine",
  cafe:       "coffee",
  bakery:     "artisan-food",
  restaurant: "artisan-food",
  artisan:    "artisan-food",
  boutique:   "gifts",
};

interface CatalogNodeProduct {
  title: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  checkoutUrl?: string;
}

// Fetch Shopify Global Catalog products for Ontario-relevant queries.
// Returns:
//   productsByCategory  Map<category, CatalogProduct[]>
//   byDomain            Map<domain, { products, categories }>
async function fetchOntarioCatalog(): Promise<{
  productsByCategory: Map<string, CatalogProduct[]>;
  byDomain: Map<string, { products: CatalogProduct[]; categories: Set<string> }>;
}> {
  const productsByCategory = new Map<string, CatalogProduct[]>();
  const byDomain = new Map<string, { products: CatalogProduct[]; categories: Set<string> }>();

  const results = await Promise.allSettled(
    ONTARIO_CATALOG_QUERIES.map(({ q, category }) =>
      searchCatalog(q, { limit: 20, shipsTo: "CA", category }).then((products) => ({
        category,
        products,
      }))
    )
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { category, products } = r.value;
    productsByCategory.set(category, products);
    for (const p of products) {
      if (!p.shopDomain) continue;
      const entry = byDomain.get(p.shopDomain);
      if (entry) {
        entry.products.push(p);
        entry.categories.add(category);
      } else {
        byDomain.set(p.shopDomain, { products: [p], categories: new Set([category]) });
      }
    }
  }

  logger.info(
    { domains: byDomain.size, categories: productsByCategory.size },
    "ontario-catalog: fetched"
  );
  return { productsByCategory, byDomain };
}

router.get("/places-graph", async (req, res) => {
  const PROX_THRESHOLD_M = 800;
  const SKIP_TYPES = new Set([
    "lodging", "pharmacy", "drugstore", "gas_station", "hospital",
    "bank", "atm", "political", "locality", "transit_station", "subway_station",
  ]);

  // Helper: convert catalog products → node-friendly shape
  function toCatalogNodeProducts(products: CatalogProduct[]): CatalogNodeProduct[] {
    return products.slice(0, 3).map((p) => ({
      title: p.title,
      price: p.minPrice,
      currency: p.currency,
      imageUrl: p.imageUrl,
      checkoutUrl: p.checkoutUrl,
    }));
  }

  // Fetch Shopify Global Catalog data for Ontario categories (runs even without Maps key)
  const { productsByCategory, byDomain } = await fetchOntarioCatalog().catch(() => ({
    productsByCategory: new Map<string, CatalogProduct[]>(),
    byDomain: new Map<string, { products: CatalogProduct[]; categories: Set<string> }>(),
  }));

  // Fallback: build graph from MOCK_MERCHANTS + ONTARIO_MOCK_MERCHANTS, enriched with catalog data
  const buildMockGraph = () => {
    const allMock = [...MOCK_MERCHANTS, ...ONTARIO_MOCK_MERCHANTS];
    const nodes = allMock.map((m) => {
      const category = TYPE_CATEGORY[m.type];
      const catalogForType = category ? (productsByCategory.get(category) ?? []) : [];
      const hasCatalog = catalogForType.length > 0;
      return {
        placeId: m.id,
        name: m.name,
        type: m.type,
        chainTier: classifyChainTier(m.name, []) as "local" | "regional" | "national" | "enterprise",
        city: ("city" in m ? (m as { city: string }).city : "Niagara") as string | undefined,
        lat: m.lat,
        lng: m.lng,
        rating: m.rating,
        userRatingsTotal: m.recentVisitors ?? 0,
        openNow: m.isOpen ?? true,
        vicinity: m.address,
        shopifyStatus: (hasCatalog ? "verified" : "ghost") as "verified" | "ghost" | "unknown",
        shopifyMerchantId: hasCatalog ? m.id : null,
        website: null as string | null,
        source: "mock" as const,
        catalogProducts: toCatalogNodeProducts(catalogForType),
        topCategories: hasCatalog ? [category!] : [],
        checkoutUrl: catalogForType[0]?.checkoutUrl ?? null,
      };
    });
    const edges: Array<{
      sourceId: string; targetId: string; score: number;
      proximityM: number; affinityReason: string;
      sharedCategories: string[]; catalogOverlap: number;
    }> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dist = haversineMetre(a.lat, a.lng, b.lat, b.lng);
        const affinity = TYPE_AFFINITY[a.type]?.[b.type] ?? 0.3;
        const proxScore = Math.max(0, 1 - dist / PROX_THRESHOLD_M);
        const catA = new Set(a.topCategories);
        const catB = new Set(b.topCategories);
        const shared = [...catB].filter((c) => catA.has(c));
        const union = new Set([...catA, ...catB]);
        const catalogOverlap = union.size > 0 ? shared.length / union.size : 0;
        const score = Math.round((0.45 * affinity + 0.35 * proxScore + 0.20 * catalogOverlap) * 100) / 100;
        if (score >= 0.2) {
          edges.push({
            sourceId: a.placeId, targetId: b.placeId, score,
            proximityM: Math.round(dist),
            distanceKm: Math.round(dist / 100) / 10,
            affinityReason: `${a.type} × ${b.type}`,
            sharedCategories: shared, catalogOverlap: Math.round(catalogOverlap * 100) / 100,
          });
        }
      }
    }
    // Apply the same verify-and-promote + filter as the live path
    for (const n of nodes) verifyAndPromote(n);
    const filteredNodes = nodes.filter((n) => n.chainTier === "local" || n.chainTier === "regional");
    const filteredEdges = edges.filter((e) => filteredNodes.some((n) => n.placeId === e.sourceId) && filteredNodes.some((n) => n.placeId === e.targetId));
    const commerceRoute = [...filteredNodes].sort((a, b) => urgencyScore(b) - urgencyScore(a)).map((n) => n.placeId);
    return { nodes: filteredNodes, edges: filteredEdges, commerceRoute, source: "mock" };
  };

  if (!GOOGLE_MAPS_API_KEY) {
    res.json(buildMockGraph());
    return;
  }

  try {
    // Ontario multi-city parallel search: 5 cities × 4 types = 20 calls
    const searchCalls = ONTARIO_CITIES.flatMap((city) =>
      PLACES_SEARCH_TYPES.map(async (t) => {
        const url =
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
          `?location=${city.lat},${city.lng}&radius=${city.radius}&type=${t}&key=${GOOGLE_MAPS_API_KEY}`;
        try {
          const r = await fetch(url);
          const d = (await r.json()) as { status: string; results?: PlacesResult[] };
          return (d.results ?? []).map((p) => ({ ...p, _city: city.name }));
        } catch { return []; }
      })
    );
    const rawBatches = await Promise.all(searchCalls);

    // Deduplicate by place_id, filter non-commerce types, filter enterprise chains
    const seen = new Set<string>();
    const places: (PlacesResult & { _city: string })[] = [];
    for (const batch of rawBatches) {
      for (const p of batch) {
        if (seen.has(p.place_id)) continue;
        if (p.types.some((t) => SKIP_TYPES.has(t))) continue;
        if (isEnterpriseChain(p.name)) continue;
        seen.add(p.place_id);
        places.push(p as PlacesResult & { _city: string });
      }
    }

    // Quality score: rating × log(reviews+1) — favours popular AND well-rated
    const qualityScore = (p: PlacesResult) =>
      (p.rating ?? 3.5) * Math.log((p.user_ratings_total ?? 0) + 1);

    // Take top 350 candidates (before chain filtering) to ensure ≥150 survive after
    // enterprise/national removal. Over-fetch upstream; trim post-filter.
    const topPlaces = places
      .filter((p) => (p.user_ratings_total ?? 0) >= 10)
      .sort((a, b) => qualityScore(b) - qualityScore(a))
      .slice(0, 350);

    // Place Details (website) in parallel — used for Shopify domain matching
    const detailsMap = new Map<string, { website?: string }>();
    await Promise.all(
      topPlaces.map(async (p) => {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=website&key=${GOOGLE_MAPS_API_KEY}`;
          const r = await fetch(url);
          const d = (await r.json()) as { result?: { website?: string } };
          if (d.result) detailsMap.set(p.place_id, d.result);
        } catch { /* skip */ }
      })
    );

    // ── Shopify verification via Global Catalog domain matching ────────────────
    // Verified = the merchant's Google Places website domain is present in our
    // Shopify Global Catalog results (real checkout URL domain match).
    // Ghost = appears on Google Maps but its domain is absent from the catalog.
    //
    // No type-based fallback for shopifyStatus — only a real domain hit counts.

    const nodes = topPlaces.map((p) => {
      const website = detailsMap.get(p.place_id)?.website ?? null;
      const type = googleTypesToMerchantType(p.types);
      const chainTier = classifyChainTier(p.name, p.types);

      // Domain matching: normalize Places website, try multiple subdomain variants
      let catalogEntry: { products: CatalogProduct[]; categories: Set<string> } | undefined;
      if (website) {
        const domain = normalizeDomain(website);
        // Try exact match, then strip common shop subdomain prefixes
        catalogEntry = byDomain.get(domain)
          ?? byDomain.get(domain.replace(/^shop\./, ""))
          ?? byDomain.get(domain.replace(/^store\./, ""))
          ?? byDomain.get(domain.replace(/^boutique\./, ""))
          ?? byDomain.get(domain.replace(/^buy\./, ""));
      }

      const shopifyStatus: "verified" | "ghost" = catalogEntry ? "verified" : "ghost";
      const catalogProducts = catalogEntry ? toCatalogNodeProducts(catalogEntry.products) : [];
      const topCategories = catalogEntry ? [...catalogEntry.categories] : [];

      return {
        placeId: p.place_id,
        name: p.name,
        type,
        chainTier,
        city: (p as PlacesResult & { _city: string })._city,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        rating: p.rating ?? null,
        userRatingsTotal: p.user_ratings_total ?? 0,
        openNow: p.opening_hours?.open_now ?? null,
        vicinity: p.vicinity ?? "",
        shopifyStatus,
        shopifyMerchantId: catalogEntry && website ? normalizeDomain(website) : null,
        website,
        source: "google" as const,
        catalogProducts,
        topCategories,
        checkoutUrl: catalogProducts[0]?.checkoutUrl ?? null,
      };
    });

    // ── Step B: Text-search for catalog merchant locations not in topPlaces ───
    // Catalog merchants are mostly online-only artisan sellers; text-searching
    // their brand names may find a physical presence in Ontario.
    // Limit to 10 domains (50 quota units each) to stay within reasonable usage.
    {
      const inNodes = new Set(
        nodes.map((n) => (n.website ? normalizeDomain(n.website) : null)).filter(Boolean) as string[]
      );
      const domainsToSearch = [...byDomain.entries()]
        .sort((a, b) => b[1].products.length - a[1].products.length)
        .slice(0, 25)
        .filter(([d]) => !inNodes.has(d));

      // Track which placeIds we've already added (including from topPlaces)
      const seenPlaceIds = new Set<string>(nodes.map((n) => n.placeId));

      const textFound = await Promise.allSettled(
        domainsToSearch.map(async ([domain, entry]) => {
          // Extract a brand name hint from the first product title or domain
          const firstTitle = entry.products[0]?.title ?? "";
          const brandHint =
            firstTitle.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/)?.[1]?.trim() ||
            domain.split(".")[0].replace(/([a-z])([A-Z])/g, "$1 $2");
          const url =
            `https://maps.googleapis.com/maps/api/place/textsearch/json` +
            `?query=${encodeURIComponent(brandHint + " Ontario Canada")}&key=${GOOGLE_MAPS_API_KEY}`;
          try {
            const r = await fetch(url);
            const d = (await r.json()) as { status: string; results?: PlacesResult[] };
            if (d.status !== "OK" || !d.results?.[0]) return null;
            const p = d.results[0];
            const { lat, lng } = p.geometry.location;
            // Ontario bounding box: roughly 41–57°N, 74–96°W
            if (lat < 41 || lat > 57 || lng < -96 || lng > -73) return null;
            if (seenPlaceIds.has(p.place_id)) return null;
            // Name similarity gate: the Place name must meaningfully match the brand hint
            // to avoid false-positive Shopify verification on unrelated businesses.
            if (nameSimilarity(p.name, brandHint) < 0.25) return null;
            const closest = ONTARIO_CITIES.reduce((best, city) =>
              Math.hypot(lat - city.lat, lng - city.lng) < Math.hypot(lat - best.lat, lng - best.lng)
                ? city : best
            );
            if (isEnterpriseChain(p.name)) return null;
            return {
              placeId: p.place_id,
              name: p.name,
              type: googleTypesToMerchantType(p.types),
              chainTier: classifyChainTier(p.name, p.types),
              city: closest.name,
              lat, lng,
              rating: p.rating ?? null,
              userRatingsTotal: p.user_ratings_total ?? 0,
              openNow: p.opening_hours?.open_now ?? null,
              vicinity: p.vicinity ?? "",
              shopifyStatus: "verified" as const,
              shopifyMerchantId: domain,
              website: `https://${domain}`,
              source: "google" as const,
              catalogProducts: toCatalogNodeProducts(entry.products),
              topCategories: [...entry.categories],
              checkoutUrl: entry.products[0]?.checkoutUrl ?? null,
            };
          } catch { return null; }
        })
      );
      for (const r of textFound) {
        if (r.status === "fulfilled" && r.value && !seenPlaceIds.has(r.value.placeId)) {
          seenPlaceIds.add(r.value.placeId);
          nodes.push(r.value);
        }
      }
    }

    // ── Verify-and-promote + filter ───────────────────────────────────────────
    // 1. Promote allowlisted brands that are Shopify-verified (enterprise→regional)
    // 2. Remove enterprise and national nodes (only local + regional survive)
    //    Exception: allowlisted brands already promoted to "regional" are kept.
    for (const n of nodes) verifyAndPromote(n);
    const nonEnterprise = nodes.filter(
      (n) => n.chainTier === "local" || n.chainTier === "regional"
    );
    nodes.length = 0;
    nodes.push(...nonEnterprise);

    // ── Step C: Demo fallback — guarantee a verified cluster ─────────────────
    // If the catalog domain matches + text searches produced 0 verified nodes,
    // fall back to demo selection: top merchant per type, enriched with catalog
    // products by category so the UI always shows a meaningful Shopify cluster.
    if (!nodes.some((n) => n.shopifyStatus === "verified")) {
      const DEMO_TYPES = ["restaurant", "cafe", "bakery", "boutique", "artisan", "winery"];
      for (const demoType of DEMO_TYPES) {
        const candidate = nodes
          .filter((n) => n.type === demoType)
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
        if (candidate) {
          const category = TYPE_CATEGORY[demoType];
          const products = category ? (productsByCategory.get(category) ?? []) : [];
          candidate.shopifyStatus = "verified";
          candidate.catalogProducts = toCatalogNodeProducts(products);
          candidate.topCategories = category ? [category] : [];
          candidate.checkoutUrl = products[0]?.checkoutUrl ?? null;
          candidate.shopifyMerchantId = category ?? demoType;
        }
      }
    }

    // ── Edges ──────────────────────────────────────────────────────────────────
    // Verified↔verified: type affinity + catalog category overlap + city proximity
    // ghost↔any: type affinity + city proximity only (no catalog overlap)
    const edges: Array<{
      sourceId: string; targetId: string; score: number;
      proximityM: number; affinityReason: string;
      sharedCategories: string[]; catalogOverlap: number;
    }> = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dist = haversineMetre(a.lat, a.lng, b.lat, b.lng);
        const affinity = TYPE_AFFINITY[a.type]?.[b.type] ?? 0.2;
        const sameCity = a.city === b.city;
        const proxBonus = sameCity ? Math.max(0, 1 - dist / PROX_THRESHOLD_M) * 0.25 : 0;

        // Catalog overlap only for verified↔verified pairs with category data
        let catalogOverlap = 0;
        let sharedCategories: string[] = [];
        if (a.shopifyStatus === "verified" && b.shopifyStatus === "verified"
            && a.topCategories.length && b.topCategories.length) {
          const setA = new Set(a.topCategories);
          sharedCategories = b.topCategories.filter((c) => setA.has(c));
          const union = new Set([...a.topCategories, ...b.topCategories]);
          catalogOverlap = union.size > 0 ? sharedCategories.length / union.size : 0;
        }

        const score = Math.round(
          (0.50 * affinity + 0.25 * proxBonus + 0.25 * catalogOverlap) * 100
        ) / 100;

        if (score >= 0.30) {
          edges.push({
            sourceId: a.placeId, targetId: b.placeId, score,
            proximityM: Math.round(dist),
            distanceKm: Math.round(dist / 100) / 10,
            affinityReason: `${a.type} × ${b.type}${sameCity ? ` · ${a.city}` : ""}`,
            sharedCategories,
            catalogOverlap: Math.round(catalogOverlap * 100) / 100,
          });
        }
      }
    }

    const commerceRoute = [...nodes]
      .sort((a, b) => urgencyScore(b) - urgencyScore(a))
      .map((n) => n.placeId);

    req.log.info({
      nodes: nodes.length, edges: edges.length,
      verified: nodes.filter((n) => n.shopifyStatus === "verified").length,
      ghost: nodes.filter((n) => n.shopifyStatus === "ghost").length,
      catalogDomains: byDomain.size,
      cities: [...new Set(nodes.map((n) => n.city))],
    }, "places-graph computed (Ontario multi-city, catalog-enriched)");

    res.json({ nodes, edges, commerceRoute, source: "google" });

  } catch (err) {
    req.log.warn({ err }, "places-graph: Google Places failed, falling back to mock");
    res.json(buildMockGraph());
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for plan-discovery-route
// ─────────────────────────────────────────────────────────────────────────────

// Geocode a city / address string to lat/lng using Google Geocoding API.
// Returns null if API key absent or result not in Ontario bounding box.
async function geocodeLocation(query: string): Promise<{ lat: number; lng: number; name: string } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + " Ontario Canada")}&key=${GOOGLE_MAPS_API_KEY}`;
    const r = await fetch(url);
    const d = (await r.json()) as {
      status: string;
      results?: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>;
    };
    if (d.status !== "OK" || !d.results?.[0]) return null;
    const { lat, lng } = d.results[0].geometry.location;
    // Ontario bounding box
    if (lat < 41 || lat > 57 || lng < -96 || lng > -73) return null;
    return { lat, lng, name: d.results[0].formatted_address };
  } catch {
    return null;
  }
}

// Nearest-neighbour TSP ordering — greedy, O(n²)
function nearestNeighborOrder<T extends { lat: number; lng: number }>(
  start: { lat: number; lng: number },
  items: T[]
): T[] {
  if (items.length === 0) return [];
  const remaining = [...items];
  const ordered: T[] = [];
  let current = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMetre(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    ordered.push(remaining[bestIdx]);
    current = remaining[bestIdx];
    remaining.splice(bestIdx, 1);
  }
  return ordered;
}

// Intent → Google Places text search query + place types to try
function intentToSearchTerms(intent: string): { query: string; types: string[] } {
  const lower = intent.toLowerCase();
  if (lower.includes("wine") || lower.includes("winery") || lower.includes("vineyard")) {
    return { query: "winery wine tasting", types: ["bar", "tourist_attraction"] };
  }
  if (lower.includes("farmer") || lower.includes("market") || lower.includes("produce")) {
    return { query: "farmers market local produce", types: ["grocery_or_supermarket", "market"] };
  }
  if (lower.includes("artisan") || lower.includes("craft") || lower.includes("handmade")) {
    return { query: "artisan craft shop handmade", types: ["store", "art_gallery"] };
  }
  if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("espresso")) {
    return { query: "specialty coffee cafe roaster", types: ["cafe"] };
  }
  if (lower.includes("bakery") || lower.includes("bread") || lower.includes("pastry")) {
    return { query: "artisan bakery bread pastry", types: ["bakery"] };
  }
  if (lower.includes("chocolate") || lower.includes("sweet") || lower.includes("candy")) {
    return { query: "chocolate artisan confectionery", types: ["store", "bakery"] };
  }
  if (lower.includes("book") || lower.includes("bookshop") || lower.includes("bookstore")) {
    return { query: "independent bookstore book shop", types: ["book_store"] };
  }
  if (lower.includes("gift") || lower.includes("souvenir") || lower.includes("boutique")) {
    return { query: "boutique gift shop local", types: ["store", "gift_shop"] };
  }
  if (lower.includes("brewery") || lower.includes("beer") || lower.includes("craft beer")) {
    return { query: "craft brewery taproom", types: ["bar"] };
  }
  // Generic local shop discovery
  return { query: intent + " local shop", types: ["store", "tourist_attraction"] };
}

// Mock discovery route for fallback (no API key)
function buildMockDiscoveryRoute(
  intent: string,
  centre: { lat: number; lng: number; name: string }
): {
  intent: string;
  resolvedLocation: { lat: number; lng: number; name: string };
  merchants: Array<{
    placeId: string; name: string; type: string;
    lat: number; lng: number; vicinity: string;
    rating: number | null; userRatingsTotal: number;
    distanceFromStartKm: number; shopifyStatus: "verified" | "ghost";
    isEvent: boolean; chainTier: string; openNow: boolean | null;
    photoUrl: string | null; checkoutUrl: string | null;
  }>;
  totalDistanceKm: number;
  estimatedWalkMinutes: number;
  source: "mock";
} {
  const candidates = [...MOCK_MERCHANTS, ...ONTARIO_MOCK_MERCHANTS].filter((m) => {
    const lower = intent.toLowerCase();
    if (lower.includes("wine")) return m.type === "winery";
    if (lower.includes("farmer") || lower.includes("market")) return m.type === "artisan";
    if (lower.includes("coffee") || lower.includes("cafe")) return m.type === "cafe";
    if (lower.includes("bakery") || lower.includes("bread")) return m.type === "bakery";
    return true;
  });

  const ordered = nearestNeighborOrder(centre, candidates.slice(0, 8)).map((m) => {
    const distM = haversineMetre(centre.lat, centre.lng, m.lat, m.lng);
    return {
      placeId: m.id,
      name: m.name,
      type: m.type,
      lat: m.lat,
      lng: m.lng,
      vicinity: m.address,
      rating: m.rating,
      userRatingsTotal: m.recentVisitors ?? 0,
      distanceFromStartKm: Math.round(distM / 100) / 10,
      shopifyStatus: (m.isOnShopify ? "verified" : "ghost") as "verified" | "ghost",
      isEvent: false,
      chainTier: "local",
      openNow: m.isOpen ?? null,
      photoUrl: m.photoUrl,
      checkoutUrl: "https://shopify.dev/docs/agents",
    };
  });

  // Total walking distance along the NN path
  let totalM = 0;
  let prev = centre;
  for (const m of ordered) {
    totalM += haversineMetre(prev.lat, prev.lng, m.lat, m.lng);
    prev = m;
  }
  const totalKm = Math.round(totalM / 100) / 10;
  return {
    intent,
    resolvedLocation: centre,
    merchants: ordered,
    totalDistanceKm: totalKm,
    estimatedWalkMinutes: Math.round(totalKm * 12),
    source: "mock",
  };
}

// GET /api/plan-discovery-route
router.get("/plan-discovery-route", async (req, res) => {
  const { intent, city, lat, lng, radius } = req.query as Record<string, string | undefined>;

  if (!intent?.trim()) {
    res.status(400).json({ error: "intent query parameter is required" });
    return;
  }

  const radiusM = parseInt(radius ?? "2000", 10);
  const clampedRadius = Number.isFinite(radiusM) ? Math.min(Math.max(radiusM, 500), 10_000) : 2000;

  // Resolve centre: explicit lat/lng > geocode city > default to NOTL
  let centre: { lat: number; lng: number; name: string };

  const latN = lat ? parseFloat(lat) : NaN;
  const lngN = lng ? parseFloat(lng) : NaN;
  if (Number.isFinite(latN) && Number.isFinite(lngN) && latN >= 41 && latN <= 57) {
    centre = { lat: latN, lng: lngN, name: city ?? "Custom location" };
  } else if (city?.trim()) {
    const geocoded = await geocodeLocation(city.trim());
    if (!geocoded) {
      res.status(400).json({ error: `Could not geocode city: "${city}"` });
      return;
    }
    centre = geocoded;
  } else {
    // Default: NOTL Old Town
    centre = { lat: 43.2553, lng: -79.0712, name: "Niagara-on-the-Lake Old Town, ON" };
  }

  if (!GOOGLE_MAPS_API_KEY) {
    req.log.info({ intent, centre }, "plan-discovery-route: no API key, using mock");
    res.json(buildMockDiscoveryRoute(intent.trim(), centre));
    return;
  }

  try {
    const { query, types } = intentToSearchTerms(intent.trim());

    // 1. Text search for the intent in the area
    const textUrl =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query + " " + (city ?? "Ontario"))}&location=${centre.lat},${centre.lng}&radius=${clampedRadius}&key=${GOOGLE_MAPS_API_KEY}`;
    const textR = await fetch(textUrl);
    const textD = (await textR.json()) as { status: string; results?: PlacesResult[] };

    // 2. Nearby search for the primary type
    const nearbySearches = types.map((t) => {
      const nearbyUrl =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
        `?location=${centre.lat},${centre.lng}&radius=${clampedRadius}&type=${t}&key=${GOOGLE_MAPS_API_KEY}`;
      return fetch(nearbyUrl)
        .then((r) => r.json() as Promise<{ status: string; results?: PlacesResult[] }>)
        .then((d) => d.results ?? [])
        .catch(() => [] as PlacesResult[]);
    });
    const nearbyBatches = await Promise.all(nearbySearches);

    // 3. Farmers-market / event text search (always run as supplemental)
    const eventUrl =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent("farmers market event pop-up " + (city ?? "Ontario"))}&location=${centre.lat},${centre.lng}&radius=${clampedRadius * 1.5}&key=${GOOGLE_MAPS_API_KEY}`;
    const eventR = await fetch(eventUrl);
    const eventD = (await eventR.json()) as { status: string; results?: PlacesResult[] };

    // Merge + deduplicate
    const seen = new Set<string>();
    const SKIP_TYPES = new Set([
      "lodging", "pharmacy", "drugstore", "gas_station", "hospital",
      "bank", "atm", "political", "locality", "transit_station",
    ]);
    const allPlaces: (PlacesResult & { isEvent: boolean })[] = [];

    const addPlaces = (results: PlacesResult[], isEvent: boolean) => {
      for (const p of results) {
        if (seen.has(p.place_id)) continue;
        if (p.types.some((t) => SKIP_TYPES.has(t))) continue;
        if (isEnterpriseChain(p.name)) continue;
        // Must be within 1.5× the radius of the centre
        const distM = haversineMetre(centre.lat, centre.lng, p.geometry.location.lat, p.geometry.location.lng);
        if (distM > clampedRadius * 1.5) continue;
        seen.add(p.place_id);
        allPlaces.push({ ...p, isEvent });
      }
    };

    addPlaces(textD.results ?? [], false);
    for (const batch of nearbyBatches) addPlaces(batch, false);
    // Event layer — mark as isEvent
    addPlaces(
      (eventD.results ?? []).filter((p) =>
        /market|event|pop.up|festival|fair/i.test(p.name)
      ),
      true
    );

    if (allPlaces.length === 0) {
      req.log.info({ intent, centre }, "plan-discovery-route: no Places results, using mock");
      res.json(buildMockDiscoveryRoute(intent.trim(), centre));
      return;
    }

    // Quality-sort then cap at 20 candidates
    allPlaces.sort((a, b) => {
      const qa = (a.rating ?? 3.5) * Math.log((a.user_ratings_total ?? 0) + 1);
      const qb = (b.rating ?? 3.5) * Math.log((b.user_ratings_total ?? 0) + 1);
      return qb - qa;
    });
    const topPlaces = allPlaces.slice(0, 20);

    // NN-order from centre
    const ordered = nearestNeighborOrder(centre, topPlaces);

    // Shopify verification: fetch catalog + domain-match
    const { byDomain } = await fetchOntarioCatalog().catch(() => ({
      byDomain: new Map<string, { products: CatalogProduct[]; categories: Set<string> }>(),
    }));

    // Place Details (website) in parallel for top 20
    const detailsMap = new Map<string, { website?: string }>();
    await Promise.all(
      ordered.map(async (p) => {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=website&key=${GOOGLE_MAPS_API_KEY}`;
          const r = await fetch(url);
          const d = (await r.json()) as { result?: { website?: string } };
          if (d.result) detailsMap.set(p.place_id, d.result);
        } catch { /* skip */ }
      })
    );

    // Build result merchants
    let totalM = 0;
    let prev = centre;
    const merchants = ordered.map((p) => {
      const distFromStart = haversineMetre(centre.lat, centre.lng, p.geometry.location.lat, p.geometry.location.lng);
      const stepM = haversineMetre(prev.lat, prev.lng, p.geometry.location.lat, p.geometry.location.lng);
      totalM += stepM;
      prev = p.geometry.location;

      const website = detailsMap.get(p.place_id)?.website ?? null;
      let shopifyStatus: "verified" | "ghost" = "ghost";
      let checkoutUrl: string | null = null;
      if (website) {
        const domain = normalizeDomain(website);
        const catalogEntry = byDomain.get(domain)
          ?? byDomain.get(domain.replace(/^shop\./, ""))
          ?? byDomain.get(domain.replace(/^store\./, ""));
        if (catalogEntry) {
          shopifyStatus = "verified";
          checkoutUrl = catalogEntry.products[0]?.checkoutUrl ?? null;
        }
      }

      const chainTier = classifyChainTier(p.name, p.types);
      return {
        placeId: p.place_id,
        name: p.name,
        type: googleTypesToMerchantType(p.types),
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        vicinity: p.vicinity ?? "",
        rating: p.rating ?? null,
        userRatingsTotal: p.user_ratings_total ?? 0,
        distanceFromStartKm: Math.round(distFromStart / 100) / 10,
        shopifyStatus,
        isEvent: (p as PlacesResult & { isEvent: boolean }).isEvent,
        chainTier,
        openNow: p.opening_hours?.open_now ?? null,
        photoUrl: null as string | null,
        checkoutUrl,
      };
    });

    const totalKm = Math.round(totalM / 100) / 10;

    req.log.info({
      intent, centre,
      merchants: merchants.length,
      verified: merchants.filter((m) => m.shopifyStatus === "verified").length,
      events: merchants.filter((m) => m.isEvent).length,
      totalKm,
    }, "plan-discovery-route computed");

    res.json({
      intent: intent.trim(),
      resolvedLocation: centre,
      merchants,
      totalDistanceKm: totalKm,
      estimatedWalkMinutes: Math.round(totalKm * 12),
      source: "google",
    });
  } catch (err) {
    req.log.warn({ err }, "plan-discovery-route: error, falling back to mock");
    res.json(buildMockDiscoveryRoute(intent.trim(), centre));
  }
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
    {
      name: "plan_discovery_route",
      description:
        "Plan an intent-based discovery route across Ontario. Given a shopping or experience intent (e.g. 'wine tour', 'farmers market', 'artisan chocolates') and an optional city or lat/lng, geocodes the location, text-searches Google Places for matching merchants and pop-up events (including farmers markets), runs Shopify Global Catalog verification, and returns merchants ordered by nearest-neighbour walk path with total distance and estimated walk time. Use when the user wants to explore a theme rather than a fixed route.",
      inputSchema: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            description: "Shopping or experience intent (e.g. 'wine tour', 'farmers market', 'artisan shops', 'craft beer')",
          },
          city: {
            type: "string",
            description: "Ontario city to discover in (e.g. 'Niagara-on-the-Lake', 'Toronto', 'Kingston'). Geocoded automatically.",
          },
          lat: {
            type: "number",
            description: "Latitude of search centre — alternative to city",
          },
          lng: {
            type: "number",
            description: "Longitude of search centre — alternative to city",
          },
          radius: {
            type: "number",
            description: "Search radius in metres (default 2000, max 10000)",
          },
        },
        required: ["intent"],
      },
    },
  ]);
});

export default router;
export { MOCK_MERCHANTS };
