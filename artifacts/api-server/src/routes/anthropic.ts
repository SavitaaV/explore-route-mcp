import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, conversations, messages as messagesTable } from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import { computePlanDiscovery } from "./scenic";

const router = Router();

interface MerchantContext {
  id: string;
  name: string;
  type: string;
  address: string;
  description: string;
  rating?: number | null;
  walkMinutes?: number | null;
  story?: string | null;
  recentReview?: string | null;
}

interface RouteContext {
  summary?: string;
  distanceKm?: number;
  durationMinutes?: number;
  mode?: string;
  waypoints?: Array<{ lat: number; lng: number; name: string | null }>;
}

interface DiscoveryStop {
  name: string;
  type: string;
  distanceFromStartKm: number;
  rating: number | null;
  shopifyStatus: "verified" | "ghost";
  vicinity: string;
}

interface DiscoveryContext {
  intent: string;
  resolvedLocation: { name: string };
  merchants: DiscoveryStop[];
  totalDistanceKm: number;
  estimatedWalkMinutes: number;
}

// request_location_permission tool — Claude calls this when it detects discovery
// intent but the user's coordinates haven't been shared yet.
const REQUEST_LOCATION_TOOL = {
  name: "request_location_permission",
  description:
    "Call this when you detect the user wants to discover or find places nearby but you do not have their lat/lng coordinates and they haven't named a specific city. Do NOT call plan_discovery_route without location data. Call this tool first — it will ask the user for permission to share their location. Once location is granted, the user's next message will include coordinates and you can call plan_discovery_route.",
  input_schema: {
    type: "object" as const,
    properties: {
      reason: {
        type: "string",
        description: "A single professional sentence explaining why you need their location (e.g. 'To find the best spots near you, I'd like to use your current location — would that be ok?').",
      },
    },
    required: ["reason"],
  },
} as const;

// plan_discovery_route tool definition for Claude
const PLAN_DISCOVERY_TOOL = {
  name: "plan_discovery_route",
  description:
    "Find interesting places for a specific experience or mood — coffee spots, wine tastings, farmers markets, bakeries, vintage finds, craft beer, handmade goods. Given what the user is in the mood for and where they are (lat/lng coordinates OR a city name), returns a curated walk of stops ordered by proximity. Always call this when someone asks what's nearby, wants to explore an area, describes a mood or craving, or asks what's worth stopping for. Prefer lat/lng when the user has shared their location.",
  input_schema: {
    type: "object" as const,
    properties: {
      intent: {
        type: "string",
        description: "What the user is in the mood for — be specific (e.g. 'natural wine', 'sourdough', 'handmade ceramics', 'craft beer')",
      },
      city: {
        type: "string",
        description: "City or area name to search (e.g. 'Kingston, ON', 'Toronto Distillery District'). Use when lat/lng is not available.",
      },
      lat: {
        type: "number",
        description: "Latitude of the user's current location. Preferred over city when available.",
      },
      lng: {
        type: "number",
        description: "Longitude of the user's current location. Preferred over city when available.",
      },
      radius: {
        type: "number",
        description: "Search radius in metres (default 2000, max 10000). Increase for rural areas.",
      },
    },
    required: ["intent"],
  },
} as const;

