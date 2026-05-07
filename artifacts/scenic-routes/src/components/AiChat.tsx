import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MapPin, ShoppingBag, Star, Clock, CheckCircle2, Zap } from "lucide-react";

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
}

interface RouteContext {
  summary?: string;
  distanceKm?: number;
  durationMinutes?: number;
  mode?: string;
  waypoints?: Array<{ lat: number; lng: number; name: string | null }>;
}

type MessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  streaming?: boolean;
  skipSources?: boolean;
  permissionCard?: boolean;
  merchantCard?: Merchant;
  mcpActivated?: boolean;
  journeyCard?: boolean;
}

interface AiChatProps {
  merchants: Merchant[];
  routeContext: RouteContext | null;
  journeyProgress: number;
  journeyStarted: boolean;
  mcpEnabled: boolean;
  onMcpEnable: () => void;
  onStartJourney: () => void;
  userPosition?: { lat: number; lng: number; progress?: number };
  onMerchantFocus?: (merchantId: string) => void;
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

function MerchantCard({ merchant, onFocus }: { merchant: Merchant; onFocus?: (id: string) => void }) {
  return (
    <div
      onClick={() => onFocus?.(merchant.id)}
      style={{
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        cursor: "pointer",
        transition: "box-shadow 0.2s",
        marginTop: 8,
        maxWidth: 240,
      }}
    >
      {merchant.photoUrl && (
        <img
          src={merchant.photoUrl}
          alt={merchant.name}
          style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
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
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 5, lineHeight: 1.4, margin: "5px 0 0" }}>
          {merchant.description.length > 80 ? merchant.description.slice(0, 78) + "…" : merchant.description}
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onFocus?.(merchant.id); }}
            style={{
              flex: 1, padding: "6px 0", borderRadius: 10,
              background: "linear-gradient(135deg, #059669, #34d399)",
              color: "#fff", fontSize: 11, fontWeight: 700,
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            <ShoppingBag style={{ width: 10, height: 10 }} />
            Shop
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFocus?.(merchant.id); }}
            style={{
              flex: 1, padding: "6px 0", borderRadius: 10,
              background: "#f3f4f6", color: "#374151",
              fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            <MapPin style={{ width: 10, height: 10 }} />
            Map
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionCard({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
      border: "1px solid #bbf7d0",
      borderRadius: 16,
      padding: "14px 16px",
      marginTop: 8,
    }}>
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
        Allow Claude to access your route context and surface nearby merchant recommendations via MCP?
      </p>
      <div style={{ fontSize: 10, color: "#047857", marginBottom: 12, lineHeight: 1.6 }}>
        ✓ Only Shopify-verified merchants<br />
        ✓ Turn off recommendations any time<br />
        ✓ No data sold to advertisers
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onEnable}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 12,
            background: "linear-gradient(135deg, #059669, #34d399)",
            color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
          }}
        >
          Enable Explore Route
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: "9px 14px", borderRadius: 12,
            background: "transparent", color: "#6b7280",
            fontSize: 12, border: "1px solid #d1d5db", cursor: "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function McpActivatedCard({ routeContext }: { routeContext: RouteContext | null }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a, #1e293b)",
      border: "1px solid rgba(52,211,153,0.25)",
      borderRadius: 16,
      padding: "14px 16px",
      marginTop: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: 0.5, textTransform: "uppercase" }}>
          Explore Route MCP · Active
        </span>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
        <div>▸ <span style={{ color: "#34d399" }}>get_scenic_route</span>( mode: "walking" )</div>
        <div>▸ <span style={{ color: "#34d399" }}>get_nearby_merchants</span>( radius: 800m )</div>
        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.4)" }}>
          Route: {routeContext?.distanceKm ?? 3.2}km · {routeContext?.durationMinutes ?? 38}min · 8 merchants indexed
        </div>
      </div>
    </div>
  );
}

