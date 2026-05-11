import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MapPin, ShoppingBag, Star, Clock, CheckCircle2, Zap, Navigation, Users, Sparkles } from "lucide-react";

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
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// v1 is locked to Niagara-on-the-Lake Old Town
const NOTL_ORIGIN = "Market Square, Niagara-on-the-Lake, ON";
const NOTL_DESTINATION = "Fort George National Historic Site, Niagara-on-the-Lake, ON";

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

function PermissionCard({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0", borderRadius: 16, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #059669, #34d399)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap style={{ width: 16, height: 16, color: "#fff" }} />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#065f46", margin: 0 }}>Explore Route MCP</p>
          <p style={{ fontSize: 10, color: "#047857", margin: 0 }}>Agentic commerce · Shopify-verified</p>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#065f46", margin: "0 0 12px", lineHeight: 1.5 }}>
        Allow Claude to access route context and surface Shopify-verified merchants along the NOTL Old Town walking loop via MCP?
      </p>
      <div style={{ fontSize: 10, color: "#047857", marginBottom: 12, lineHeight: 1.6 }}>
        ✓ Only Shopify-verified merchants on the route<br />
        ✓ Inventory confidence scores, real stories<br />
        ✓ Quiet by default — nudges only when worth it
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEnable} style={{ flex: 1, padding: "9px 0", borderRadius: 12, background: "linear-gradient(135deg, #059669, #34d399)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
          Enable Explore Route
        </button>
        <button onClick={onDismiss} style={{ padding: "9px 14px", borderRadius: 12, background: "transparent", color: "#6b7280", fontSize: 12, border: "1px solid #d1d5db", cursor: "pointer" }}>
          Not now
        </button>
      </div>
    </div>
  );
}

function McpActivatedCard({ routeContext }: { routeContext: RouteContext | null }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 16, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: 0.5, textTransform: "uppercase" }}>Explore Route MCP · Active</span>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
        <div>▸ <span style={{ color: "#34d399" }}>get_scenic_route</span>( mode: "{routeContext?.mode ?? "walking"}" )</div>
        <div>▸ <span style={{ color: "#34d399" }}>get_nearby_merchants</span>( radius: 800m )</div>
        {routeContext && (
          <div style={{ marginTop: 6, color: "rgba(255,255,255,0.4)" }}>
            Route: {routeContext.distanceKm}km · {routeContext.durationMinutes}min · merchants indexed
          </div>
        )}
      </div>
    </div>
  );
}

function LocationCard({ onSubmit }: { onSubmit: (location: string, mode: string) => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Navigation style={{ width: 13, height: 13, color: "#6366f1" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Niagara-on-the-Lake Old Town</span>
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>
        Market Square → Fort George · 3.2 km · ~38 min walk
      </p>
      <button
        onClick={() => onSubmit(NOTL_ORIGIN, "walking")}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 12,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
        }}
      >
        🗺️ Load the NOTL route →
      </button>
    </div>
  );
}

function JourneyStartCard({ routeContext, onStart }: { routeContext: RouteContext | null; onStart: () => void }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #fefce8, #fef9c3)", border: "1px solid #fde68a", borderRadius: 16, padding: "14px 16px", marginTop: 8 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", margin: "0 0 4px" }}>🗺️ Route mapped — ready to walk?</p>
      {routeContext && (
        <p style={{ fontSize: 11, color: "#78350f", margin: "0 0 4px", lineHeight: 1.5 }}>
          {routeContext.summary}
        </p>
      )}
      <p style={{ fontSize: 11, color: "#92400e", margin: "0 0 12px", fontWeight: 600 }}>
        {routeContext?.distanceKm}km · {routeContext?.durationMinutes} min {routeContext?.mode ?? "walk"}
      </p>
      <button onClick={onStart} style={{ width: "100%", padding: "10px 0", borderRadius: 12, background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
        Begin {routeContext?.mode === "bicycling" ? "Ride" : "Walk"} →
      </button>
    </div>
  );
}

function MessageBubble({ msg, merchants, onFocus, onEnable, onDismiss, onLocationSubmit, onStart, routeContext }: {
  msg: ChatMessage; merchants: Merchant[];
  onFocus?: (id: string) => void;
  onEnable?: () => void; onDismiss?: () => void;
  onLocationSubmit?: (loc: string, mode: string) => void;
  onStart?: () => void; routeContext: RouteContext | null;
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
        {msg.locationCard && onLocationSubmit && <LocationCard onSubmit={onLocationSubmit} />}
        {msg.journeyCard && onStart && routeContext && <JourneyStartCard routeContext={routeContext} onStart={onStart} />}
        {msg.merchantCard && <MerchantCard merchant={msg.merchantCard} onFocus={onFocus} />}
        {msg.ghostMerchantCard && <UndiscoveredMerchantCard merchant={msg.ghostMerchantCard} />}
      </div>
    </div>
  );
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "a0",
    role: "assistant",
    content: "This is a prototype demonstrating Shopify's agentic commerce primitives — set in Niagara-on-the-Lake Old Town.\n\nI can walk you through 8 merchants on a real 3.2 km loop: Queen Street artisans, Balzac's, Treadwell, Peller Estates. Inventory confidence scores, human stories, and one business not yet on Shopify.\n\nEnable Explore Route MCP to begin.",
    timestamp: new Date(),
    skipSources: true,
  },
  {
    id: "perm0",
    role: "assistant",
    content: "",
    timestamp: new Date(),
    permissionCard: true,
    skipSources: true,
  },
];

