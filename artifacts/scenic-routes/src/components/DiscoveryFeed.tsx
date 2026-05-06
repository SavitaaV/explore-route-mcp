import { useEffect, useRef } from "react";
import { Star, ExternalLink, ShoppingBag, MapPin, Clock } from "lucide-react";
import type { FeedEvent } from "@/pages/home";

type Merchant = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address: string;
  rating: number | null;
  distanceFromRouteKm: number | null;
  photoUrl: string | null;
  description: string;
  isOpen: boolean | null;
};

type MerchantCard = {
  merchant: Merchant;
  products: Array<{
    id: string;
    title: string;
    price: string;
    imageUrl: string | null;
    checkoutUrl: string;
  }>;
  checkoutUrl: string;
  hapticDistance: number;
};

interface DiscoveryFeedProps {
  events: FeedEvent[];
  merchants: Merchant[];
  merchantCard: MerchantCard | null;
  cardLoading: boolean;
  onPinClick: (id: string) => void;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  const stars = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3 h-3 ${s <= stars ? "star-filled fill-current" : "star-empty"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    winery: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    bakery: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    brewery: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    cafe: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    artisan: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${colors[type] ?? "bg-muted text-muted-foreground"}`}>
      {type}
    </span>
  );
}

function MerchantCardDisplay({ card, loading }: { card: MerchantCard | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-slide-in">
        <div className="space-y-3 animate-pulse">
          <div className="h-32 rounded-lg bg-muted" />
          <div className="h-4 rounded bg-muted w-3/4" />
          <div className="h-3 rounded bg-muted w-1/2" />
          <div className="h-3 rounded bg-muted w-full" />
        </div>
      </div>
    );
  }

  if (!card) return null;

  const { merchant, products, checkoutUrl } = card;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-slide-in shadow-md">
      {/* Photo */}
      {merchant.photoUrl && (
        <div className="h-36 overflow-hidden relative">
          <img
            src={merchant.photoUrl}
            alt={merchant.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <TypeBadge type={merchant.type} />
          </div>
          {merchant.isOpen !== null && (
            <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${merchant.isOpen ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${merchant.isOpen ? "bg-white" : "bg-white/70"}`} />
              {merchant.isOpen ? "Open" : "Closed"}
            </div>
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-foreground leading-tight">{merchant.name}</h3>
          {!merchant.photoUrl && <TypeBadge type={merchant.type} />}
        </div>

        <StarRating rating={merchant.rating} />

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-none" />
          <span className="truncate">{merchant.address}</span>
        </div>

        {merchant.distanceFromRouteKm !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 flex-none" />
            <span>{merchant.distanceFromRouteKm}km from route</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">{merchant.description}</p>

        {/* Products */}
        {products.length > 0 && (
          <div className="border-t border-border pt-2 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Featured Products
            </p>
            {products.slice(0, 2).map((p) => (
              <a
                key={p.id}
                href={p.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`product-link-${p.id}`}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/60 hover:bg-muted transition-colors group"
              >
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.title} className="w-10 h-10 rounded-md object-cover flex-none" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.price}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground flex-none" />
              </a>
            ))}
          </div>
        )}

        {/* One-Tap Buy */}
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="button-one-tap-buy"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ShoppingBag className="w-4 h-4" />
          One-Tap Buy — Shopify
        </a>
      </div>
    </div>
  );
}

export function DiscoveryFeed({ events, merchants, merchantCard, cardLoading, onPinClick }: DiscoveryFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const hasContent = events.length > 0 || cardLoading || merchantCard;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground">Discovery Feed</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">MCP agent events & merchant cards</p>
      </div>

      {/* Feed content */}
      <div className="flex-1 overflow-y-auto feed-scroll px-3 py-3 space-y-3">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Ready to discover</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[160px]">
              Click "Start Journey" or tap a merchant pin on the map
            </p>
          </div>
        )}

        {/* Render events chronologically */}
        {events.map((event, i) => {
          if (event.kind === "system") {
            return (
              <div
                key={i}
                className="flex items-start gap-2 animate-fade-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex-none w-1.5 h-1.5 rounded-full bg-primary/60 mt-2" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">{event.message}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">{formatTime(event.timestamp)}</p>
                </div>
              </div>
            );
          }

          if (event.kind === "merchant") {
            const merchant = merchants.find((m) => m.id === event.merchantId);
            const isLatest = events.filter((e) => e.kind === "merchant" && e.merchantId === event.merchantId).pop() === event;

            return (
              <div key={i} className="space-y-2">
                {/* Merchant trigger message */}
                <div className="flex items-start gap-2 animate-fade-up">
                  <div className="flex-none w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onPinClick(event.merchantId)}
                  >
                    <p className="text-xs text-foreground font-medium hover:text-primary transition-colors">
                      {merchant?.name ?? event.merchantId}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60">{formatTime(event.timestamp)}</p>
                  </div>
                </div>

                {/* Merchant card — show for latest card event or when matches selected */}
                {isLatest && (cardLoading || merchantCard?.merchant.id === event.merchantId) && (
                  <MerchantCardDisplay card={merchantCard} loading={cardLoading} />
                )}
              </div>
            );
          }

          return null;
        })}

        <div ref={bottomRef} />
      </div>

      {/* Merchants quick list */}
      {merchants.length > 0 && (
        <div className="flex-none border-t border-border">
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nearby merchants</p>
          </div>
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
            {merchants.slice(0, 8).map((m) => (
              <button
                key={m.id}
                data-testid={`merchant-chip-${m.id}`}
                onClick={() => onPinClick(m.id)}
                className="flex-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-xs whitespace-nowrap"
              >
                <span>{m.type === "winery" ? "🍷" : m.type === "bakery" ? "🥐" : m.type === "brewery" ? "🍺" : "☕"}</span>
                <span className="text-foreground font-medium max-w-[100px] truncate">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
