import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

interface MerchantContext {
  id: string;
  name: string;
  type: string;
  address: string;
  description: string;
  rating?: number | null;
  walkMinutes?: number | null;
}

interface RouteContext {
  summary?: string;
  distanceKm?: number;
  durationMinutes?: number;
  mode?: string;
  waypoints?: Array<{ lat: number; lng: number; name: string | null }>;
}

function buildSystemPrompt(
  routeContext?: RouteContext,
  merchantContext?: MerchantContext[],
  userPosition?: { lat: number; lng: number }
): string {
  const routeInfo = routeContext
    ? `
Current Route: ${routeContext.summary ?? "NOTL Old Town Walking Loop"}
Mode: ${routeContext.mode ?? "walking"}
Distance: ${routeContext.distanceKm ?? 3.2} km | Duration: ${routeContext.durationMinutes ?? 38} min
Waypoints: ${routeContext.waypoints?.map((w) => w.name).filter(Boolean).join(" → ") ?? "Market Square → Fort George → Waterfront → Queen St"}
`
    : "Route: Niagara-on-the-Lake Old Town Walking Loop (~3.2km, ~38 min)";

  const merchantInfo =
    merchantContext && merchantContext.length > 0
      ? `\nNearby Merchants (MCP Discovery — Shopify-linked):\n` +
        merchantContext
          .slice(0, 8)
          .map(
            (m, i) =>
              `${i + 1}. ${m.name} [${m.type}] — ${m.address}${m.walkMinutes != null ? ` (${m.walkMinutes} min walk)` : ""}${m.rating ? ` ⭐ ${m.rating}` : ""}\n   ${m.description}`
          )
          .join("\n")
      : "\nNearby Merchants: Greaves Jams, Balzac's Coffee, Treadwell Farm-to-Table, Shaw Festival Shop, Oliv Tasting Room, Niagara Home Bakery (all on/near Queen St)";

  const positionInfo = userPosition
    ? `\nUser's current GPS position: ${userPosition.lat.toFixed(5)}, ${userPosition.lng.toFixed(5)}`
    : "";

  return `You are a knowledgeable, enthusiastic local guide for Niagara-on-the-Lake (NOTL), Ontario — helping a visitor discover the best of this UNESCO-recognized historic town while on a scenic walking loop through Old Town.

You have real-time context from the MCP (Model Context Protocol) tools: the active route data and nearby merchants are fed directly to you. Always ground your recommendations in this merchant list.

${routeInfo}${positionInfo}${merchantInfo}

Your persona:
- Warm, specific, and genuinely excited about NOTL's food, wine, and heritage scene
- Give concrete recommendations tied to the merchants above (mention them by name)
- Suggest pairings: e.g. "grab a coffee at Balzac's before the Fort George walk" 
- Note seasonal highlights (NOTL has peak season May–Oct with Shaw Festival running)
- Keep responses conversational and scannable — use short paragraphs, occasionally a short list
- When recommending something available for purchase, mention it can be bought instantly (one-tap Shopify checkout)
- If asked about the route, reference specific waypoints
- Today's date context: early May — strawberry season starts soon, Shaw Festival just opened

Never make up merchants not in your list. If asked about something outside your context, be honest and helpful anyway.`;
}

// POST /api/anthropic/conversations/:id/messages — SSE streaming
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

  // SSE headers
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
      messages: [{ role: "user", content: content.trim() }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        sendEvent("delta", { text: chunk.delta.text });
      }
    }

    const finalMessage = await stream.finalMessage();
    sendEvent("done", {
      usage: finalMessage.usage,
      stopReason: finalMessage.stop_reason,
    });
  } catch (err) {
    req.log.error({ err }, "Anthropic streaming error");
    sendEvent("error", { message: err instanceof Error ? err.message : "Unknown error" });
  } finally {
    res.end();
  }
});

// Stub GET /api/anthropic/conversations (for OpenAPI conformance)
router.get("/anthropic/conversations", (_req, res) => {
  res.json([]);
});

// Stub POST /api/anthropic/conversations
router.post("/anthropic/conversations", (req, res) => {
  const { title } = req.body as { title: string };
  res.status(201).json({ id: 1, title: title ?? "New conversation", createdAt: new Date().toISOString() });
});

// Stub GET /api/anthropic/conversations/:id
router.get("/anthropic/conversations/:id", (req, res) => {
  res.json({ id: Number(req.params.id), title: "NOTL Journey", createdAt: new Date().toISOString(), messages: [] });
});

// Stub DELETE /api/anthropic/conversations/:id
router.delete("/anthropic/conversations/:id", (_req, res) => {
  res.status(204).end();
});

// Stub GET /api/anthropic/conversations/:id/messages
router.get("/anthropic/conversations/:id/messages", (_req, res) => {
  res.json([]);
});

export default router;