export function AiChat({
  merchants, routeContext, journeyProgress, journeyStarted,
  mcpEnabled, onMcpEnable, onRouteRequest, onStartJourney,
  userPosition, onMerchantFocus,
}: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [milestonesFired, setMilestonesFired] = useState<Set<string>>(new Set());
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messageCountRef = useRef(INITIAL_MESSAGES.length);
  const prevRouteRef = useRef<RouteContext | null>(null);

  useEffect(() => {
    if (messages.length > messageCountRef.current) {
      messageCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // MCP just enabled → inject confirmation + location picker
  useEffect(() => {
    if (!mcpEnabled) return;
    setMessages((prev) => {
      if (prev.some((m) => m.mcpActivated)) return prev;
      return [
        ...prev,
        { id: "a1", role: "assistant", content: "MCP enabled. Load the route to begin — I'll index the merchants along the loop and surface them as you walk.", timestamp: new Date(), mcpActivated: true, skipSources: true },
        { id: "loc0", role: "assistant", content: "", timestamp: new Date(), locationCard: true, skipSources: true },
      ];
    });
  }, [mcpEnabled]);

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
        content: `Mapped it. Here's your ${routeContext.mode ?? "walking"} route in ${routeContext.summary?.split(" ").slice(-2).join(" ") ?? "this area"} — ${routeContext.distanceKm}km, about ${routeContext.durationMinutes} minutes. I've indexed nearby merchants along the way. I'll surface the best ones as you go — not too often. Ready when you are.`,
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
      setTimeout(() => inject("m1", [
        { id: `m1a-${t}`, role: "assistant", content: "You're just getting started — one right on your path:", timestamp: new Date(), skipSources: true },
        { id: `m1b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: merchants[0], skipSources: true },
      ]), 400);
    }
    if (journeyProgress >= 0.38 && !milestonesFired.has("m2") && merchants[2]) {
      const t = Date.now();
      setTimeout(() => inject("m2", [
        { id: `m2a-${t}`, role: "assistant", content: "Coming up ahead — worth a quick stop:", timestamp: new Date(), skipSources: true },
        { id: `m2b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: merchants[2], skipSources: true },
      ]), 400);
    }
    if (journeyProgress >= 0.62 && !milestonesFired.has("m3") && merchants[1]) {
      const t = Date.now();
      setTimeout(() => inject("m3", [
        { id: `m3a-${t}`, role: "assistant", content: "Good moment for a break if you want one:", timestamp: new Date(), skipSources: true },
        { id: `m3b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: merchants[1], skipSources: true },
      ]), 300);
    }
    // Ghost merchant — the undiscovered digital twin milestone
    const ghostMerchant = merchants.find((m) => m.isOnShopify === false);
    if (journeyProgress >= 0.70 && !milestonesFired.has("ghost") && ghostMerchant) {
      const t = Date.now();
      setTimeout(() => inject("ghost", [
        { id: `ghost-a-${t}`, role: "assistant", content: "⚡ Something unusual — explorers found a business this week that has no digital presence at all. No Google listing, no website:", timestamp: new Date(), skipSources: true },
        { id: `ghost-b-${t}`, role: "assistant", content: "", timestamp: new Date(), ghostMerchantCard: ghostMerchant, skipSources: true },
      ]), 500);
    }

    if (journeyProgress >= 0.85 && !milestonesFired.has("m4") && merchants[3]) {
      const t = Date.now();
      setTimeout(() => inject("m4", [
        { id: `m4a-${t}`, role: "assistant", content: "Almost done — one last stop on the way back:", timestamp: new Date(), skipSources: true },
        { id: `m4b-${t}`, role: "assistant", content: "", timestamp: new Date(), merchantCard: merchants[3], skipSources: true },
      ]), 400);
    }
    if (journeyProgress >= 1 && !milestonesFired.has("done")) {
      const t = Date.now();
      setTimeout(() => inject("done", [
        { id: `done1-${t}`, role: "assistant", content: "Loop complete! 🎉 Hope the walk was worthwhile.\n\nWant to explore another spot? Just say where and I'll map a new route.", timestamp: new Date(), skipSources: true },
      ]), 800);
    }
  }, [journeyProgress, journeyStarted, mcpEnabled, merchants, milestonesFired]);

  const handleLocationSubmit = useCallback((_location: string, mode: string) => {
    // v1 is locked to NOTL — always load the same loop
    setPendingLocation("Niagara-on-the-Lake Old Town");
    setMessages((prev) => prev.map((m) => m.locationCard ? { ...m, locationCard: false } : m));
    setMessages((prev) => [...prev, {
      id: "a-loading",
      role: "assistant",
      content: "Mapping the NOTL Old Town walking loop…",
      timestamp: new Date(),
      skipSources: true,
    }]);
    onRouteRequest(NOTL_ORIGIN, NOTL_DESTINATION, mode);
  }, [onRouteRequest]);

  const handleEnable = useCallback(() => { onMcpEnable(); }, [onMcpEnable]);
  const handleDismiss = useCallback(() => {
    setMessages((prev) => [
      ...prev.filter((m) => !m.permissionCard),
      { id: "dismiss1", role: "assistant", content: "No worries — you can enable Explore Route any time by asking me.", timestamp: new Date(), skipSources: true },
    ]);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;
    setInput("");

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date(), streaming: true, skipSources: true }]);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${BASE_URL}/api/anthropic/conversations/1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          content,
          routeContext,
          merchantContext: merchants.map((m) => ({ id: m.id, name: m.name, type: m.type, address: m.address, description: m.description, rating: m.rating, walkMinutes: m.walkMinutes })),
          userPosition,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as { text?: string };
              if (data.text) { fullText += data.text; setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullText } : m)); }
            } catch { /* ignore */ }
          }
        }
      }
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false, skipSources: false } : m));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, couldn't reach Claude. Try again.", streaming: false } : m));
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, merchants, routeContext, userPosition]);

  const hasRoute = !!routeContext;
  const suggestedPrompts = hasRoute
    ? ["What's the best stop on this route?", "Tell me about the winery", "Which merchant has the best story?"]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f5f7" }}>
      {/* Header — Shopify-style agent identity bar */}
      <div style={{ padding: "10px 16px 10px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: -0.1 }}>Claude</p>
          <p style={{ margin: 0, fontSize: 10, color: "#9ca3af" }}>
            {mcpEnabled ? "Explore Route MCP · active" : "Explore Route MCP · Standby"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {mcpEnabled ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#059669" }} className="animate-pulse" />
              <span style={{ fontSize: 9, color: "#059669", fontWeight: 700, letterSpacing: 0.5 }}>MCP ON</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#d1d5db" }} />
              <span style={{ fontSize: 9, color: "#9ca3af", fontWeight: 600, letterSpacing: 0.5 }}>STANDBY</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px" }}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id} msg={msg} merchants={merchants}
            onFocus={onMerchantFocus} onEnable={handleEnable} onDismiss={handleDismiss}
            onLocationSubmit={handleLocationSubmit} onStart={onStartJourney} routeContext={routeContext}
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
            placeholder={mcpEnabled ? (hasRoute ? "Ask about stops, food, shopping…" : "Where would you like to explore?") : "Ask Claude anything…"}
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
