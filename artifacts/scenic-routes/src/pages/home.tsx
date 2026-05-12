import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetScenicRoute,
  useGetMerchants,
  useGetMerchantCard,
  useGetMcpTools,
} from "@workspace/api-client-react";
import type { DiscoveryRoute } from "@workspace/api-client-react";
import { MapView } from "@/components/MapView";
import { AiChat } from "@/components/AiChat";
import { AppleWatch } from "@/components/AppleWatch";
import { MerchantGraph } from "@/components/MerchantGraph";
import { McpToolsPanel } from "@/components/McpToolsPanel";
import { Wifi, Battery, Signal, MapPin, Network } from "lucide-react";

function useTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function PhoneStatusBar({ side }: { side: "map" | "chat" }) {
  const time = useTime();
  const h = time.getHours().toString().padStart(2, "0");
  const m = time.getMinutes().toString().padStart(2, "0");
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1 flex-none select-none" style={{ zIndex: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: side === "map" ? "#fff" : "#1a1a1a", fontFamily: "sans-serif", letterSpacing: -0.3 }}>
        {h}:{m}
      </span>
      <div style={{ width: 100, height: 28, borderRadius: 20, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 }}>
          {side === "map" ? "MAPS" : "CLAUDE"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Signal style={{ width: 12, height: 12, color: side === "map" ? "#fff" : "#1a1a1a" }} />
        <Wifi style={{ width: 12, height: 12, color: side === "map" ? "#fff" : "#1a1a1a" }} />
        <Battery style={{ width: 14, height: 14, color: side === "map" ? "#fff" : "#1a1a1a" }} />
      </div>
    </div>
  );
}

function PhoneHomeIndicator({ color = "#000" }: { color?: string }) {
  return (
    <div className="flex justify-center pb-2 pt-1 flex-none">
      <div style={{ width: 120, height: 4, borderRadius: 2, background: color, opacity: 0.2 }} />
    </div>
  );
}