function JourneyStartCard({ onStart }: { onStart: () => void }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #fefce8, #fef9c3)",
      border: "1px solid #fde68a",
      borderRadius: 16,
      padding: "14px 16px",
      marginTop: 8,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", margin: "0 0 4px" }}>🗺️ Ready to walk?</p>
      <p style={{ fontSize: 11, color: "#78350f", margin: "0 0 12px", lineHeight: 1.5 }}>
        Market Square → Fort George → Waterfront → Shaw Festival → Queen St
        <br />
        <span style={{ fontWeight: 600 }}>~3.2 km · ~38 min</span>
      </p>
      <button
        onClick={onStart}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 12,
          background: "linear-gradient(135deg, #d97706, #f59e0b)",
          color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
        }}
      >
        Begin Walk →
      </button>
    </div>
  );
}

function MessageBubble({ msg, merchants, onFocus, onEnable, onDismiss, onStart, routeContext }: {
  msg: ChatMessage;
  merchants: Merchant[];
  onFocus?: (id: string) => void;
  onEnable?: () => void;
  onDismiss?: () => void;
  onStart?: () => void;
  routeContext: RouteContext | null;
}) {
  const isUser = msg.role === "user";

  return (
    <div style={{ display: "flex", gap: 8, flexDirection: isUser ? "row-reverse" : "row", marginBottom: 12 }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, marginTop: 2,
        }}>
          ✦
        </div>
      )}

      <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
        {msg.content && (
          <div style={{
            padding: "10px 14px",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            background: isUser
              ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
              : "#fff",
            color: isUser ? "#fff" : "#111827",
            fontSize: 13,
            lineHeight: 1.55,
            boxShadow: isUser ? "0 2px 8px rgba(99,102,241,0.25)" : "0 1px 4px rgba(0,0,0,0.08)",
            border: isUser ? "none" : "1px solid #f0f0f0",
            whiteSpace: "pre-wrap",
          }}>
            {msg.content}
            {msg.streaming && (
              <span style={{ display: "inline-block", width: 2, height: 14, background: "currentColor", marginLeft: 2, animation: "pulse 1s infinite", verticalAlign: "text-bottom" }} />
            )}
          </div>
        )}

        {msg.permissionCard && onEnable && onDismiss && (
          <PermissionCard onEnable={onEnable} onDismiss={onDismiss} />
        )}

        {msg.mcpActivated && (
          <McpActivatedCard routeContext={routeContext} />
        )}

        {msg.journeyCard && onStart && (
          <JourneyStartCard onStart={onStart} />
        )}

        {msg.merchantCard && (
          <MerchantCard merchant={msg.merchantCard} onFocus={onFocus} />
        )}
      </div>
    </div>
  );
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "u0",
    role: "user",
    content: "Hey! I'm in Niagara-on-the-Lake today and want to explore Old Town on foot. Any plan?",
    timestamp: new Date(Date.now() - 90000),
  },
  {
    id: "a0",
    role: "assistant",
    content: "Great choice — NOTL Old Town is stunning for a walk, especially along Queen Street and out to Fort George.\n\nI can do more than give you a generic route though. I have access to Explore Route MCP — a tool that:\n\n• Maps a scenic walking loop tailored to Old Town\n• Surfaces nearby independent merchants as you walk (local jam makers, artisan cafés, wineries, boutiques)\n• Syncs your route to Google Maps on your phone or watch\n• Only pings you for genuinely worthwhile stops — not a flood of ads\n\nYou can turn off recommendations any time during the walk. Want to enable it?",
    timestamp: new Date(Date.now() - 85000),
    skipSources: true,
  },
  {
    id: "perm0",
    role: "assistant",
    content: "",
    timestamp: new Date(Date.now() - 84000),
    permissionCard: true,
    skipSources: true,
  },
];

function buildSystemPrompt(routeContext: RouteContext | null, merchants: Merchant[]) {
  const merchantInfo = merchants.length > 0
    ? merchants.slice(0, 8).map((m, i) =>
        `${i + 1}. ${m.name} [${m.type}]${m.rating ? ` ⭐${m.rating}` : ""}${m.walkMinutes != null ? ` (${m.walkMinutes} min walk)` : ""} — ${m.description}`
      ).join("\n")
    : "Greaves Jams, Balzac's Coffee, Treadwell Farm-to-Table, Shaw Festival Shop, Oliv Tasting Room (all on Queen St)";

  return `You are Claude, an AI travel and commerce guide embedded in the Explore Route MCP app — a Shopify-ecosystem tool that surfaces independent merchants to explorers in Niagara-on-the-Lake Old Town.

Active route: ${routeContext?.summary ?? "NOTL Old Town Walking Loop"} — ${routeContext?.distanceKm ?? 3.2}km, ${routeContext?.durationMinutes ?? 38}min walk.

Nearby merchants indexed via MCP:
${merchantInfo}

Your persona:
- Knowledgeable, warm, specific — you know NOTL well
- Reference merchants by name; explain WHY they're worth stopping at
- Not salesy — you surface things that genuinely fit the moment
- Concise: 1-3 short paragraphs max, or a crisp list
- It's early May — strawberry season starting, Shaw Festival just opened
- If asked about a purchase, mention Shopify one-tap checkout is available`;
}

