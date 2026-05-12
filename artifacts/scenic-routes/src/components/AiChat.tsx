import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MapPin, ShoppingBag, Star, Clock, CheckCircle2, Zap, Navigation, Users, Sparkles, Compass, Route, LocateFixed, ChevronDown, ChevronRight, ExternalLink, Ghost, Bookmark, BookmarkCheck, Copy, Check, X, Trash2 } from "lucide-react";

interface Merchant {
  id: string;
  name: string;
  type: string;
  address: string;
  description: string;
  rating?: number | null;
  walkMinutes?: number | null;
  photoUrl?: string | null;
  distanceFromRouteKm?: number | null;
  story?: string | null;
  inventoryConfidence?: number | null;
  recentVisitors?: number | null;
  hoursAgoConfirmed?: number | null;
  isOnShopify?: boolean;
}

interface RouteContext {
  summary?: string;
  distanceKm?: number;
  durationMinutes?: number;
  mode?: string;
  waypoints?: Array<{ lat: number; lng: number; name: string | null }>;
}

interface DiscoveryMerchant {
  placeId: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  vicinity: string;
  rating: number | null;
  shopifyStatus: "verified" | "ghost";
  isEvent: boolean;
  distanceFromStartKm: number;
  checkoutUrl?: string | null;
  openNow?: boolean | null;
  operatingSeason?: string | null;
  upcomingDates?: string[] | null;
  weekdayText?: string[] | null;
}

interface DiscoveryRouteData {
  intent: string;
  resolvedLocation: { lat: number; lng: number; name: string };
  merchants: DiscoveryMerchant[];
  totalDistanceKm: number;
  estimatedWalkMinutes: number;
  source: "google" | "mock";
}

interface DiscoveryProduct {
  id: string;
  title: string;
  price: string;
  imageUrl: string | null;
  checkoutUrl: string;
}

interface SavedRoute {
  id: string;
  savedAt: string;
  route: DiscoveryRouteData;
}

const SAVED_ROUTES_KEY = "explore_saved_routes";

function routeKey(route: DiscoveryRouteData): string {
  return `${route.intent}||${route.resolvedLocation.lat.toFixed(3)}||${route.resolvedLocation.lng.toFixed(3)}`;
}

function loadSavedRoutes(): SavedRoute[] {
  try { return JSON.parse(localStorage.getItem(SAVED_ROUTES_KEY) ?? "[]") as SavedRoute[]; }
  catch { return []; }
}

function persistSavedRoutes(routes: SavedRoute[]): void {
  localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(routes));
}

function buildShareText(route: DiscoveryRouteData): string {
  const verifiedCount = route.merchants.filter((m) => m.shopifyStatus === "verified").length;
  const lines = [
    `📍 ${route.intent}`,
    `📌 ${route.resolvedLocation.name.split(",")[0]}`,
    `🛑 ${route.merchants.length} stops · ${route.totalDistanceKm}km · ~${route.estimatedWalkMinutes}min walk`,
    `✅ ${verifiedCount} Shopify-verified`,
    "",
    ...route.merchants.map((m) => `  ${m.shopifyStatus === "verified" ? "🟢" : "🟡"} ${m.name}`),
    "",
    "Discovered via Explore Route MCP",
  ];
  return lines.join("\n");
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  streaming?: boolean;
  skipSources?: boolean;
  permissionCard?: boolean;
  merchantCard?: Merchant;
  ghostMerchantCard?: Merchant;
  mcpActivated?: boolean;
  journeyCard?: boolean;
  locationCard?: boolean;
  geolocationCard?: boolean;
  discoveryLoadingCard?: { intent: string; city?: string };
  discoveryResultCard?: DiscoveryRouteData;
}

interface AiChatProps {
  merchants: Merchant[];
  routeContext: RouteContext | null;
  journeyProgress: number;
  journeyStarted: boolean;
  mcpEnabled: boolean;
  onMcpEnable: () => void;
  onRouteRequest: (origin: string, dest: string, mode: string) => void;
  onStartJourney: () => void;
  userPosition?: { lat: number; lng: number; progress?: number };
  onMerchantFocus?: (merchantId: string) => void;
  onDiscoveryRequest?: (intent: string, city?: string) => void;
  onDiscoveryResult?: (route: DiscoveryRouteData) => void;
  discoveryRoute?: DiscoveryRouteData | null;
  discoveryLoading?: boolean;
  onRealLocationUpdate?: (lat: number, lng: number) => void;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function getMerchantEmoji(type: string) {
  switch (type) {
    case "winery": return "🍷";
    case "bakery": return "🥐";
    case "cafe": return "☕";
    case "restaurant": return "🍽️";
    case "boutique": return "🛍️";
    case "artisan": return "🫙";
    default: return "🏪";
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} style={{ width: 10, height: 10, fill: s <= Math.round(rating) ? "#F59E0B" : "none", color: s <= Math.round(rating) ? "#F59E0B" : "#d1d5db" }} />
      ))}
      <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginLeft: 2 }}>{rating.toFixed(1)}</span>
    </div>
  );
}

function ConfidenceBadge({ score, visitors, hoursAgo }: { score: number; visitors: number; hoursAgo: number }) {
  const color = score >= 80 ? "#059669" : score >= 60 ? "#d97706" : "#dc2626";
  const bg = score >= 80 ? "#f0fdf4" : score >= 60 ? "#fffbeb" : "#fef2f2";
  const border = score >= 80 ? "#bbf7d0" : score >= 60 ? "#fde68a" : "#fecaca";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 20, background: bg, border: `1px solid ${border}`, marginTop: 6 }}>
      <Users style={{ width: 9, height: 9, color }} />
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{score}% in stock</span>
      <span style={{ fontSize: 9, color: "#9ca3af" }}>· {visitors} visitors · {hoursAgo}h ago</span>
    </div>
  );
}