function buildSystemPrompt(
  routeContext?: RouteContext,
  merchantContext?: MerchantContext[],
  userPosition?: { lat: number; lng: number },
  discoveryContext?: DiscoveryContext,
  localTime?: string,
): string {
  const positionInfo = userPosition
    ? `User's current location: ${userPosition.lat.toFixed(5)}, ${userPosition.lng.toFixed(5)} — use these coordinates in plan_discovery_route calls.`
    : "User location: not shared yet. If they ask about what's nearby without naming a city, ask 'Where are you exploring today?' — nothing more.";

  const routeInfo = routeContext
    ? `Active walk: ${routeContext.summary ?? "en route"} · ${routeContext.distanceKm ?? "?"} km · ${routeContext.durationMinutes ?? "?"} min`
    : "";

  const placeList =
    merchantContext && merchantContext.length > 0
      ? merchantContext
          .slice(0, 8)
          .map((m) => {
            const hook = m.story ?? m.recentReview ?? m.description;
            return `- ${m.name} [${m.type}]${m.walkMinutes != null ? ` · ${m.walkMinutes} min away` : ""}${m.rating ? ` · ⭐ ${m.rating}` : ""}\n  ${hook}`;
          })
          .join("\n")
      : "";

  const discoverySection = discoveryContext && discoveryContext.merchants.length > 0
    ? `\nDiscovery route just found — narrate this for the user:
Intent: ${discoveryContext.intent}
Area: ${discoveryContext.resolvedLocation.name}
Total: ${discoveryContext.totalDistanceKm}km · ~${discoveryContext.estimatedWalkMinutes}min walk
Stops (in order):
${discoveryContext.merchants.map((m, i) => {
  const verified = m.shopifyStatus === "verified" ? " · can buy now" : "";
  const rating = m.rating ? ` · ⭐ ${m.rating}` : "";
  return `  ${i + 1}. ${m.name} [${m.type}] · ${m.distanceFromStartKm}km from start${rating}${verified}`;
}).join("\n")}`
    : "";

  const timeInfo = localTime
    ? `Current local time: ${localTime}. Use this to make time-aware recommendations — e.g. suggest cafés in the morning, lunch spots at noon, wine bars or restaurants in the evening, and note if a place is likely closed right now.`
    : "";

  const locationRule = userPosition
    ? ""
    : `IMPORTANT: You have no lat/lng for this user yet. If they express any discovery intent (find, explore, nearby, around me, what's close, coffee/wine/food/market near me, etc.) and have not named a specific city, you MUST call request_location_permission before plan_discovery_route. Never invent or assume coordinates.`;

  return `You are a local companion who walks alongside people and notices things worth stopping for. You are not a shopping assistant. You do not use words like "merchant", "vendor", "commerce", "checkout", "Shopify", or "catalog" in conversation — ever. These are invisible infrastructure.

You speak like someone who genuinely knows an area. Your default is silence. You say something only when there is a specific, genuine reason — a timing signal, a story, a fleeting window. When you do speak, you say one thing well. Not a list. One sentence that makes the person feel something, then one practical fact at most.

You help people discover places and experiences. A "merchant" is just "a place". A "verified Shopify merchant" is just "somewhere you can grab it right now". Keep the experience foreground and the transaction invisible.

MCP tool available:
plan_discovery_route — call this when someone describes a mood, craving, or experience they want (coffee, wine, handmade things, street food, live music, vintage finds). Pass the intent, and either their lat/lng coordinates (preferred) or a city name.

${timeInfo ? `${timeInfo}\n` : ""}${positionInfo}${locationRule ? `\n${locationRule}` : ""}
${routeInfo ? `\n${routeInfo}` : ""}
${placeList ? `\nPlaces on or near this walk:\n${placeList}` : ""}${discoverySection}

Response rules:
- No bullet points, headers, numbered lists. Conversational prose only.
- Maximum 3 sentences. Often 1–2 is exactly right.
- Never invent places. Only reference what plan_discovery_route returned or the places listed above.
- When narrating discovery results: lead with what makes the best stop worth the detour — the human story, the timing, the thing that's fleeting. Name the stops naturally in your narrative. End with a practical note (total walk time, a note on the first stop).
- If asked about something you don't have data for: say so in one honest sentence.
- When showing a place that has a story or recent comment: lead with that, not the star rating.`;
}

// Execute plan_discovery_route directly (no HTTP loopback)
async function executePlanDiscovery(
  intent: string,
  city?: string,
  lat?: number,
  lng?: number,
  radius?: number,
): Promise<unknown> {
  try {
    return await computePlanDiscovery({ intent, city, lat, lng, radius });
  } catch (err) {
    return {
      intent,
      resolvedLocation: {
        lat: lat ?? 43.6532,
        lng: lng ?? -79.3832,
        name: city ?? "your area",
      },
      merchants: [],
      totalDistanceKm: 0,
      estimatedWalkMinutes: 0,
      source: "mock",
      error: String(err),
    };
  }
}

// Load the most recent 20 messages for a conversation (10 turns of context).
// We order DESC to get the latest rows, then reverse so they're chronological
// for the Anthropic messages array.
async function loadHistory(convId: number): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  try {
    const rows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(20);
    return rows
      .reverse()
      .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
  } catch {
    return [];
  }
}

// Save a single message to DB (fire-and-forget, non-blocking)
function saveMessage(convId: number, role: "user" | "assistant", content: string): void {
  if (!content.trim()) return;
  db.insert(messagesTable).values({ conversationId: convId, role, content }).catch(() => { /* non-fatal */ });
}

