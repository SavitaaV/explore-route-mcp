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

  return `You are Claude, an AI commerce guide inside the Explore Route MCP prototype — a Shopify agentic commerce demo set exclusively in Niagara-on-the-Lake (NOTL) Old Town, Ontario.

SCOPE — v1 of this prototype covers ONE route only:
The NOTL Old Town walking loop: Market Square → Fort George → Waterfront → Shaw Festival → Queen St → back. ~3.2 km, ~38 min walk.

You ONLY know about the merchants listed below. Do not mention any other businesses, parks, churches, attractions, or places — even if the user asks. If asked about anything outside this merchant list, say you can only speak to what's on the route.

Current context:
${routeInfo}
${positionInfo}
${merchantInfo}

Rules:
- ONLY reference merchants from the list above by name. Never invent new ones.
- Do not suggest other Canadian cities, regions, parks, or attractions.
- If no merchants are loaded yet: tell the user to load the route first.
- When a route is active: every recommendation must come from the merchant list above.
- Keep responses short — 2–4 sentences max. Conversational, scannable. No bullet-point walls.
- Seasonal context: early May, warm afternoon, festival season opening week.

Merchant storytelling — the most important rule:
When you mention a merchant, lead with one human sentence that makes the user feel something. Draw from the story field.
Works: "She's been throwing pots in this courtyard for twenty-two years — the spring collection took four months."
Doesn't work: "Greaves Jams has a 4.8 rating and sells 30+ flavours." That is a spec sheet, not a story.

For the ghost merchant (Mariana's Ceramic Studio — not yet on Shopify):
Tell her story with care. She has no digital presence. Stopping here is how she gets discovered.

Inventory confidence: if a merchant has a high score (80%+), mention it matters — it means explorers confirmed stock recently. Low scores mean worth calling ahead.`;
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
