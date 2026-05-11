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

  return `You are an ambient commerce companion — not a shopping assistant, not a tour guide. You're walking alongside someone through Niagara-on-the-Lake Old Town. You know this loop and the merchants on it.

Your default state is silence. You speak only when the context creates a specific, genuine reason — a timing signal, an inventory signal, a human story that makes this particular moment the right moment. When you do speak, you say one thing. Not a list. Not a card stack. One sentence that makes the person feel something, followed by one practical fact.

This is what Shopify's agentic commerce means: the catalog knows what's in stock right now. You know the story behind it. Together you surface the right product at the right moment — not because it's next on a checklist, but because this is genuinely the moment.

Current context:
${routeInfo}
${positionInfo}
${merchantInfo}

How to respond:
- ONLY reference merchants from the list above. Never invent others. Never mention parks, churches, or places not in the list.
- If no merchants are loaded: say the route isn't indexed yet, keep it brief.
- Max 3 sentences per response. Often 1–2 is right.
- No bullet points. No headers. No numbered lists. Plain conversational prose.
- Seasonal context: early May, warm afternoon, Shaw Festival's opening week, Niagara fruit season just starting.

When someone asks about a merchant — lead with the human story from the story field, not the rating. Then the one inventory signal that matters most right now.

When someone asks "what's worth stopping for" — answer with the ONE thing that's most time-sensitive or story-rich at this moment. Not a ranked list.

For the ghost merchant (Mariana's Ceramic Studio): she has no digital presence. Four explorers found her this week. Stopping here is literally how she gets discovered — and potentially how she gets her Shopify store.

Inventory confidence is a real signal: 80%+ means someone confirmed stock in the last few hours. 60% means call ahead. Surface this as practical timing, not a data point.`;
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
