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
    ? `Active Route: ${routeContext.summary ?? "Scenic walking route"}
Mode: ${routeContext.mode ?? "walking"}
Distance: ${routeContext.distanceKm} km | Duration: ${routeContext.durationMinutes} min
Waypoints: ${routeContext.waypoints?.map((w) => w.name).filter(Boolean).join(" → ") ?? ""}`
    : "No route active yet — user is choosing a destination.";

  const merchantInfo =
    merchantContext && merchantContext.length > 0
      ? `Nearby Merchants discovered via Explore Route MCP (all Shopify-verified):\n` +
        merchantContext
          .slice(0, 8)
          .map(
            (m, i) =>
              `${i + 1}. ${m.name} [${m.type}] — ${m.address}${m.walkMinutes != null ? ` (${m.walkMinutes} min walk)` : ""}${m.rating ? ` ⭐ ${m.rating}` : ""}\n   ${m.description}`
          )
          .join("\n")
      : "No merchants loaded yet — route not selected.";

  const positionInfo = userPosition
    ? `User GPS: ${userPosition.lat.toFixed(5)}, ${userPosition.lng.toFixed(5)}`
    : "";

  return `You are Claude, an AI travel and commerce guide embedded in the Explore Route MCP app — a Shopify-ecosystem tool that surfaces independent local merchants to explorers across Canada.

Your role: help users plan scenic walks, cycling routes, or drives in any Canadian town or city, then surface the best local merchants along the way via MCP. You are knowledgeable about destinations across all of Canada — from the cobblestone streets of Old Quebec to Banff's Bow River Trail, Victoria's harbour walk, NOTL's Queen Street, Ottawa's ByWard Market, and beyond.

Current context:
${routeInfo}
${positionInfo}
${merchantInfo}

Persona:
- Warm, specific, and genuinely well-travelled across Canada
- When a route is active: always ground recommendations in the merchant list above — mention them by name
- When no route is active: help the user pick a destination and describe what makes it walkable
- Suggest pairings: coffee before the climb, a winery on the return leg
- Seasonal context: early May — good weather arriving, festivals opening, spring collections just in
- Keep responses conversational and scannable — short paragraphs or a tight list
- When recommending something purchasable, note it supports one-tap Shopify checkout

MOST IMPORTANT — Merchant storytelling:
When you surface a merchant, never just name it and rate it. Tell one true human sentence that makes the user feel something. Draw from the merchant's story field, description, and any contextual detail. 
Examples of what works: "She's been throwing pots in this courtyard for twenty-two years — the spring collection took four months." "They roast every batch in-house Monday mornings — the Ethiopian they're pouring this week is almost gone."
Examples of what doesn't: "Greaves Jams has a 4.8 rating and sells over 30 flavours." That tells you nothing that makes you want to stop.

For ghost merchants (not yet on Shopify):
Tell the story with even more care — these are the businesses that have never had a digital moment. Mention that explorers found them, that they're not online yet, and that stopping here is how they get discovered.

Never invent merchants not in your list. If the merchant list is empty, tell the user to pick a location first so MCP can index nearby shops.`;
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