export function AiChat({
  merchants,
  routeContext,
  journeyProgress,
  journeyStarted,
  mcpEnabled,
  onMcpEnable,
  onStartJourney,
  userPosition,
  onMerchantFocus,
}: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const [milestonesFired, setMilestonesFired] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messageCountRef = useRef(INITIAL_MESSAGES.length);

  useEffect(() => {
    // Only auto-scroll when new messages arrive after initial load
    if (messages.length > messageCountRef.current) {
      messageCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // When MCP gets enabled — inject confirmation messages
  useEffect(() => {
    if (!mcpEnabled) return;
    setMessages((prev) => {
      if (prev.some((m) => m.mcpActivated)) return prev;
      return [
        ...prev,
        {
          id: "u1",
          role: "user",
          content: "Yes, enable it!",
          timestamp: new Date(),
          skipSources: true,
        },
        {
          id: "a1",
          role: "assistant",
          content: "Done — Explore Route MCP is live.",
          timestamp: new Date(),
          mcpActivated: true,
          skipSources: true,
        },
        {
          id: "a2",
          role: "assistant",
          content: "I've mapped your walking loop and pinged it to your Google Maps. Starting point: Market Square.\n\nI'll surface a few highlights as you walk — not too often, just the ones worth it. You can ask me to pause recommendations any time by saying \"quiet mode\". Ready when you are 👟",
          timestamp: new Date(),
          skipSources: true,
          journeyCard: true,
        },
      ];
    });
  }, [mcpEnabled]);

  // Journey milestone message injection
  useEffect(() => {
    if (!journeyStarted || !mcpEnabled) return;

    const injectMilestone = (key: string, messages: ChatMessage[]) => {
      setMilestonesFired((prev) => { const s = new Set(prev); s.add(key); return s; });
      setMessages((prev) => [...prev, ...messages]);
    };

    if (journeyProgress >= 0.12 && !milestonesFired.has("m1")) {
      const m = merchants.find((x) => x.id === "greaves-jams") ?? merchants[0];
      if (m) {
        setTimeout(() => injectMilestone("m1", [
          {
            id: "m1a",
            role: "assistant",
            content: "You're 2 minutes into Queen Street — one stop worth making right now:",
            timestamp: new Date(),
            skipSources: true,
          },
          {
            id: "m1b",
            role: "assistant",
            content: "",
            timestamp: new Date(),
            merchantCard: m,
            skipSources: true,
          },
        ]), 400);
      }
    }

    if (journeyProgress >= 0.38 && !milestonesFired.has("m2")) {
      const m = merchants.find((x) => x.id === "shaw-festival-shop") ?? merchants[3];
      if (m) {
        setTimeout(() => injectMilestone("m2", [
          {
            id: "m2a",
            role: "assistant",
            content: "Heading toward Fort George — worth noting: the Shaw Festival Gift Shop is just ahead on your right. Limited-edition theatre prints that aren't tourist-trap stuff. Might be your thing if you like that aesthetic.",
            timestamp: new Date(),
            skipSources: true,
          },
          {
            id: "m2b",
            role: "assistant",
            content: "",
            timestamp: new Date(),
            merchantCard: m,
            skipSources: true,
          },
        ]), 500);
      }
    }

    if (journeyProgress >= 0.62 && !milestonesFired.has("m3")) {
      const m = merchants.find((x) => x.id === "balzacs-coffee") ?? merchants[1];
      if (m) {
        setTimeout(() => injectMilestone("m3", [
          {
            id: "m3a",
            role: "assistant",
            content: "You're past the waterfront — good spot for a mid-walk coffee if you want one:",
            timestamp: new Date(),
            skipSources: true,
          },
          {
            id: "m3b",
            role: "assistant",
            content: "",
            timestamp: new Date(),
            merchantCard: m,
            skipSources: true,
          },
        ]), 300);
      }
    }

    if (journeyProgress >= 0.85 && !milestonesFired.has("m4")) {
      const m = merchants.find((x) => x.id === "oliv-tasting-room") ?? merchants[4];
      if (m) {
        setTimeout(() => injectMilestone("m4", [
          {
            id: "m4a",
            role: "assistant",
            content: "Almost done — one last stop on your way back to Market Square. Unusual one:",
            timestamp: new Date(),
            skipSources: true,
          },
          {
            id: "m4b",
            role: "assistant",
            content: "",
            timestamp: new Date(),
            merchantCard: m,
            skipSources: true,
          },
        ]), 400);
      }
    }

    if (journeyProgress >= 1 && !milestonesFired.has("m5")) {
      setTimeout(() => injectMilestone("m5", [
        {
          id: "m5a",
          role: "assistant",
          content: "Loop complete! 🎉 Back at Market Square.\n\nYou covered 3.2km through NOTL Old Town. Hope the stops were worthwhile — Explore Route MCP will be here whenever you want to explore again.",
          timestamp: new Date(),
          skipSources: true,
        },
      ]), 800);
    }
  }, [journeyProgress, journeyStarted, mcpEnabled, merchants, milestonesFired]);

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
              if (data.text) {
                fullText += data.text;
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullText } : m));
              }
            } catch { /* ignore */ }
          }
        }
      }

      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false, skipSources: false } : m));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, couldn't reach Claude. Please try again.", streaming: false } : m));
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, merchants, routeContext, userPosition]);

  const handleEnable = useCallback(() => {
    onMcpEnable();
  }, [onMcpEnable]);

  const handleDismiss = useCallback(() => {
    setPermissionDismissed(true);
    setMessages((prev) => prev.map((m) => m.permissionCard ? { ...m, permissionCard: false, content: "" } : m));
    setMessages((prev) => [...prev, {
      id: "dismiss1",
      role: "assistant",
      content: "No problem — you can enable it any time by asking me to \"start Explore Route\".",
      timestamp: new Date(),
      skipSources: true,
    }]);
  }, []);

  const suggestedPrompts = mcpEnabled ? [
    "Best bakery on Queen Street?",
    "Any wineries walking distance?",
    "Quiet mode — stop recommendations",
  ] : [
    "What's unique about Greaves Jams?",
    "Tell me about the Shaw Festival",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f5f7" }}>
      {/* App header bar */}
      <div style={{
        padding: "8px 16px 10px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
          ✦
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>Claude</p>
          <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>
            {mcpEnabled ? "Explore Route MCP · Active" : "Explore Route MCP · Standby"}
          </p>
        </div>
        {mcpEnabled && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <CheckCircle2 style={{ width: 10, height: 10, color: "#059669" }} />
            <span style={{ fontSize: 9, color: "#059669", fontWeight: 700, letterSpacing: 0.5 }}>MCP ON</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px" }}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            merchants={merchants}
            onFocus={onMerchantFocus}
            onEnable={handleEnable}
            onDismiss={handleDismiss}
            onStart={onStartJourney}
            routeContext={routeContext}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {!isStreaming && messages.length < 6 && (
        <div style={{ padding: "4px 14px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestedPrompts.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              style={{
                padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                background: "#fff", color: "#374151",
                border: "1px solid #e5e7eb", cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "8px 12px 10px", borderTop: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#f3f4f6", borderRadius: 24,
          padding: "8px 12px 8px 16px",
          border: "1px solid transparent",
          transition: "border-color 0.2s",
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={mcpEnabled ? "Ask about stops, food, shopping…" : "Ask Claude anything…"}
            disabled={isStreaming}
            style={{
              flex: 1, border: "none", background: "transparent",
              fontSize: 13, color: "#111827", outline: "none",
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: input.trim() && !isStreaming ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#e5e7eb",
              border: "none", cursor: input.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <Send style={{ width: 13, height: 13, color: input.trim() && !isStreaming ? "#fff" : "#9ca3af" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
