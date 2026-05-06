import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Sparkles, ShoppingBag, MapPin } from "lucide-react";

interface Merchant {
  id: string;
  name: string;
  type: string;
  address: string;
  description: string;
  rating?: number | null;
  walkMinutes?: number | null;
  photoUrl?: string | null;
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
  sources?: string[];
  streaming?: boolean;
  skipSources?: boolean;
}

interface AiChatProps {
  merchants: Merchant[];
  routeContext: RouteContext | null;
  journeyStarted: boolean;
  userPosition?: { lat: number; lng: number };
  onMerchantFocus?: (merchantId: string) => void;
}

const SUGGESTED_PROMPTS = [
  "What should I grab before heading to Fort George?",
  "Best coffee stop on Queen Street?",
  "Where can I buy local jam to take home?",
  "What's unique about NOTL's food scene?",
];

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function extractMentionedMerchants(text: string, merchants: Merchant[]): string[] {
  const mentioned: string[] = [];
  for (const m of merchants) {
    const shortName = m.name.split(" ").slice(0, 2).join(" ");
    if (text.toLowerCase().includes(shortName.toLowerCase())) {
      mentioned.push(m.id);
    }
  }
  return mentioned;
}

function SourceBadge({ merchants, mentionedIds, onFocus }: {
  merchants: Merchant[];
  mentionedIds: string[];
  onFocus?: (id: string) => void;
}) {
  const mentioned = merchants.filter((m) => mentionedIds.includes(m.id));
  if (!mentioned.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {mentioned.map((m) => (
        <button
          key={m.id}
          onClick={() => onFocus?.(m.id)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
        >
          <MapPin className="w-2.5 h-2.5" />
          {m.name.split(" ").slice(0, 3).join(" ")}
          {m.walkMinutes != null && (
            <span className="text-muted-foreground ml-0.5">{m.walkMinutes}m</span>
          )}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ msg, merchants, onFocus }: {
  msg: ChatMessage;
  merchants: Merchant[];
  onFocus?: (id: string) => void;
}) {
  const isUser = msg.role === "user";
  const mentionedIds = isUser || msg.skipSources ? [] : extractMentionedMerchants(msg.content, merchants);

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex-none w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
        isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      <div className={`max-w-[85%] space-y-1.5 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border text-foreground rounded-tl-sm"
        }`}>
          {msg.streaming && !msg.content ? (
            <span className="inline-flex gap-0.5 items-center">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
            </span>
          ) : (
            <span className="whitespace-pre-wrap">{msg.content}{msg.streaming && <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />}</span>
          )}
        </div>

        {!isUser && !msg.streaming && mentionedIds.length > 0 && (
          <div className="px-1">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-medium">Sources via MCP</p>
            <SourceBadge merchants={merchants} mentionedIds={mentionedIds} onFocus={onFocus} />
          </div>
        )}
      </div>
    </div>
  );
}

export function AiChat({ merchants, routeContext, journeyStarted, userPosition, onMerchantFocus }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Welcome to Niagara-on-the-Lake! I'm your AI guide for this walking tour of Old Town.\n\nAsk me anything — where to grab coffee, what to buy, hidden gems on Queen Street, or what to see at Fort George. Hit "Start Walk" to begin your journey and I'll suggest what to explore first.`,
      timestamp: new Date(),
      skipSources: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (journeyStarted && messages.length === 1) {
      setTimeout(() => sendMessage("I just started the walking loop — what should I explore first?"), 1200);
    }
  }, [journeyStarted]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);
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
          merchantContext: merchants.map((m) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            address: m.address,
            description: m.description,
            rating: m.rating,
            walkMinutes: m.walkMinutes,
          })),
          userPosition,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: delta")) continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as { text?: string };
              if (data.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + data.text }
                      : m
                  )
                );
              }
            } catch {}
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, I couldn't reach the AI. Please try again.", streaming: false }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, merchants, routeContext, userPosition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">NOTL AI Guide</p>
            <p className="text-[10px] text-muted-foreground">Powered by Claude · MCP-grounded</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{merchants.length} merchants</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-border">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            merchants={merchants}
            onFocus={onMerchantFocus}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts — only show when idle */}
      {messages.length <= 2 && !isStreaming && (
        <div className="flex-none px-4 pb-3 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-primary/40 transition-colors text-left leading-tight"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex-none px-4 pb-4 pt-2 border-t border-border bg-card/60">
        <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2 focus-within:border-primary/60 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about stops, food, shopping…"
            disabled={isStreaming}
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Grounded in real MCP merchant data · <ShoppingBag className="w-2.5 h-2.5 inline" /> One-tap Shopify checkout
        </p>
      </div>
    </div>
  );
}
