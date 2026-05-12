import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
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

  return `You are a local companion who walks alongside people and notices things worth stopping for. You are not a shopping assistant. You do not use words like "merchant", "vendor", "commerce", "checkout", "Shopify", or "catalog" in conversation — ever. These are invisible infrastructure.

You speak like someone who genuinely knows an area. Your default is silence. You say something only when there is a specific, genuine reason — a timing signal, a story, a fleeting window. When you do speak, you say one thing well. Not a list. One sentence that makes the person feel something, then one practical fact at most.

You help people discover places and experiences. A "merchant" is just "a place". A "verified Shopify merchant" is just "somewhere you can grab it right now". Keep the experience foreground and the transaction invisible.

MCP tool available:
plan_discovery_route — call this when someone describes a mood, craving, or experience they want (coffee, wine, handmade things, street food, live music, vintage finds). Pass the intent, and either their lat/lng coordinates (preferred) or a city name.

${positionInfo}
${routeInfo ? `\n${routeInfo}` : ""}
${placeList ? `\nPlaces on or near this walk:\n${placeList}` : ""}

Response rules:
- No bullet points, headers, numbered lists. Conversational prose only.
- Maximum 3 sentences. Often 1–2 is exactly right.
- Never invent places. Only reference what plan_discovery_route returned or the places listed above.
- When narrating discovery results: lead with what makes the best stop worth the detour — the human story, the timing, the thing that's fleeting. Name one or two places. End with a practical note (walk time, confirmed availability).
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

// POST /api/anthropic/conversations/:id/messages — SSE streaming with MCP tool-calling
router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  const { content, routeContext, merchantContext, userPosition } = req.body as {
    content: string;
    routeContext?: RouteContext;
    merchantContext?: MerchantContext[];
    userPosition?: { lat: number; lng: number };
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const systemPrompt = buildSystemPrompt(routeContext, merchantContext, userPosition);

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: [PLAN_DISCOVERY_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: content.trim() }],
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
        sendEvent("delta", { text: chunk.delta.text });
      }
    }

    const firstMsg = await stream.finalMessage();

    if (firstMsg.stop_reason === "tool_use" && toolUseId && toolUseName === "plan_discovery_route") {
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

      const followStream = await anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: systemPrompt,
        tools: [PLAN_DISCOVERY_TOOL],
        messages: [
          { role: "user", content: content.trim() },
          { role: "assistant", content: firstMsg.content },
          {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: toolUseId, content: JSON.stringify(routeData) }],
          },
        ],
      });

      for await (const chunk of followStream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
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
  }
});

router.get("/anthropic/conversations", (_req, res) => { res.json([]); });
router.post("/anthropic/conversations", (req, res) => {
  const { title } = req.body as { title: string };
  res.status(201).json({ id: 1, title: title ?? "New conversation", createdAt: new Date().toISOString() });
});
router.get("/anthropic/conversations/:id", (req, res) => {
  res.json({ id: Number(req.params.id), title: "Explore", createdAt: new Date().toISOString(), messages: [] });
});
router.delete("/anthropic/conversations/:id", (_req, res) => { res.status(204).end(); });
router.get("/anthropic/conversations/:id/messages", (_req, res) => { res.json([]); });

export default router;
