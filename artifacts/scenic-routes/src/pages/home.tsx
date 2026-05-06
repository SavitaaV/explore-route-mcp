import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetScenicRoute,
  useGetMerchants,
  useGetMerchantCard,
  useGetMcpTools,
} from "@workspace/api-client-react";
import { MapView } from "@/components/MapView";
import { DiscoveryFeed } from "@/components/DiscoveryFeed";
import { AppleWatch } from "@/components/AppleWatch";
import { McpToolsPanel } from "@/components/McpToolsPanel";
import { MapPin, Zap, ChevronDown, ChevronUp } from "lucide-react";

export type FeedEvent =
  | { kind: "system"; message: string; timestamp: Date }
  | { kind: "merchant"; merchantId: string; timestamp: Date };

const ROUTE_ORIGIN = "Toronto, ON";
const ROUTE_DEST = "Niagara-on-the-Lake, ON";
const MERCHANT_LAT = 43.2553;
const MERCHANT_LNG = -79.0712;

export default function Home() {
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [watchAlert, setWatchAlert] = useState<{ name: string; type: string } | null>(null);
  const [showMcpTools, setShowMcpTools] = useState(false);
  const journeyRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: route, isLoading: routeLoading } = useGetScenicRoute({
    origin: ROUTE_ORIGIN,
    destination: ROUTE_DEST,
  });

  const { data: merchants, isLoading: merchantsLoading } = useGetMerchants({
    lat: MERCHANT_LAT,
    lng: MERCHANT_LNG,
    radius: 15000,
    type: "all",
  });

  const merchantCardMutation = useGetMerchantCard();
  const { data: mcpTools } = useGetMcpTools();

  const addSystemEvent = useCallback((message: string) => {
    setFeedEvents((prev) => [
      ...prev,
      { kind: "system", message, timestamp: new Date() },
    ]);
  }, []);

  useEffect(() => {
    if (route && !routeLoading) {
      addSystemEvent(
        `🗺️ Scenic route loaded — ${route.distanceKm}km via ${route.summary.split("(")[0].trim()}`
      );
    }
  }, [route, routeLoading, addSystemEvent]);

  useEffect(() => {
    if (merchants && !merchantsLoading) {
      addSystemEvent(
        `📍 ${merchants.length} local merchants discovered along the Niagara Parkway`
      );
    }
  }, [merchants, merchantsLoading, addSystemEvent]);

  const handlePinClick = useCallback(
    (merchantId: string) => {
      setSelectedMerchantId(merchantId);
      const merchant = merchants?.find((m) => m.id === merchantId);
      if (!merchant) return;

      addSystemEvent(`🔍 MCP tool: get_nearby_merchants — fetching card for ${merchant.name}`);

      setFeedEvents((prev) => [
        ...prev,
        { kind: "merchant", merchantId, timestamp: new Date() },
      ]);

      merchantCardMutation.mutate(
        {
          data: {
            merchantId: merchant.id,
            merchantName: merchant.name,
            merchantType: merchant.type,
          },
        },
        {
          onSuccess: (card) => {
            addSystemEvent(
              `✅ Shopify card loaded — ${card.products.length} products, checkout ready`
            );
          },
        }
      );
    },
    [merchants, addSystemEvent, merchantCardMutation]
  );

  const triggerWatchAlert = useCallback(
    (merchant: { name: string; type: string }) => {
      setWatchAlert(merchant);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = setTimeout(() => setWatchAlert(null), 5000);
    },
    []
  );

  const startJourney = useCallback(() => {
    if (journeyStarted) return;
    setJourneyStarted(true);
    setJourneyProgress(0);
    addSystemEvent("🚗 Journey started — Toronto → Niagara-on-the-Lake via scenic route");
    addSystemEvent("🤖 MCP server active — monitoring route for merchants");

    const wineries = merchants?.filter((m) => m.type === "winery") ?? [];
    const allMerchants = merchants ?? [];
    let step = 0;
    const totalSteps = 100;

    journeyRef.current = setInterval(() => {
      step++;
      const progress = step / totalSteps;
      setJourneyProgress(progress);

      // Trigger merchant discovery events at certain points
      if (step === 20 && allMerchants[0]) {
        addSystemEvent(`📡 MCP: Merchant detected — ${allMerchants[0].name} (${allMerchants[0].distanceFromRouteKm ?? 0.5}km off route)`);
        handlePinClick(allMerchants[0].id);
      }
      if (step === 40 && wineries[0]) {
        addSystemEvent(`🍷 MCP: Winery proximity alert — ${wineries[0].name} in 5km`);
        triggerWatchAlert({ name: wineries[0].name, type: "winery" });
        handlePinClick(wineries[0].id);
      }
      if (step === 60 && allMerchants[2]) {
        addSystemEvent(`📡 MCP: Merchant detected — ${allMerchants[2].name}`);
        handlePinClick(allMerchants[2].id);
      }
      if (step === 80 && wineries[1]) {
        addSystemEvent(`🍷 MCP: Winery proximity alert — ${wineries[1].name} in 3km`);
        triggerWatchAlert({ name: wineries[1].name, type: "winery" });
      }
      if (step >= totalSteps) {
        if (journeyRef.current) clearInterval(journeyRef.current);
        addSystemEvent("🏁 Journey complete — arrived in Niagara-on-the-Lake");
      }
    }, 150);
  }, [journeyStarted, merchants, addSystemEvent, handlePinClick, triggerWatchAlert]);

  useEffect(() => {
    return () => {
      if (journeyRef.current) clearInterval(journeyRef.current);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, []);

  const merchantCardData =
    selectedMerchantId && merchantCardMutation.data?.merchant?.id === selectedMerchantId
      ? merchantCardMutation.data
      : null;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-5 py-3 border-b border-border bg-card/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <MapPin className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Scenic Routes MCP</h1>
            <p className="text-xs text-muted-foreground">Toronto → Niagara-on-the-Lake</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="button-mcp-tools"
            onClick={() => setShowMcpTools((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Zap className="w-3 h-3" />
            MCP Tools
            {showMcpTools ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {!journeyStarted ? (
            <button
              data-testid="button-start-journey"
              onClick={startJourney}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Start Journey
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {journeyProgress < 1 ? `${Math.round(journeyProgress * 100)}% of route` : "Arrived"}
            </div>
          )}
        </div>
      </header>

      {/* MCP Tools Dropdown */}
      {showMcpTools && mcpTools && (
        <div className="flex-none border-b border-border bg-card/95 backdrop-blur-sm z-10 animate-fade-up">
          <McpToolsPanel tools={mcpTools} />
        </div>
      )}

      {/* Main split-screen layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — Map */}
        <div className="flex-1 relative overflow-hidden">
          <MapView
            route={route ?? null}
            merchants={merchants ?? []}
            journeyProgress={journeyProgress}
            journeyStarted={journeyStarted}
            selectedMerchantId={selectedMerchantId}
            onPinClick={handlePinClick}
            isLoading={routeLoading || merchantsLoading}
          />

          {/* Apple Watch overlay — bottom-left of map */}
          <div className="absolute bottom-6 left-6 z-20">
            <AppleWatch alert={watchAlert} progress={journeyProgress} />
          </div>
        </div>

        {/* Right — Discovery Feed */}
        <div className="w-80 xl:w-96 flex-none border-l border-border flex flex-col bg-card/50 backdrop-blur-sm">
          <DiscoveryFeed
            events={feedEvents}
            merchants={merchants ?? []}
            merchantCard={merchantCardData}
            cardLoading={merchantCardMutation.isPending}
            onPinClick={handlePinClick}
          />
        </div>
      </div>
    </div>
  );
}