// ── Shared ProductTile — used by DiscoveryMerchantRow and any merchant card expansion ──
function ProductTile({ product }: { product: DiscoveryProduct }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "#fff", borderRadius: 10, padding: "6px 8px",
      border: "1px solid #e5e7eb",
    }}>
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.title}
          style={{ width: 36, height: 36, borderRadius: 7, objectFit: "cover", flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div style={{ width: 36, height: 36, borderRadius: 7, background: "#f3f4f6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingBag style={{ width: 14, height: 14, color: "#9ca3af" }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#111827", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {product.title}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 10, color: "#059669", fontWeight: 700 }}>{product.price}</p>
      </div>
      <a
        href={product.checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "5px 9px", borderRadius: 8,
          background: "linear-gradient(135deg, #059669, #34d399)",
          color: "#fff", fontSize: 9, fontWeight: 700,
          textDecoration: "none", flexShrink: 0,
          display: "flex", alignItems: "center", gap: 3,
        }}
      >
        <ShoppingBag style={{ width: 8, height: 8 }} /> Buy
      </a>
    </div>
  );
}

function MerchantCard({ merchant, onFocus }: { merchant: Merchant; onFocus?: (id: string) => void }) {
  return (
    <div
      onClick={() => onFocus?.(merchant.id)}
      style={{
        background: "#fff", borderRadius: 16, overflow: "hidden",
        border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        cursor: "pointer", marginTop: 8, maxWidth: 240,
      }}
    >
      {merchant.photoUrl && (
        <img src={merchant.photoUrl} alt={merchant.name} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", lineHeight: 1.3, margin: 0 }}>
              {getMerchantEmoji(merchant.type)} {merchant.name}
            </p>
            {merchant.rating && <StarRating rating={merchant.rating} />}
          </div>
          {merchant.walkMinutes != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
              <Clock style={{ width: 10, height: 10, color: "#6b7280" }} />
              <span style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{merchant.walkMinutes} min</span>
            </div>
          )}
        </div>

        {/* Inventory confidence badge */}
        {merchant.inventoryConfidence != null && merchant.recentVisitors != null && merchant.hoursAgoConfirmed != null && (
          <ConfidenceBadge
            score={merchant.inventoryConfidence}
            visitors={merchant.recentVisitors}
            hoursAgo={merchant.hoursAgoConfirmed}
          />
        )}

        {/* Human story — the key differentiator */}
        {merchant.story ? (
          <p style={{ fontSize: 11, color: "#374151", marginTop: 7, lineHeight: 1.5, fontStyle: "italic", borderLeft: "2px solid #e5e7eb", paddingLeft: 8 }}>
            "{merchant.story}"
          </p>
        ) : (
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>
            {merchant.description.length > 70 ? merchant.description.slice(0, 68) + "…" : merchant.description}
          </p>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button onClick={(e) => { e.stopPropagation(); onFocus?.(merchant.id); }} style={{ flex: 1, padding: "6px 0", borderRadius: 10, background: "linear-gradient(135deg, #059669, #34d399)", color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <ShoppingBag style={{ width: 10, height: 10 }} /> Shop
          </button>
          <button onClick={(e) => { e.stopPropagation(); onFocus?.(merchant.id); }} style={{ flex: 1, padding: "6px 0", borderRadius: 10, background: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <MapPin style={{ width: 10, height: 10 }} /> Map
          </button>
        </div>
      </div>
    </div>
  );
}

function UndiscoveredMerchantCard({ merchant }: { merchant: Merchant }) {
  const [invited, setInvited] = useState(false);
  return (
    <div style={{
      background: "linear-gradient(135deg, #faf5ff, #f3e8ff)",
      borderRadius: 16, overflow: "hidden",
      border: "1px solid #d8b4fe", boxShadow: "0 2px 8px rgba(139,92,246,0.1)",
      marginTop: 8, maxWidth: 240,
    }}>
      {merchant.photoUrl && (
        <div style={{ position: "relative" }}>
          <img src={merchant.photoUrl} alt={merchant.name} style={{ width: "100%", height: 80, objectFit: "cover", display: "block", filter: "brightness(0.85)" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div style={{ position: "absolute", top: 8, left: 8, padding: "2px 8px", borderRadius: 20, background: "rgba(109,40,217,0.85)", display: "flex", alignItems: "center", gap: 4 }}>
            <Sparkles style={{ width: 9, height: 9, color: "#fff" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>UNDISCOVERED</span>
          </div>
        </div>
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#581c87", margin: "0 0 2px" }}>
          🏺 {merchant.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
          <Users style={{ width: 9, height: 9, color: "#7c3aed" }} />
          <span style={{ fontSize: 10, color: "#7c3aed", fontWeight: 600 }}>{merchant.recentVisitors ?? 4} explorers found this · not yet online</span>
        </div>
        {merchant.story && (
          <p style={{ fontSize: 11, color: "#6b21a8", lineHeight: 1.5, fontStyle: "italic", margin: "0 0 10px", borderLeft: "2px solid #d8b4fe", paddingLeft: 8 }}>
            "{merchant.story}"
          </p>
        )}
        <div style={{ fontSize: 10, color: "#7c3aed", marginBottom: 10, lineHeight: 1.5 }}>
          No website, no social media — found by walkers like you. Stopping here gives this business its first digital moment.
        </div>
        {!invited ? (
          <button
            onClick={() => setInvited(true)}
            style={{ width: "100%", padding: "8px 0", borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
          >
            <Sparkles style={{ width: 11, height: 11 }} /> Invite to Shopify
          </button>
        ) : (
          <div style={{ padding: "8px 0", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <CheckCircle2 style={{ width: 12, height: 12, color: "#059669" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>Invite sent — Shopify will reach out</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Discovery intent detection ──────────────────────────────────────────────

// ── DiscoveryLoadingCard ─────────────────────────────────────────────────────
function DiscoveryLoadingCard({ intent, city }: { intent: string; city?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "12px 14px", marginTop: 8, maxWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #059669, #34d399)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Compass style={{ width: 13, height: 13, color: "#fff" }} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#111827" }}>Planning discovery route</p>
          <p style={{ margin: 0, fontSize: 9, color: "#9ca3af" }}>
            {intent}{city ? ` · ${city}` : " · Ontario"}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", opacity: 0.4 + i * 0.3, animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />
        ))}
        <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 4 }}>Searching Google Places + Shopify Catalog…</span>
      </div>
    </div>
  );
}

// ── DiscoveryResultCard ──────────────────────────────────────────────────────

/** Single tappable merchant row inside DiscoveryResultCard */
function DiscoveryMerchantRow({ m, isLast }: { m: DiscoveryMerchant; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<DiscoveryProduct[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleTap = async () => {
    const next = !open;
    setOpen(next);
    // Only fetch products for verified merchants, and only once
    if (next && m.shopifyStatus === "verified" && !products && !loading) {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`${BASE_URL}/api/merchant-card`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantId: m.placeId,
            merchantName: m.name,
            merchantType: m.type,
            shopifyStatus: m.shopifyStatus,
            checkoutUrl: m.checkoutUrl ?? undefined,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { products?: DiscoveryProduct[] };
        setProducts(data.products ?? []);
      } catch {
        setFetchError("Couldn't load products right now");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f3f4f6" }}>
      {/* Tappable row */}
      <div
        onClick={handleTap}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", background: open ? "#fafafa" : "transparent", transition: "background 0.15s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fafafa"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = open ? "#fafafa" : "transparent"; }}
      >
        <span style={{ fontSize: 13, flexShrink: 0 }}>{m.isEvent || m.type === "farmer_market" ? "🎪" : getMerchantEmoji(m.type)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "#9ca3af" }}>{m.distanceFromStartKm}km{m.rating ? ` · ⭐ ${m.rating}` : ""}</span>
            {(m.isEvent || m.type === "farmer_market") && m.operatingSeason && (
              <span style={{ fontSize: 8, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 6, padding: "1px 5px", fontWeight: 600, whiteSpace: "nowrap" }}>
                {m.operatingSeason.includes("Saturday") ? "Saturdays only" : "Seasonal"}
              </span>
            )}
            {m.openNow === true && (
              <span style={{ fontSize: 8, color: "#059669", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "1px 5px", fontWeight: 600 }}>Open</span>
            )}
            {m.openNow === false && (
              <span style={{ fontSize: 8, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "1px 5px", fontWeight: 600 }}>Closed</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {m.shopifyStatus === "verified" ? (
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 style={{ width: 8, height: 8, color: "#059669" }} />
            </div>
          ) : (
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fef3c7", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ghost style={{ width: 7, height: 7, color: "#d97706" }} />
            </div>
          )}
          {open
            ? <ChevronDown style={{ width: 10, height: 10, color: "#9ca3af" }} />
            : <ChevronRight style={{ width: 10, height: 10, color: "#9ca3af" }} />}
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{ padding: "0 12px 10px", background: "#fafafa", borderTop: "1px solid #f3f4f6" }}>
          {/* ── Event / farmers-market details block (shown for all event stops) ── */}
          {(m.isEvent || m.type === "farmer_market") && (
            <div style={{ paddingTop: 8, marginBottom: 8 }}>
              {/* Header badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 11 }}>🎪</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed" }}>
                  {m.type === "farmer_market" ? "Farmers Market" : "Pop-up / Event"}
                </span>
              </div>

              {/* Operating season */}
              {m.operatingSeason && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 5 }}>
                  <Clock style={{ width: 10, height: 10, color: "#7c3aed", marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "#6b21a8", fontWeight: 600 }}>{m.operatingSeason}</span>
                </div>
              )}

              {/* Weekday hours from Place Details:
                  farmer_market → show Sat/Sun lines only (typically open weekends)
                  other events → show up to 3 weekday lines (may operate any day) */}
              {m.weekdayText && m.weekdayText.length > 0 && (
                <div style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.6, marginBottom: 5, paddingLeft: 15 }}>
                  {(m.type === "farmer_market"
                    ? m.weekdayText.filter((l) => /saturday|sunday/i.test(l))
                    : m.weekdayText.slice(0, 3)
                  ).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}

              {/* Upcoming dates pills */}
              {m.upcomingDates && m.upcomingDates.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {m.upcomingDates.map((iso) => {
                    const d = new Date(iso + "T12:00:00");
                    const label = d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
                    return (
                      <span key={iso} style={{
                        fontSize: 9, fontWeight: 700, color: "#7c3aed",
                        background: "#f5f3ff", border: "1px solid #ddd6fe",
                        borderRadius: 8, padding: "2px 7px",
                      }}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Divider before product/ghost section */}
              <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0 0" }} />
            </div>
          )}

          {m.shopifyStatus === "ghost" ? (
            /* Ghost merchant — invite to Shopify */
            <div style={{ paddingTop: m.isEvent || m.type === "farmer_market" ? 0 : 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <Ghost style={{ width: 11, height: 11, color: "#d97706" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e" }}>Not on Shopify yet</span>
              </div>
              <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.5 }}>
                This spot isn't connected to the Shopify catalog — no live inventory, no one-tap checkout.
              </p>
              <a
                href="https://www.shopify.com/start"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  padding: "7px 0", borderRadius: 10,
                  background: "linear-gradient(135deg, #d97706, #f59e0b)",
                  color: "#fff", fontSize: 10, fontWeight: 700, textDecoration: "none",
                }}
              >
                <ExternalLink style={{ width: 10, height: 10 }} /> Claim your store on Shopify
              </a>
            </div>
          ) : loading ? (
            /* Loading products */
            <div style={{ paddingTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #e5e7eb", borderTopColor: "#059669", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 10, color: "#6b7280" }}>Loading products…</span>
            </div>
          ) : fetchError ? (
            /* Error state */
            <p style={{ paddingTop: 8, fontSize: 10, color: "#dc2626", margin: 0 }}>{fetchError}</p>
          ) : products && products.length > 0 ? (
            /* Product tiles — shared ProductTile component */
            <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {products.map((p) => <ProductTile key={p.id} product={p} />)}
            </div>
          ) : products && products.length === 0 ? (
            <p style={{ paddingTop: 8, fontSize: 10, color: "#6b7280", margin: 0 }}>No products listed right now.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

type FilterKey = "all" | "events" | "coffee" | "wine" | "food" | "artisan";

const FILTER_DEFS: { key: FilterKey; label: string; emoji: string }[] = [
  { key: "all",     label: "All",     emoji: "✦"  },
  { key: "events",  label: "Events",  emoji: "🎪" },
  { key: "coffee",  label: "Coffee",  emoji: "☕" },
  { key: "wine",    label: "Wine",    emoji: "🍷" },
  { key: "food",    label: "Food",    emoji: "🥐" },
  { key: "artisan", label: "Artisan", emoji: "🫙" },
];

function matchesFilter(m: DiscoveryMerchant, filter: FilterKey): boolean {
  switch (filter) {
    case "all":     return true;
    case "events":  return m.isEvent || m.type === "farmer_market";
    case "coffee":  return m.type === "cafe";
    case "wine":    return m.type === "winery";
    case "food":    return m.type === "restaurant" || m.type === "bakery";
    case "artisan": return m.type === "artisan" || m.type === "boutique";
  }
}

function DiscoveryResultCard({ route, isSaved, onSave, copied, onShare }: {
  route: DiscoveryRouteData;
  isSaved: boolean;
  onSave: () => void;
  copied: boolean;
  onShare: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const verified = route.merchants.filter((m) => m.shopifyStatus === "verified");
  const events = route.merchants.filter((m) => m.isEvent || m.type === "farmer_market");

  // Only show filter pills for categories that have ≥1 matching merchant
  const availableFilters = FILTER_DEFS.filter((f) =>
    f.key === "all" || route.merchants.some((m) => matchesFilter(m, f.key))
  );

  const filteredMerchants = route.merchants.filter((m) => matchesFilter(m, activeFilter));
  const visibleMerchants = showAll ? filteredMerchants : filteredMerchants.slice(0, 5);

  const handleFilterChange = (key: FilterKey) => {
    setActiveFilter(key);
    setShowAll(false);
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", marginTop: 8, maxWidth: 280 }}>
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Route style={{ width: 12, height: 12, color: "#059669" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#111827", flex: 1 }}>{route.intent}</span>
          {/* Save / Share action buttons */}
          <button
            onClick={onShare}
            aria-label={copied ? "Copied!" : "Copy route summary"}
            title={copied ? "Copied!" : "Copy route summary"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", gap: 3, color: copied ? "#059669" : "#9ca3af", transition: "color 0.15s", borderRadius: 6 }}
          >
            {copied ? <Check style={{ width: 11, height: 11 }} /> : <Copy style={{ width: 11, height: 11 }} />}
            <span style={{ fontSize: 9, fontWeight: 500 }}>{copied ? "Copied" : "Share"}</span>
          </button>
          <button
            onClick={onSave}
            aria-label={isSaved ? "Remove from saved routes" : "Save this route"}
            title={isSaved ? "Remove from saved routes" : "Save this route"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", gap: 3, color: isSaved ? "#6366f1" : "#9ca3af", transition: "color 0.15s", borderRadius: 6 }}
          >
            {isSaved ? <BookmarkCheck style={{ width: 12, height: 12 }} /> : <Bookmark style={{ width: 12, height: 12 }} />}
            <span style={{ fontSize: 9, fontWeight: 500 }}>{isSaved ? "Saved" : "Save"}</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "#6b7280", padding: "2px 6px", borderRadius: 10, background: "#f3f4f6" }}>
            {route.merchants.length} stops
          </span>
          <span style={{ fontSize: 9, color: "#6b7280", padding: "2px 6px", borderRadius: 10, background: "#f3f4f6" }}>
            {route.totalDistanceKm}km · ~{route.estimatedWalkMinutes}min
          </span>
          {verified.length > 0 && (
            <span style={{ fontSize: 9, color: "#059669", padding: "2px 6px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              {verified.length} Shopify verified
            </span>
          )}
          {events.length > 0 && (
            <span style={{ fontSize: 9, color: "#7c3aed", padding: "2px 6px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
              {events.length} event{events.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p style={{ fontSize: 9, color: "#9ca3af", margin: "4px 0 0", lineHeight: 1.4 }}>
          📍 {route.resolvedLocation.name.split(",")[0]}
        </p>
      </div>

      {/* Filter pill strip — only shown when there are 2+ filter options with results */}
      {availableFilters.length > 1 && (
        <div style={{ padding: "7px 10px 5px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
          {availableFilters.map((f) => {
            const active = activeFilter === f.key;
            const isEvent = f.key === "events";
            const activeColor = isEvent ? "#7c3aed" : "#6366f1";
            const activeBg = isEvent ? "#f5f3ff" : "#eef2ff";
            const activeBorder = isEvent ? "#c4b5fd" : "#c7d2fe";
            return (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                aria-pressed={active}
                style={{
                  display: "flex", alignItems: "center", gap: 3,
                  padding: "3px 8px", borderRadius: 20, flexShrink: 0,
                  fontSize: 9, fontWeight: active ? 700 : 500,
                  background: active ? activeBg : "transparent",
                  color: active ? activeColor : "#6b7280",
                  border: `1px solid ${active ? activeBorder : "#e5e7eb"}`,
                  cursor: "pointer", transition: "all 0.12s",
                }}
              >
                <span>{f.emoji}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hint */}
      <p style={{ fontSize: 9, color: "#9ca3af", margin: 0, padding: "5px 12px 3px", fontStyle: "italic" }}>
        {activeFilter === "events"
          ? "Tap a stop to see dates and details"
          : "Tap a stop to see products or details"}
      </p>

      {/* Merchant rows */}
      <div>
        {filteredMerchants.length === 0 ? (
          <p style={{ fontSize: 10, color: "#9ca3af", padding: "8px 12px 10px", margin: 0, textAlign: "center" }}>
            No {activeFilter} stops on this route.
          </p>
        ) : (
          <>
            {visibleMerchants.map((m, i) => (
              <DiscoveryMerchantRow key={m.placeId} m={m} isLast={i === visibleMerchants.length - 1 && !(!showAll && filteredMerchants.length > 5)} />
            ))}
            {filteredMerchants.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                style={{ width: "100%", padding: "7px", fontSize: 10, color: "#6366f1", background: "transparent", border: "none", borderTop: "1px solid #f3f4f6", cursor: "pointer", fontWeight: 600 }}
              >
                {showAll ? "Show fewer stops ↑" : `+${filteredMerchants.length - 5} more stops ↓`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PermissionCard({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, background: "linear-gradient(135deg, #059669, #34d399)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap style={{ width: 13, height: 13, color: "#fff" }} />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", margin: 0 }}>Explore Route MCP</p>
          <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>Connected merchants · your area</p>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#374151", margin: "0 0 10px", lineHeight: 1.6 }}>
        Let me index what's along your walk. I'll only say something when the moment's genuinely right — a timing signal, an inventory signal, a story worth stopping for.
      </p>
      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 12, lineHeight: 1.7 }}>
        ✓ Shopify Catalog — verified inventory, real-time<br />
        ✓ Speaks once per milestone, not a feed<br />
        ✓ Checkout happens right here in the conversation
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEnable} style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "#111827", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
          Enable
        </button>
        <button onClick={onDismiss} style={{ padding: "9px 14px", borderRadius: 10, background: "transparent", color: "#9ca3af", fontSize: 12, border: "1px solid #e5e7eb", cursor: "pointer" }}>
          Not now
        </button>
      </div>
    </div>
  );
}

function McpActivatedCard({ routeContext }: { routeContext: RouteContext | null }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} className="animate-pulse" />
        <span style={{ fontSize: 10, fontWeight: 600, color: "#374151", letterSpacing: 0.3 }}>
          Shopify Catalog connected · {routeContext ? "route indexed" : "loading route…"}
        </span>
      </div>
    </div>
  );
}

function GeolocationCard({
  onGrant,
  onDismiss,
  onCityFallback,
}: {
  onGrant: (lat: number, lng: number) => void;
  onDismiss: () => void;
  onCityFallback: (city: string) => void;
}) {
  const [cityInput, setCityInput] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrant = () => {
    setRequesting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setRequesting(false); onGrant(pos.coords.latitude, pos.coords.longitude); },
      () => { setRequesting(false); setError("Couldn't get your location — try typing a city below."); },
      { timeout: 10000 }
    );
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LocateFixed style={{ width: 13, height: 13, color: "#fff" }} />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", margin: 0 }}>Where are you right now?</p>
          <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>Share your location to find what's nearby</p>
        </div>
      </div>
      {error && <p style={{ fontSize: 11, color: "#dc2626", margin: "0 0 8px", lineHeight: 1.4 }}>{error}</p>}
      <button
        onClick={handleGrant}
        disabled={requesting}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 12,
          background: requesting ? "#e5e7eb" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: requesting ? "#9ca3af" : "#fff", fontSize: 12, fontWeight: 700,
          border: "none", cursor: requesting ? "default" : "pointer",
        }}
      >
        {requesting ? "Getting your location…" : "📍 Use my current location"}
      </button>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && cityInput.trim()) onCityFallback(cityInput.trim()); }}
          placeholder="Or type a city (e.g. Kingston, ON)"
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
            fontSize: 12, color: "#374151", outline: "none", background: "#f9fafb",
          }}
        />
        <button
          onClick={() => cityInput.trim() && onCityFallback(cityInput.trim())}
          disabled={!cityInput.trim()}
          style={{
            padding: "8px 12px", borderRadius: 10, background: cityInput.trim() ? "#111827" : "#e5e7eb",
            color: cityInput.trim() ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600,
            border: "none", cursor: cityInput.trim() ? "pointer" : "default",
          }}
        >Go</button>
      </div>
      <button
        onClick={onDismiss}
        style={{ marginTop: 8, width: "100%", padding: "6px 0", borderRadius: 10, background: "transparent", color: "#9ca3af", fontSize: 11, border: "none", cursor: "pointer" }}
      >
        Maybe later
      </button>
    </div>
  );
}

function JourneyStartCard({ routeContext, onStart }: { routeContext: RouteContext | null; onStart: () => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "12px 14px", marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#111827", margin: "0 0 2px" }}>Route indexed</p>
          <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>
            {routeContext?.distanceKm ?? 3.2} km · {routeContext?.durationMinutes ?? 38} min · 8 merchants indexed
          </p>
        </div>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#059669", padding: "3px 8px", borderRadius: 20, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          Ready
        </div>
      </div>
      <button onClick={onStart} style={{ width: "100%", padding: "9px 0", borderRadius: 10, background: "#111827", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
        Start walk →
      </button>
    </div>
  );
}

function MessageBubble({ msg, merchants, onFocus, onEnable, onDismiss, onLocationSubmit, onStart, routeContext, onGeolocationGrant, onGeolocationDismiss, onCityFallback, savedRouteKeys, copiedKey, onSaveRoute, onShareRoute }: {
  msg: ChatMessage; merchants: Merchant[];
  onFocus?: (id: string) => void;
  onEnable?: () => void; onDismiss?: () => void;
  onLocationSubmit?: (loc: string, mode: string) => void;
  onStart?: () => void; routeContext: RouteContext | null;
  onGeolocationGrant?: (lat: number, lng: number) => void;
  onGeolocationDismiss?: () => void;
  onCityFallback?: (city: string) => void;
  savedRouteKeys?: Set<string>;
  copiedKey?: string | null;
  onSaveRoute?: (route: DiscoveryRouteData) => void;
  onShareRoute?: (route: DiscoveryRouteData) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", gap: 8, flexDirection: isUser ? "row-reverse" : "row", marginBottom: 12 }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginTop: 2 }}>
          ✦
        </div>
      )}
      <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
        {msg.content && (
          <div style={{
            padding: "10px 14px",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            background: isUser ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#fff",
            color: isUser ? "#fff" : "#111827", fontSize: 13, lineHeight: 1.55,
            boxShadow: isUser ? "0 2px 8px rgba(99,102,241,0.25)" : "0 1px 4px rgba(0,0,0,0.08)",
            border: isUser ? "none" : "1px solid #f0f0f0", whiteSpace: "pre-wrap",
          }}>
            {msg.content}
            {msg.streaming && <span style={{ display: "inline-block", width: 2, height: 14, background: "currentColor", marginLeft: 2, animation: "pulse 1s infinite", verticalAlign: "text-bottom" }} />}
          </div>
        )}
        {msg.permissionCard && onEnable && onDismiss && <PermissionCard onEnable={onEnable} onDismiss={onDismiss} />}
        {msg.mcpActivated && <McpActivatedCard routeContext={routeContext} />}
        {msg.geolocationCard && onGeolocationGrant && onGeolocationDismiss && onCityFallback && (
          <GeolocationCard onGrant={onGeolocationGrant} onDismiss={onGeolocationDismiss} onCityFallback={onCityFallback} />
        )}
        {msg.journeyCard && onStart && routeContext && <JourneyStartCard routeContext={routeContext} onStart={onStart} />}
        {msg.merchantCard && <MerchantCard merchant={msg.merchantCard} onFocus={onFocus} />}
        {msg.ghostMerchantCard && <UndiscoveredMerchantCard merchant={msg.ghostMerchantCard} />}
        {msg.discoveryLoadingCard && <DiscoveryLoadingCard intent={msg.discoveryLoadingCard.intent} city={msg.discoveryLoadingCard.city} />}
        {msg.discoveryResultCard && onSaveRoute && onShareRoute && (
          <DiscoveryResultCard
            route={msg.discoveryResultCard}
            isSaved={savedRouteKeys?.has(routeKey(msg.discoveryResultCard)) ?? false}
            onSave={() => onSaveRoute(msg.discoveryResultCard!)}
            copied={copiedKey === routeKey(msg.discoveryResultCard)}
            onShare={() => onShareRoute(msg.discoveryResultCard!)}
          />
        )}
      </div>
    </div>
  );
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "a0",
    role: "assistant",
    content: "Tell me what you're in the mood for — coffee, wine, something handmade, a farmers market, anything. Or ask what's around you and I'll find what's worth stopping for.",
    timestamp: new Date(),
    skipSources: true,
  },
];

const CONVERSATION_STORAGE_KEY = "explore_conversation_id";

export function AiChat({
  merchants, routeContext, journeyProgress, journeyStarted,
  mcpEnabled, onMcpEnable, onRouteRequest, onStartJourney,
  userPosition, onMerchantFocus,
  onDiscoveryRequest, onDiscoveryResult, discoveryRoute, discoveryLoading,
}: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    return [{
      id: "a0",
      role: "assistant" as const,
      content: `${greeting} Jane`,
      timestamp: new Date(),
      skipSources: true,
    }];
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [milestonesFired, setMilestonesFired] = useState<Set<string>>(new Set());
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [realLocation, setRealLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => loadSavedRoutes());
  const [showSaved, setShowSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // conversationId is persisted in localStorage so Claude can pick up where it left off
  const [conversationId, setConversationId] = useState<number | null>(() => {
    const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const conversationIdRef = useRef<number | null>(conversationId);
  const realLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const narrateAbortRef = useRef<AbortController | null>(null);
  const inlineDiscoveryActiveRef = useRef(false);
  const messageCountRef = useRef(INITIAL_MESSAGES.length);
  const prevRouteRef = useRef<RouteContext | null>(null);

  // Keep the ref in sync whenever state changes
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // On mount: ensure we have a valid conversation ID.
  // If a stored ID exists, validate it; if stale/deleted, create a fresh one.
  // If no ID, create one immediately so the first send is always persisted.
  useEffect(() => {
    let cancelled = false;

    const createNew = () =>
      fetch(`${BASE_URL}/api/anthropic/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Explore" }),
      })
        .then((r) => r.json())
        .then((data: { id: number }) => {
          if (cancelled || !data?.id) return;
          localStorage.setItem(CONVERSATION_STORAGE_KEY, String(data.id));
          setConversationId(data.id);
          conversationIdRef.current = data.id;
        })
        .catch(() => { /* non-fatal — falls back to stateless */ });

    const existingId = conversationIdRef.current;
    if (existingId !== null) {
      // Validate the stored ID — it might point to a deleted conversation
      fetch(`${BASE_URL}/api/anthropic/conversations/${existingId}`)
        .then((r) => {
          if (cancelled) return;
          if (r.status === 404) {
            // Stale ID — clear and create a fresh conversation
            localStorage.removeItem(CONVERSATION_STORAGE_KEY);
            conversationIdRef.current = null;
            setConversationId(null);
            void createNew();
          }
        })
        .catch(() => { /* network error — keep existing id, server may be starting up */ });
    } else {
      void createNew();
    }

    return () => { cancelled = true; };
  }, []);
  const prevDiscoveryRef = useRef<string | null>(null);
  const narrationInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length > messageCountRef.current) {
      messageCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);


  // Route context arrived (after user picked location) → inject route confirmation
  useEffect(() => {
    if (!routeContext || prevRouteRef.current === routeContext) return;
    prevRouteRef.current = routeContext;

    // Don't add if route card already there
    setMessages((prev) => {
      if (prev.some((m) => m.journeyCard)) return prev;
      const msgs: ChatMessage[] = [];
      if (pendingLocation) {
        msgs.push({ id: "u-loc", role: "user", content: `Explore ${pendingLocation}`, timestamp: new Date(), skipSources: true });
      }
      msgs.push({
        id: "a-route",
        role: "assistant",
        content: `8 merchants indexed. Ready when you are.`,
        timestamp: new Date(),
        journeyCard: true,
        skipSources: true,
      });
      return [...prev, ...msgs];
    });
  }, [routeContext, pendingLocation]);

  // Journey milestone merchant cards
  useEffect(() => {
    if (!journeyStarted || !mcpEnabled || merchants.length === 0) return;

    const inject = (key: string, newMsgs: ChatMessage[]) => {
      setMilestonesFired((prev) => { const s = new Set(prev); s.add(key); return s; });
      setMessages((prev) => [...prev, ...newMsgs]);
    };

    if (journeyProgress >= 0.12 && !milestonesFired.has("m1") && merchants[0]) {
      const t = Date.now();
      const m = merchants[0];
      const conf = m.inventoryConfidence != null ? Math.round(m.inventoryConfidence) : null;
      const story = m.story ? m.story.split(".")[0] + "." : null;
      const msg = story
        ? `${story}${conf != null ? ` ${conf}% in stock right now.` : ""}`
        : `${m.name} is just off your path${conf != null ? ` — ${conf}% in stock, confirmed recently` : ""}.`;
      setTimeout(() => inject("m1", [
        { id: `m1a-${t}`, role: "assistant", content: msg, timestamp: new Date(), skipSources: true },
        { id: `m1b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: m, skipSources: true },
      ]), 600);
    }
    if (journeyProgress >= 0.38 && !milestonesFired.has("m2") && merchants[2]) {
      const t = Date.now();
      const m = merchants[2];
      const conf = m.inventoryConfidence != null ? Math.round(m.inventoryConfidence) : null;
      const story = m.story ? m.story.split(".")[0] + "." : null;
      const msg = `${story ?? (m.name + " is ahead.")} ${conf != null ? `${conf}% in stock right now.` : ""}`.trim();
      setTimeout(() => inject("m2", [
        { id: `m2a-${t}`, role: "assistant", content: msg, timestamp: new Date(), skipSources: true },
        { id: `m2b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: m, skipSources: true },
      ]), 500);
    }
    if (journeyProgress >= 0.62 && !milestonesFired.has("m3") && merchants[1]) {
      const t = Date.now();
      const m = merchants[1];
      const story = m.story ? m.story.split(".")[0] + "." : m.description.split(".")[0] + ".";
      const msg = `${story}${m.walkMinutes != null ? ` ${m.walkMinutes} min from here.` : ""}`.trim();
      setTimeout(() => inject("m3", [
        { id: `m3a-${t}`, role: "assistant", content: msg, timestamp: new Date(), skipSources: true },
        { id: `m3b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: m, skipSources: true },
      ]), 400);
    }
    // Ghost merchant — undiscovered, no digital presence
    const ghostMerchant = merchants.find((m) => m.isOnShopify === false);
    if (journeyProgress >= 0.70 && !milestonesFired.has("ghost") && ghostMerchant) {
      const t = Date.now();
      const ghostStory = ghostMerchant.story ?? `${ghostMerchant.name} — no website, no listing, found by a handful of explorers. Worth the detour.`;
      setTimeout(() => inject("ghost", [
        { id: `ghost-a-${t}`, role: "assistant", content: ghostStory, timestamp: new Date(), skipSources: true },
        { id: `ghost-b-${t}`, role: "assistant", content: "", timestamp: new Date(), ghostMerchantCard: ghostMerchant, skipSources: true },
      ]), 500);
    }

    if (journeyProgress >= 0.85 && !milestonesFired.has("m4") && merchants[3]) {
      const t = Date.now();
      const m = merchants[3];
      const conf = m.inventoryConfidence != null ? Math.round(m.inventoryConfidence) : null;
      const story = m.story ? m.story.split(".")[0] + "." : m.name;
      const msg = `${story}${conf != null ? ` ${conf}% in stock.` : ""}`.trim();
      setTimeout(() => inject("m4", [
        { id: `m4a-${t}`, role: "assistant", content: msg, timestamp: new Date(), skipSources: true },
        { id: `m4b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: m, skipSources: true },
      ]), 400);
    }
    if (journeyProgress >= 1 && !milestonesFired.has("done")) {
      const t = Date.now();
      const total = merchants.length;
      const verified = merchants.filter((m) => m.isOnShopify !== false).length;
      const ghost = total - verified;
      setTimeout(() => inject("done", [
        { id: `done1-${t}`, role: "assistant", content: `${total} stops along this walk. ${verified} with real-time availability. ${ghost > 0 ? `${ghost} that aren't connected yet — but worth finding.` : ""}`.trim(), timestamp: new Date(), skipSources: true },
      ]), 600);
    }
  }, [journeyProgress, journeyStarted, mcpEnabled, merchants, milestonesFired]);

  // Ref so geolocation handlers can call sendMessage before it appears in the closure chain
  const sendMessageRef = useRef<((text: string, locOverride?: { lat: number; lng: number } | null, cityHint?: string) => Promise<void>) | null>(null);

  const handleGeolocationGrant = useCallback((lat: number, lng: number) => {
    const loc = { lat, lng };
    realLocationRef.current = loc;
    setRealLocation(loc);
    setMessages((prev) => prev.filter((m) => !m.geolocationCard));
    setPendingMessage((prev) => {
      if (prev) {
        const msg = prev;
        setTimeout(() => sendMessageRef.current?.(msg, loc), 50);
      }
      return null;
    });
  }, []);

  const handleGeolocationDismiss = useCallback(() => {
    setMessages((prev) => prev.filter((m) => !m.geolocationCard));
    setPendingMessage(null);
  }, []);

  const handleCityFallback = useCallback((city: string) => {
    setMessages((prev) => prev.filter((m) => !m.geolocationCard));
    setPendingMessage((prev) => {
      const msg = prev ?? `What's worth stopping for in ${city}?`;
      setTimeout(() => sendMessageRef.current?.(msg, null, city), 50);
      return null;
    });
  }, []);

  const savedRouteKeys = new Set(savedRoutes.map((s) => routeKey(s.route)));

  const handleSaveRoute = useCallback((route: DiscoveryRouteData) => {
    const key = routeKey(route);
    setSavedRoutes((prev) => {
      let next: SavedRoute[];
      if (prev.some((s) => routeKey(s.route) === key)) {
        next = prev.filter((s) => routeKey(s.route) !== key);
      } else {
        next = [{ id: `sr-${Date.now()}`, savedAt: new Date().toISOString(), route }, ...prev];
      }
      persistSavedRoutes(next);
      return next;
    });
  }, []);

  const handleShareRoute = useCallback((route: DiscoveryRouteData) => {
    const key = routeKey(route);
    navigator.clipboard.writeText(buildShareText(route)).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => prev === key ? null : prev), 2000);
    }).catch(() => {
      // Clipboard unavailable (insecure context or denied) — no false success state shown
    });
  }, []);

  const handleDeleteSaved = useCallback((id: string) => {
    setSavedRoutes((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persistSavedRoutes(next);
      return next;
    });
  }, []);

  const handleLoadRoute = useCallback((route: DiscoveryRouteData) => {
    setShowSaved(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `reload-${Date.now()}`,
        role: "assistant" as const,
        content: `Here's your saved route — ${route.intent}.`,
        timestamp: new Date(),
        discoveryResultCard: route,
        skipSources: true,
      },
    ]);
    onDiscoveryResult?.(route);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [onDiscoveryResult]);

  const handleEnable = useCallback(() => { onMcpEnable(); }, [onMcpEnable]);
  const handleDismiss = useCallback(() => {
    setMessages((prev) => [
      ...prev.filter((m) => !m.permissionCard),
      { id: "dismiss1", role: "assistant", content: "Sure — just ask me anything when you're ready.", timestamp: new Date(), skipSources: true },
    ]);
  }, []);

  // Stream a Claude narration for the discovery route via SSE (uses own abort ref, doesn't block user input)
  const streamDiscoveryNarration = useCallback(async (route: DiscoveryRouteData, routeKey?: string) => {
    // Skip if already narrating this exact route
    if (routeKey && narrationInFlightRef.current === routeKey) return;

    narrateAbortRef.current?.abort();
    narrateAbortRef.current = new AbortController();

    if (routeKey) narrationInFlightRef.current = routeKey;

    let narrativeMsgId: string | null = null;
    let fullText = "";

    const narrativePrompt = `Narrate this ${route.intent} route for me — what should I know before I go?`;

    try {
      // Ensure a conversation exists — create one lazily if mount effect hasn't finished yet
      let convId = conversationIdRef.current;
      if (!convId) {
        try {
          const r = await fetch(`${BASE_URL}/api/anthropic/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Explore" }),
          });
          const data = (await r.json()) as { id: number };
          if (data?.id) {
            localStorage.setItem(CONVERSATION_STORAGE_KEY, String(data.id));
            setConversationId(data.id);
            conversationIdRef.current = data.id;
            convId = data.id;
          }
        } catch { /* non-fatal */ }
      }
      const res = await fetch(`${BASE_URL}/api/anthropic/conversations/${convId ?? 0}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: narrateAbortRef.current.signal,
        body: JSON.stringify({
          content: narrativePrompt,
          routeContext,
          merchantContext: merchants.map((m) => ({ id: m.id, name: m.name, type: m.type, address: m.address, description: m.description, rating: m.rating, walkMinutes: m.walkMinutes })),
          userPosition,
          discoveryContext: route,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const rawData = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (currentEventType === "delta" || currentEventType === "") {
                const text = (rawData as { text?: string }).text;
                if (text) {
                  fullText += text;
                  if (!narrativeMsgId) {
                    narrativeMsgId = `dn-${Date.now()}`;
                    const id = narrativeMsgId;
                    setMessages((prev) => [
                      ...prev,
                      { id, role: "assistant" as const, content: fullText, timestamp: new Date(), streaming: true },
                    ]);
                  } else {
                    const id = narrativeMsgId;
                    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: fullText } : m));
                  }
                }
              }
            } catch { /* ignore malformed SSE data */ }
          } else if (line === "") {
            currentEventType = "";
          }
        }
      }

      if (narrativeMsgId) {
        const id = narrativeMsgId;
        setMessages((prev) => prev.map((m) => m.id === id ? { ...m, streaming: false } : m));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError" && narrativeMsgId) {
        const id = narrativeMsgId;
        setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: fullText || "…", streaming: false } : m));
      }
    } finally {
      if (routeKey && narrationInFlightRef.current === routeKey) {
        narrationInFlightRef.current = null;
      }
    }
  }, [routeContext, merchants, userPosition]);

  // Discovery route prop changed → replace loading card, then auto-stream Claude narration
  // Skip narration when the inline sendMessage tool-call path already has a follow-up stream running
  useEffect(() => {
    if (!discoveryRoute) return;

    // Deduplicate by stable key (intent + location name) rather than object identity,
    // so parent re-renders with the same data don't re-trigger narration
    const routeKey = `${discoveryRoute.intent}:${discoveryRoute.resolvedLocation.name}`;
    if (routeKey === prevDiscoveryRef.current) {
      setMessages((prev) => [
        ...prev,
        {
          id: `dup-route-${Date.now()}`,
          role: "assistant" as const,
          content: "You already have that route loaded — want me to suggest something different? Try asking for a different neighbourhood, vibe, or type of stop.",
          timestamp: new Date(),
          skipSources: true,
        },
      ]);
      return;
    }
    prevDiscoveryRef.current = routeKey;

    const route = discoveryRoute;

    setMessages((prev) => {
      // Replace the loading card (if present) with the result card
      const idx = [...prev].reverse().findIndex((m) => m.discoveryLoadingCard);
      if (idx === -1) {
        return [
          ...prev,
          {
            id: `dr-card-${Date.now()}`,
            role: "assistant" as const,
            content: "",
            timestamp: new Date(),
            discoveryResultCard: route as DiscoveryRouteData,
            skipSources: true,
          },
        ];
      }
      const realIdx = prev.length - 1 - idx;
      const updated = [...prev];
      updated[realIdx] = {
        ...updated[realIdx],
        discoveryLoadingCard: undefined,
        content: "",
        discoveryResultCard: route as DiscoveryRouteData,
        skipSources: true,
      };
      return updated;
    });

    // Auto-stream Claude's narrative — but skip if sendMessage already produced a follow-up
    // stream for this route (inlineDiscoveryActiveRef prevents duplicate narration),
    // or if a narration for this same route key is already in-flight
    if (inlineDiscoveryActiveRef.current) return;
    if (narrationInFlightRef.current === routeKey) return;

    const timer = setTimeout(() => {
      streamDiscoveryNarration(route, routeKey);
    }, 300);

    return () => clearTimeout(timer);
  }, [discoveryRoute, streamDiscoveryNarration]);



  const sendMessage = useCallback(async (text?: string, locOverride?: { lat: number; lng: number } | null, cityHint?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;
    setInput("");

    // Effective location: explicit override → browser geolocation → simulated journey position
    const effectiveLoc: { lat: number; lng: number } | null =
      locOverride !== undefined ? locOverride
      : realLocationRef.current ?? (userPosition ? { lat: userPosition.lat, lng: userPosition.lng } : null);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    let narrativeMsgId: string | null = null;
    let fullText = "";

    try {
      // Ensure a conversation exists — create one lazily if mount effect hasn't finished yet
      let convId = conversationIdRef.current;
      if (!convId) {
        try {
          const r = await fetch(`${BASE_URL}/api/anthropic/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Explore" }),
          });
          const data = (await r.json()) as { id: number };
          if (data?.id) {
            localStorage.setItem(CONVERSATION_STORAGE_KEY, String(data.id));
            setConversationId(data.id);
            conversationIdRef.current = data.id;
            convId = data.id;
          }
        } catch { /* non-fatal — proceed without persistence */ }
      }
      const res = await fetch(`${BASE_URL}/api/anthropic/conversations/${convId ?? 0}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          content: cityHint ? `${content} (location hint: ${cityHint})` : content,
          routeContext,
          merchantContext: merchants.map((m) => ({ id: m.id, name: m.name, type: m.type, address: m.address, description: m.description, rating: m.rating, walkMinutes: m.walkMinutes })),
          userPosition: effectiveLoc ?? userPosition,
          localTime: (() => {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const fmt = new Intl.DateTimeFormat("en-CA", {
              timeZone: tz, weekday: "short", year: "numeric", month: "short",
              day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
            });
            return `${fmt.format(new Date())} (${tz})`;
          })(),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const rawData = JSON.parse(line.slice(6)) as Record<string, unknown>;

              if (currentEventType === "tool_use") {
                // Claude is invoking plan_discovery_route — show loading card with parsed intent/city
                const loadingIntent = (rawData.intent as string | undefined) ?? (rawData.tool as string | undefined) ?? "discovery route";
                const loadingCity = rawData.city as string | undefined;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `dl-${Date.now()}`,
                    role: "assistant" as const,
                    content: "",
                    timestamp: new Date(),
                    discoveryLoadingCard: { intent: loadingIntent, city: loadingCity },
                    skipSources: true,
                  },
                ]);
              } else if (currentEventType === "discovery_result") {
                // Tool executed — swap loading card with result card, update map
                // Mark that inline discovery is active so the discoveryRoute prop useEffect
                // skips auto-narration (the followStream below will narrate instead)
                inlineDiscoveryActiveRef.current = true;
                const routeData = rawData as unknown as DiscoveryRouteData;
                setMessages((prev) => {
                  const revIdx = [...prev].reverse().findIndex((m) => m.discoveryLoadingCard);
                  const resultCard: ChatMessage = {
                    id: `dr-${Date.now()}`,
                    role: "assistant" as const,
                    content: "",
                    timestamp: new Date(),
                    discoveryResultCard: routeData,
                    skipSources: true,
                  };
                  if (revIdx < 0) return [...prev, resultCard];
                  const realIdx = prev.length - 1 - revIdx;
                  const updated = [...prev];
                  updated.splice(realIdx, 1, resultCard);
                  return updated;
                });
                onDiscoveryResult?.(routeData);
              } else if (currentEventType === "location_permission_required") {
                // Claude detected discovery intent but has no location — show permission card
                const reason = (rawData.reason as string | undefined)
                  ?? "To find the best spots near you, I'd like to use your current location — would that be ok?";
                setPendingMessage(content);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `geo-${Date.now()}`,
                    role: "assistant" as const,
                    content: reason,
                    timestamp: new Date(),
                    geolocationCard: true,
                    skipSources: true,
                  },
                ]);
              } else if (currentEventType === "delta" || currentEventType === "") {
                const text = (rawData as { text?: string }).text;
                if (text) {
                  fullText += text;
                  if (!narrativeMsgId) {
                    narrativeMsgId = `a-${Date.now()}`;
                    const id = narrativeMsgId;
                    setMessages((prev) => [
                      ...prev,
                      { id, role: "assistant" as const, content: fullText, timestamp: new Date(), streaming: true, skipSources: true },
                    ]);
                  } else {
                    const id = narrativeMsgId;
                    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: fullText } : m));
                  }
                }
              }
            } catch { /* ignore malformed SSE data */ }
          } else if (line === "") {
            currentEventType = "";
          }
        }
      }

      if (narrativeMsgId) {
        const id = narrativeMsgId;
        setMessages((prev) => prev.map((m) => m.id === id ? { ...m, streaming: false, skipSources: false } : m));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        if (narrativeMsgId) {
          const id = narrativeMsgId;
          setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: "Sorry, couldn't reach Claude. Try again.", streaming: false } : m));
        } else {
          setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant" as const, content: "Sorry, couldn't reach Claude. Try again.", timestamp: new Date() }]);
        }
      }
    } finally {
      setIsStreaming(false);
      // Allow auto-narration again for future externally-supplied routes
      inlineDiscoveryActiveRef.current = false;
    }
  }, [input, isStreaming, merchants, routeContext, userPosition, onDiscoveryResult, realLocation]);

  // Keep ref updated so geolocation handlers can call it before it's in their closure
  sendMessageRef.current = sendMessage;

  const hasRoute = !!routeContext;
  const suggestedPrompts = hasRoute
    ? ["What's running low today?", "Any hidden gems nearby?", "What's worth stopping for right now?"]
    : ["What's around me?", "Find me a coffee spot", "What's happening this weekend?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f5f7" }}>
      {/* Header — Shopify-style agent identity bar */}
      <div style={{ padding: "10px 16px 10px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: -0.1 }}>Claude</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {savedRoutes.length > 0 && (
            <button
              onClick={() => setShowSaved((v) => !v)}
              title="Saved routes"
              style={{
                display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 20,
                background: showSaved ? "#eef2ff" : "#f9fafb",
                border: `1px solid ${showSaved ? "#c7d2fe" : "#e5e7eb"}`,
                cursor: "pointer",
              }}
            >
              <Bookmark style={{ width: 9, height: 9, color: showSaved ? "#6366f1" : "#6b7280" }} />
              <span style={{ fontSize: 9, color: showSaved ? "#6366f1" : "#6b7280", fontWeight: 600 }}>{savedRoutes.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved routes drawer — appears below header when bookmark chip is clicked */}
      {showSaved && (
        <div style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 4px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#374151", letterSpacing: 0.2 }}>Saved routes</span>
            <button onClick={() => setShowSaved(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <X style={{ width: 11, height: 11, color: "#9ca3af" }} />
            </button>
          </div>
          {savedRoutes.length === 0 ? (
            <p style={{ fontSize: 10, color: "#9ca3af", padding: "4px 14px 10px", margin: 0 }}>No saved routes yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 8px 8px" }}>
              {savedRoutes.map((saved) => {
                const verifiedCount = saved.route.merchants.filter((m) => m.shopifyStatus === "verified").length;
                const savedDate = new Date(saved.savedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
                return (
                  <div key={saved.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 10, border: "1px solid #f3f4f6", padding: "7px 10px" }}>
                    <BookmarkCheck style={{ width: 10, height: 10, color: "#6366f1", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{saved.route.intent}</p>
                      <p style={{ margin: 0, fontSize: 9, color: "#9ca3af" }}>
                        {saved.route.resolvedLocation.name.split(",")[0]} · {saved.route.merchants.length} stops · {verifiedCount} verified · {savedDate}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadRoute(saved.route)}
                      style={{ fontSize: 9, fontWeight: 600, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, padding: "3px 7px", cursor: "pointer", flexShrink: 0 }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(saved.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}
                      title="Remove"
                    >
                      <Trash2 style={{ width: 10, height: 10, color: "#d1d5db" }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px" }}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id} msg={msg} merchants={merchants}
            onFocus={onMerchantFocus} onEnable={handleEnable} onDismiss={handleDismiss}
            onLocationSubmit={() => {}} onStart={onStartJourney} routeContext={routeContext}
            onGeolocationGrant={handleGeolocationGrant}
            onGeolocationDismiss={handleGeolocationDismiss}
            onCityFallback={handleCityFallback}
            savedRouteKeys={savedRouteKeys}
            copiedKey={copiedKey}
            onSaveRoute={handleSaveRoute}
            onShareRoute={handleShareRoute}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts — Shopify-style quick action chips */}
      {!isStreaming && (
        <div style={{ padding: "6px 14px 8px", display: "flex", flexWrap: "wrap", gap: 5 }}>
          {suggestedPrompts.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              style={{
                padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                background: "#fff", color: "#374151",
                border: "1px solid #e5e7eb", cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#a5b4fc"; (e.currentTarget as HTMLButtonElement).style.background = "#faf5ff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input — Shopify-style agent input with animated send */}
      <div style={{ padding: "6px 12px 12px", borderTop: "1px solid #f3f4f6", background: "#fff", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#f9fafb", borderRadius: 26,
          padding: "8px 8px 8px 16px",
          border: "1px solid #e5e7eb",
          transition: "border-color 0.15s",
        }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            onFocus={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = "#a5b4fc"; }}
            onBlur={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = "#e5e7eb"; }}
            placeholder="Ask what's nearby, what to do, or where to go…"
            disabled={isStreaming}
            style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "#111827", outline: "none" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: input.trim() && !isStreaming ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#e5e7eb",
              border: "none", cursor: input.trim() && !isStreaming ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s, transform 0.1s",
              flexShrink: 0,
            }}
            onMouseDown={(e) => { if (input.trim()) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            <Send style={{ width: 13, height: 13, color: input.trim() && !isStreaming ? "#fff" : "#9ca3af" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
