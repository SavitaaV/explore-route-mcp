import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetScenicRoute,
  useGetMerchants,
  useGetMerchantCard,
  useGetMcpTools,
} from "@workspace/api-client-react";
import { MapView } from "@/components/MapView";
import { AiChat } from "@/components/AiChat";
import { AppleWatch } from "@/components/AppleWatch";
import { McpToolsPanel } from "@/components/McpToolsPanel";
import { MapPin, Zap, ChevronDown, ChevronUp, PersonStanding } from "lucide-react";

const ROUTE_ORIGIN = "Market Square, Niagara-on-the-Lake, ON";
const ROUTE_DEST = "Fort George National Historic Site, Niagara-on-the-Lake, ON";
const ROUTE_MODE = "walking";
const MERCHANT_LAT = 43.2553;
const MERCHANT_LNG = -79.0712;

// Positions along the NOTL walking loop for the journey animation
const JOURNEY_WAYPOINTS = [
  { lat: 43.2553, lng: -79.0712, progress: 0 },    // Market Square start
  { lat: 43.258, lng: -79.066, progress: 0.2 },    // heading toward Fort George
  { lat: 43.2617, lng: -79.058, progress: 0.35 },  // Fort George
  { lat: 43.2627, lng: -79.066, progress: 0.5 },   // Simcoe Park waterfront
  { lat: 43.2585, lng: -79.073, progress: 0.65 },  // heading back to Queen St
  { lat: 43.2554, lng: -79.0733, progress: 0.8 },  // Shaw Festival
  { lat: 43.2547, lng: -79.0712, progress: 0.95 }, // Queen Street
  { lat: 43.2553, lng: -79.0712, progress: 1 },    // Market Square end
];

function getPositionAtProgress(progress: number): { lat: number; lng: number } {
  if (progress <= 0) return JOURNEY_WAYPOINTS[0];
  if (progress >= 1) return JOURNEY_WAYPOINTS[JOURNEY_WAYPOINTS.length - 1];
  for (let i = 1; i < JOURNEY_WAYPOINTS.length; i++) {
    const prev = JOURNEY_WAYPOINTS[i - 1];
    const next = JOURNEY_WAYPOINTS[i];
    if (progress <= next.progress) {
      const t = (progress - prev.progress) / (next.progress - prev.progress);
      return {
        lat: prev.lat + (next.lat - prev.lat) * t,
        lng: prev.lng + (next.lng - prev.lng) * t,
      };
    }
  }
  return JOURNEY_WAYPOINTS[JOURNEY_WAYPOINTS.length - 1];
}

export default function Home() {
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
    mode: ROUTE_MODE,
  });

  const { data: merchants, isLoading: merchantsLoading } = useGetMerchants({
    lat: MERCHANT_LAT,
    lng: MERCHANT_LNG,
    radius: 800,
    type: "all",
  });

  const merchantCardMutation = useGetMerchantCard();
  const { data: mcpTools } = useGetMcpTools();

  const handlePinClick = useCallback(
    (merchantId: string) => {
      setSelectedMerchantId(merchantId);
      const merchant = merchants?.find((m) => m.id === merchantId);
      if (!merchant) return;

      merchantCardMutation.mutate({
        data: {
          merchantId: merchant.id,
          merchantName: merchant.name,
          merchantType: merchant.type,
        },
      });
    },
    [merchants, merchantCardMutation]
  );

  const triggerWatchAlert = useCallback((merchant: { name: string; type: string }) => {
    setWatchAlert(merchant);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => setWatchAlert(null), 5000);
  }, []);

  const startJourney = useCallback(() => {
    if (journeyStarted) return;
    setJourneyStarted(true);
    setJourneyProgress(0);

    const allMerchants = merchants ?? [];
    const wineries = allMerchants.filter((m) => m.type === "winery");
    let step = 0;
    const totalSteps = 120;

    journeyRef.current = setInterval(() => {
      step++;
      const progress = step / totalSteps;
      setJourneyProgress(progress);

      if (step === 15 && allMerchants[0]) {
        handlePinClick(allMerchants[0].id);
      }
      if (step === 42 && allMerchants[2]) {
        handlePinClick(allMerchants[2].id);
      }
      if (step === 60 && wineries[0]) {
        triggerWatchAlert({ name: wineries[0].name, type: "winery" });
        handlePinClick(wineries[0].id);
      }
      if (step === 85 && allMerchants[4]) {
        handlePinClick(allMerchants[4].id);
      }
      if (step >= totalSteps) {
        if (journeyRef.current) clearInterval(journeyRef.current);
      }
    }, 120);
  }, [journeyStarted, merchants, handlePinClick, triggerWatchAlert]);

  useEffect(() => {
    return () => {
      if (journeyRef.current) clearInterval(journeyRef.current);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, []);

  const userPosition = journeyStarted ? getPositionAtProgress(journeyProgress) : undefined;

  const merchantCardData =
    selectedMerchantId && merchantCardMutation.data?.merchant?.id === selectedMerchantId
      ? merchantCardMutation.data
      : null;

  const routeContext = route
    ? {
        summary: route.summary,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        mode: route.mode,
        waypoints: route.waypoints,
      }
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
            <div className="flex items-center gap-1.5">
              <PersonStanding className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">NOTL Old Town Walking Loop · {route?.distanceKm ?? 3.2}km</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMcpTools((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Zap className="w-3 h-3" />
            MCP Tools
            {showMcpTools ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {!journeyStarted ? (
            <button
              onClick={startJourney}
              disabled={routeLoading || merchantsLoading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <PersonStanding className="w-3.5 h-3.5" />
              Start Walk
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {journeyProgress < 1 ? `${Math.round(journeyProgress * 100)}% of loop` : "Loop complete!"}
            </div>
          )}
        </div>
      </header>

      {/* MCP Tools Dropdown */}
      {showMcpTools && mcpTools && (
        <div className="flex-none border-b border-border bg-card/95 backdrop-blur-sm z-10">
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

          {/* Merchant card overlay when selected */}
          {merchantCardData && (
            <div className="absolute bottom-24 left-4 right-4 z-20 bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-4 shadow-xl animate-fade-up">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{merchantCardData.merchant.name}</p>
                  <p className="text-[11px] text-muted-foreground">{merchantCardData.merchant.address}</p>
                </div>
                <button
                  onClick={() => setSelectedMerchantId(null)}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none -mt-0.5"
                >×</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {merchantCardData.products.slice(0, 2).map((p) => (
                  <a
                    key={p.id}
                    href={p.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-none flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-xl px-3 py-2 hover:bg-primary/20 transition-colors group"
                  >
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt={p.title} className="w-10 h-10 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="text-[11px] font-medium text-foreground line-clamp-1 max-w-[120px]">{p.title}</p>
                      <p className="text-[11px] text-primary font-semibold">{p.price}</p>
                    </div>
                    <span className="text-[10px] text-primary group-hover:underline ml-1 shrink-0">Buy →</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Apple Watch overlay — bottom-left of map */}
          <div className="absolute bottom-6 left-6 z-20">
            <AppleWatch alert={watchAlert} progress={journeyProgress} />
          </div>
        </div>

        {/* Right — AI Chat */}
        <div className="w-80 xl:w-96 flex-none border-l border-border flex flex-col bg-card/50 backdrop-blur-sm">
          <AiChat
            merchants={merchants ?? []}
            routeContext={routeContext}
            journeyStarted={journeyStarted}
            userPosition={userPosition}
            onMerchantFocus={handlePinClick}
          />
        </div>
      </div>
    </div>
  );
}