export default function Home() {
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [watchAlert, setWatchAlert] = useState<{ name: string; type: string } | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);

  // Top-level view toggle
  const [mainView, setMainView] = useState<"journey" | "graph" | "mcp">("journey");

  // Dynamic route — set from chat when user picks a location
  const [routeParams, setRouteParams] = useState<{ origin: string; dest: string; mode: string } | null>(null);
  const [merchantCenter, setMerchantCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Discovery route — set directly from Claude SSE tool result
  const [discoveryRoute, setDiscoveryRoute] = useState<DiscoveryRoute | null>(null);

  const journeyRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Queries — only fire when route/location is known
  const { data: route, isLoading: routeLoading } = useGetScenicRoute(
    routeParams
      ? { origin: routeParams.origin, destination: routeParams.dest, mode: routeParams.mode }
      : { origin: "", destination: "", mode: "walking" },
    { query: { enabled: !!routeParams } }
  );

  const { data: merchants, isLoading: merchantsLoading } = useGetMerchants(
    merchantCenter
      ? { lat: merchantCenter.lat, lng: merchantCenter.lng, radius: 800, type: "all" }
      : { lat: 0, lng: 0, radius: 800, type: "all" },
    { query: { enabled: !!merchantCenter } }
  );

  const merchantCardMutation = useGetMerchantCard();
  const { data: mcpTools } = useGetMcpTools();

  useEffect(() => {
    if (route?.waypoints?.length) {
      const mid = Math.floor(route.waypoints.length / 2);
      setMerchantCenter({ lat: route.waypoints[mid].lat, lng: route.waypoints[mid].lng });
    }
  }, [route]);

  const handlePinClick = useCallback((merchantId: string) => {
    setSelectedMerchantId(merchantId);
    const merchant = (merchants ?? []).find((m) => m.id === merchantId);
    if (merchant) {
      merchantCardMutation.mutate({ data: { merchantId, merchantName: merchant.name, merchantType: merchant.type } });
    } else {
      merchantCardMutation.mutate({ data: { merchantId, merchantName: merchantId, merchantType: "boutique" } });
    }
  }, [merchants, merchantCardMutation]);

  const triggerWatchAlert = useCallback((merchant: { name: string; type: string }) => {
    setWatchAlert(merchant);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => setWatchAlert(null), 5000);
  }, []);

  const handleStartJourney = useCallback(() => {
    if (journeyStarted || !mcpEnabled || !route) return;
    setJourneyStarted(true);
    setJourneyProgress(0);
    const allMerchants = merchants ?? [];
    const wineries = allMerchants.filter((m) => m.type === "winery");
    let step = 0;
    const totalSteps = 140;
    journeyRef.current = setInterval(() => {
      step++;
      setJourneyProgress(step / totalSteps);
      if (step === 20 && allMerchants[0]) handlePinClick(allMerchants[0].id);
      if (step === 55 && allMerchants[2]) handlePinClick(allMerchants[2].id);
      if (step === 80 && wineries[0]) {
        triggerWatchAlert({ name: wineries[0].name, type: "winery" });
        handlePinClick(wineries[0].id);
      } else if (step === 80 && allMerchants[3]) handlePinClick(allMerchants[3].id);
      if (step === 110 && allMerchants[1]) handlePinClick(allMerchants[1].id);
      if (step >= totalSteps && journeyRef.current) clearInterval(journeyRef.current);
    }, 110);
  }, [journeyStarted, mcpEnabled, route, merchants, handlePinClick, triggerWatchAlert]);

  const handleRouteRequest = useCallback((origin: string, dest: string, mode: string) => {
    setRouteParams({ origin, dest, mode });
    setMerchantCenter(null);
    setJourneyStarted(false);
    setJourneyProgress(0);
    setSelectedMerchantId(null);
    if (journeyRef.current) clearInterval(journeyRef.current);
  }, []);

  const handleDiscoveryResult = useCallback((route: DiscoveryRoute) => {
    setDiscoveryRoute(route);
  }, []);

  useEffect(() => () => {
    if (journeyRef.current) clearInterval(journeyRef.current);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
  }, []);

  const userPosition = journeyStarted && route?.waypoints?.length
    ? (() => {
        const wps = route.waypoints;
        const idx = Math.min(Math.floor(journeyProgress * (wps.length - 1)), wps.length - 2);
        const t = (journeyProgress * (wps.length - 1)) - idx;
        return {
          lat: wps[idx].lat + (wps[idx + 1].lat - wps[idx].lat) * t,
          lng: wps[idx].lng + (wps[idx + 1].lng - wps[idx].lng) * t,
          progress: journeyProgress,
        };
      })()
    : undefined;

  const routeContext = route ? {
    summary: route.summary,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    mode: route.mode,
    waypoints: route.waypoints,
  } : null;

  return (
    <div
      className="h-screen w-full overflow-hidden flex flex-col select-none"
      style={{ background: "linear-gradient(135deg, #060810 0%, #0a0d18 50%, #07090f 100%)" }}
    >
      {/* ── Top bar ── */}
      <div className="flex-none flex items-center justify-between px-8" style={{ paddingTop: 14, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(52,211,153,0.35)",
          }}>
            <MapPin style={{ width: 15, height: 15, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: -0.2, lineHeight: 1 }}>
              Explore Route MCP
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>
              Agentic Commerce
            </div>
          </div>
        </div>

        {/* Center — main view toggle */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 3, gap: 2, border: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => setMainView("journey")}
            style={{
              padding: "6px 18px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              border: "none", cursor: "pointer", letterSpacing: 0.4, textTransform: "uppercase",
              background: mainView === "journey" ? "rgba(52,211,153,0.18)" : "transparent",
              color: mainView === "journey" ? "#34d399" : "rgba(255,255,255,0.35)",
              transition: "all 0.2s",
            }}
          >
            <MapPin style={{ width: 9, height: 9, display: "inline", marginRight: 5 }} />
            User Journey
          </button>
          <button
            onClick={() => setMainView("graph")}
            style={{
              padding: "6px 18px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              border: "none", cursor: "pointer", letterSpacing: 0.4, textTransform: "uppercase",
              background: mainView === "graph" ? "rgba(52,211,153,0.18)" : "transparent",
              color: mainView === "graph" ? "#34d399" : "rgba(255,255,255,0.35)",
              transition: "all 0.2s",
            }}
          >
            <Network style={{ width: 9, height: 9, display: "inline", marginRight: 5 }} />
            Network Graph
          </button>
          <button
            onClick={() => setMainView("mcp")}
            style={{
              padding: "6px 18px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              border: "none", cursor: "pointer", letterSpacing: 0.4, textTransform: "uppercase",
              background: mainView === "mcp" ? "rgba(52,211,153,0.18)" : "transparent",
              color: mainView === "mcp" ? "#34d399" : "rgba(255,255,255,0.35)",
              transition: "all 0.2s",
            }}
          >
            MCP Tools
          </button>
        </div>

        {/* Right — live status + powered by */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { label: "Shopify MCP", color: "#96BF48", dot: "🛍️" },
            { label: "Google Maps", color: "#4285F4", dot: "🗺️" },
            { label: "Claude AI", color: "#D97706", dot: "✦" },
          ].map(({ label, color, dot }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 9px", borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ fontSize: 9 }}>{dot}</span>
              <span style={{ fontSize: 8.5, fontWeight: 600, color, letterSpacing: 0.3 }}>{label}</span>
            </div>
          ))}
          {mcpEnabled ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399" }} className="animate-pulse" />
              <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700, letterSpacing: 0.5 }}>LIVE</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: 0.5 }}>STANDBY</span>
            </div>
          )}
          {mcpTools && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", letterSpacing: 0.3 }}>
              {mcpTools.length} tools
            </div>
          )}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 min-h-0">
        {mainView === "graph" ? (
          /* ── Full-screen Network Graph ── */
          <div style={{ width: "100%", height: "100%" }}>
            <MerchantGraph onMerchantClick={handlePinClick} />
          </div>
        ) : mainView === "mcp" ? (
          /* ── MCP Tools Panel ── */
          <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: "24px 40px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                MCP Tool Schemas
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", maxWidth: 640 }}>
                These are the tools exposed by the Scenic Routes MCP server. Claude can invoke them automatically based on user intent.
              </div>
            </div>
            {mcpTools ? (
              <McpToolsPanel tools={mcpTools} />
            ) : (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Loading tools…</div>
            )}
          </div>
        ) : (
          /* ── User Journey split-screen ── */
          <div className="flex items-center justify-center px-6 pb-4 gap-0 h-full">
            {/* LEFT — Map + Watch */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 h-full relative">
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>
                Navigation & Discovery
              </div>

              <div style={{
                width: "min(300px, 42vw)", height: "min(580px, 78vh)",
                borderRadius: 44, background: "#0f0f14",
                border: "2px solid #1e2030",
                boxShadow: "0 0 0 1px #0a0a10, 0 50px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
                display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
              }}>
                <div style={{ position: "absolute", left: -4, top: "22%", width: 4, height: 32, background: "#1a1a24", borderRadius: "4px 0 0 4px", border: "1px solid #2a2a38" }} />
                <div style={{ position: "absolute", left: -4, top: "35%", width: 4, height: 22, background: "#1a1a24", borderRadius: "4px 0 0 4px", border: "1px solid #2a2a38" }} />
                <div style={{ position: "absolute", left: -4, top: "44%", width: 4, height: 22, background: "#1a1a24", borderRadius: "4px 0 0 4px", border: "1px solid #2a2a38" }} />
                <div style={{ position: "absolute", right: -4, top: "30%", width: 4, height: 44, background: "#1a1a24", borderRadius: "0 4px 4px 0", border: "1px solid #2a2a38" }} />

                <PhoneStatusBar side="map" />

                <div className="flex-1 relative overflow-hidden">
                  <MapView
                    route={route ?? null}
                    merchants={merchants ?? []}
                    journeyProgress={journeyProgress}
                    journeyStarted={journeyStarted}
                    selectedMerchantId={selectedMerchantId}
                    onPinClick={handlePinClick}
                    isLoading={routeLoading || merchantsLoading}
                    routeRequested={!!routeParams}
                    discoveryRoute={discoveryRoute ?? null}
                  />

                  {/* Overlay when MCP not enabled */}
                  {!mcpEnabled && (
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(6,8,16,0.6)", backdropFilter: "blur(2px)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8,
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <MapPin style={{ width: 18, height: 18, color: "#34d399" }} />
                      </div>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", maxWidth: 140, lineHeight: 1.5 }}>
                        Enable Explore Route MCP in the chat to activate navigation
                      </p>
                    </div>
                  )}
                </div>

                <PhoneHomeIndicator color="#fff" />
              </div>

              <div style={{ transform: "scale(0.82)", transformOrigin: "top center", marginTop: -4 }}>
                <AppleWatch alert={watchAlert} progress={journeyProgress} />
              </div>
            </div>

            {/* CENTER DIVIDER */}
            <div style={{ width: 1, alignSelf: "stretch", margin: "20px 0", background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)" }} />
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 0, overflow: "visible", zIndex: 10 }}>
              <div style={{ background: "#0d1020", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "6px 14px", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Live</span>
              </div>
              {mcpEnabled && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#34d399", opacity: 0.6 - i * 0.12, animation: `pulse 1.5s ${i * 0.2}s ease-in-out infinite` }} />
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT — Claude agent */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 h-full relative">
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 2 }}>
                Agentic Commerce
              </div>

              <div style={{
                width: "min(300px, 42vw)", height: "min(580px, 78vh)",
                borderRadius: 44, background: "#f5f5f7",
                border: "2px solid #e0e0e5",
                boxShadow: "0 0 0 1px #ccc, 0 50px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.9)",
                display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
              }}>
                <div style={{ position: "absolute", left: -4, top: "22%", width: 4, height: 32, background: "#d0d0d8", borderRadius: "4px 0 0 4px", border: "1px solid #bbb" }} />
                <div style={{ position: "absolute", left: -4, top: "35%", width: 4, height: 22, background: "#d0d0d8", borderRadius: "4px 0 0 4px", border: "1px solid #bbb" }} />
                <div style={{ position: "absolute", right: -4, top: "30%", width: 4, height: 44, background: "#d0d0d8", borderRadius: "0 4px 4px 0", border: "1px solid #bbb" }} />

                <PhoneStatusBar side="chat" />

                <div className="flex-1 overflow-hidden" style={{ background: "#f5f5f7" }}>
                  <AiChat
                    merchants={merchants ?? []}
                    routeContext={routeContext}
                    journeyProgress={journeyProgress}
                    journeyStarted={journeyStarted}
                    mcpEnabled={mcpEnabled}
                    onMcpEnable={() => setMcpEnabled(true)}
                    onRouteRequest={handleRouteRequest}
                    onStartJourney={handleStartJourney}
                    userPosition={userPosition}
                    onMerchantFocus={handlePinClick}
                    onDiscoveryResult={handleDiscoveryResult}
                    discoveryRoute={discoveryRoute}
                  />
                </div>

                <PhoneHomeIndicator color="#000" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: 0.35 }}>
                {["Shopify", "Claude", "Maps"].map((name) => (
                  <span key={name} style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{name}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