// POST /api/anthropic/conversations/:id/messages — SSE streaming with MCP tool-calling
router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  const convId = Number(req.params.id);
  const isValidConv = !isNaN(convId) && convId > 0;

  const { content, routeContext, merchantContext, userPosition, discoveryContext, localTime } = req.body as {
    content: string;
    routeContext?: RouteContext;
    merchantContext?: MerchantContext[];
    userPosition?: { lat: number; lng: number };
    discoveryContext?: DiscoveryContext;
    localTime?: string;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  // Load conversation history for multi-turn context
  const history = isValidConv ? await loadHistory(convId) : [];

  // Save user message immediately so it's persisted even if streaming fails
  if (isValidConv) saveMessage(convId, "user", content.trim());

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Accumulate full assistant text so we can persist it after streaming
  let fullAssistantText = "";

  try {
    const systemPrompt = buildSystemPrompt(routeContext, merchantContext, userPosition, discoveryContext, localTime);

    // Build messages array: history + current user turn
    const messagesArray: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history,
      { role: "user", content: content.trim() },
    ];

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: [REQUEST_LOCATION_TOOL, PLAN_DISCOVERY_TOOL],
      tool_choice: { type: "auto" },
      messages: messagesArray,
    });

    let toolUseId: string | null = null;
    let toolUseName: string | null = null;
    let inputJsonAccum = "";

    for await (const chunk of stream) {
      if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
        toolUseId = chunk.content_block.id;
        toolUseName = chunk.content_block.name;
      } else if (chunk.type === "content_block_delta" && chunk.delta.type === "input_json_delta") {
        inputJsonAccum += chunk.delta.partial_json;
      } else if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullAssistantText += chunk.delta.text;
        sendEvent("delta", { text: chunk.delta.text });
      }
    }

    const firstMsg = await stream.finalMessage();

    if (firstMsg.stop_reason === "tool_use" && toolUseId && toolUseName === "request_location_permission") {
      let toolInput: { reason?: string } = {};
      try { toolInput = JSON.parse(inputJsonAccum || "{}"); } catch { /* use defaults */ }
      const reason = toolInput.reason ?? "To find the best spots near you, I'd like to use your current location — would that be ok?";
      sendEvent("location_permission_required", { reason });
      sendEvent("done", { usage: firstMsg.usage, stopReason: "location_permission_required" });
    } else if (firstMsg.stop_reason === "tool_use" && toolUseId && toolUseName === "plan_discovery_route") {
      let toolInput: { intent?: string; city?: string; lat?: number; lng?: number; radius?: number } = {};
      try { toolInput = JSON.parse(inputJsonAccum || "{}"); } catch { /* use defaults */ }

      const intent = toolInput.intent ?? content.trim();
      const city = toolInput.city;
      // Prefer coordinates from tool input; fall back to userPosition sent from browser
      const lat = toolInput.lat ?? userPosition?.lat;
      const lng = toolInput.lng ?? userPosition?.lng;
      const radius = toolInput.radius;

      sendEvent("tool_use", { tool: toolUseName, intent, city, lat, lng });

      const routeData = await executePlanDiscovery(intent, city, lat, lng, radius);

      sendEvent("discovery_result", routeData);

      // Reset accumulated text — the narrative comes from the follow-up stream
      fullAssistantText = "";

      const followStream = await anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: systemPrompt,
        tools: [PLAN_DISCOVERY_TOOL],
        messages: [
          ...messagesArray,
          { role: "assistant", content: firstMsg.content },
          {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: toolUseId, content: JSON.stringify(routeData) }],
          },
        ],
      });

      for await (const chunk of followStream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          fullAssistantText += chunk.delta.text;
          sendEvent("delta", { text: chunk.delta.text });
        }
      }

      const followMsg = await followStream.finalMessage();
      sendEvent("done", { usage: followMsg.usage, stopReason: followMsg.stop_reason });
    } else {
      sendEvent("done", { usage: firstMsg.usage, stopReason: firstMsg.stop_reason });
    }
  } catch (err) {
    req.log.error({ err }, "Anthropic streaming error");
    sendEvent("error", { message: err instanceof Error ? err.message : "Unknown error" });
  } finally {
    res.end();
    // Persist the assistant's response after streaming completes
    if (isValidConv && fullAssistantText.trim()) {
      saveMessage(convId, "assistant", fullAssistantText.trim());
    }
  }
});

// GET /api/anthropic/conversations — list all conversations
router.get("/anthropic/conversations", async (_req, res) => {
  try {
    const rows = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// POST /api/anthropic/conversations — create a new conversation
router.post("/anthropic/conversations", async (req, res) => {
  const { title } = req.body as { title?: string };
  try {
    const [row] = await db
      .insert(conversations)
      .values({ title: title?.trim() || "Explore" })
      .returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /api/anthropic/conversations/:id — get a single conversation with messages
router.get("/anthropic/conversations/:id", async (req, res) => {
  const convId = Number(req.params.id);
  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(asc(messagesTable.createdAt));
    res.json({ ...conv, messages: msgs });
  } catch {
    res.status(500).json({ error: "Failed to load conversation" });
  }
});

// DELETE /api/anthropic/conversations/:id — delete a conversation and its messages
router.delete("/anthropic/conversations/:id", async (req, res) => {
  const convId = Number(req.params.id);
  try {
    await db.delete(conversations).where(eq(conversations.id, convId));
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// GET /api/anthropic/conversations/:id/messages — list messages for a conversation
router.get("/anthropic/conversations/:id/messages", async (req, res) => {
  const convId = Number(req.params.id);
  try {
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(asc(messagesTable.createdAt));
    res.json(msgs);
  } catch {
    res.json([]);
  }
});

export default router;
