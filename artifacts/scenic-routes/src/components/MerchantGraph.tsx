import { useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types from /api/places-graph ───────────────────────────────────────────

interface PlacesNode {
  placeId: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingsTotal: number;
  openNow: boolean | null;
  vicinity: string;
  shopifyStatus: "verified" | "ghost" | "unknown";
  shopifyMerchantId: string | null;
  website: string | null;
  source: "google" | "mock";
}

interface PlacesEdge {
  sourceId: string;
  targetId: string;
  score: number;
  proximityM: number;
  affinityReason: string;
}

interface PlacesGraph {
  nodes: PlacesNode[];
  edges: PlacesEdge[];
  commerceRoute: string[];
  source: "google" | "mock";
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const SHOPIFY_COLOR: Record<string, string> = {
  verified: "#059669",   // Shopify green
  ghost:    "#f59e0b",   // amber — ghost opportunity
  unknown:  "#6b7280",   // gray
};

const TYPE_EMOJI: Record<string, string> = {
  winery: "🍷", bakery: "🥐", cafe: "☕",
  restaurant: "🍽️", artisan: "🫙", boutique: "🛍️",
};

const TYPE_LABEL: Record<string, string> = {
  winery: "Winery", bakery: "Bakery", cafe: "Café",
  restaurant: "Restaurant", artisan: "Artisan", boutique: "Boutique",
};

const W = 280;
const H = 440;

// ─── Sim types ───────────────────────────────────────────────────────────────

interface SimNode extends SimulationNodeDatum, PlacesNode {}

interface SimEdge extends SimulationLinkDatum<SimNode> {
  score: number;
  proximityM: number;
  affinityReason: string;
}

interface NodePos { id: string; x: number; y: number; }

interface TooltipData {
  node: PlacesNode;
  x: number;
  y: number;
  topConnections: Array<{ name: string; score: number; proximityM: number; affinityReason: string }>;
}

function nodeRadius(n: PlacesNode) {
  const base = 11;
  const ratingBoost = n.rating != null ? (n.rating - 4.0) * 5 : 0;
  return Math.max(8, base + ratingBoost);
}

interface MerchantGraphProps {
  onMerchantClick?: (id: string) => void;
}

export function MerchantGraph({ onMerchantClick }: MerchantGraphProps) {
  const [data, setData] = useState<PlacesGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [positions, setPositions] = useState<Map<string, NodePos>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [settled, setSettled] = useState(false);
  const [routeStep, setRouteStep] = useState(0);

  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode, SimEdge>> | null>(null);

  // Fetch from /api/places-graph
  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/places-graph`)
      .then((r) => r.json())
      .then((d: PlacesGraph) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Animate the commerce route highlight step-by-step after settled
  useEffect(() => {
    if (!settled || !data?.commerceRoute.length) return;
    const id = setInterval(() => {
      setRouteStep((s) => (s + 1) % data.commerceRoute.length);
    }, 1600);
    return () => clearInterval(id);
  }, [settled, data]);

  // d3-force layout
  useEffect(() => {
    if (!data?.nodes.length) return;

    setSettled(false);
    const nodes: SimNode[] = data.nodes.map((n) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * 160,
      y: H / 2 + (Math.random() - 0.5) * 160,
    }));

    const nodeById = new Map(nodes.map((n) => [n.placeId, n]));

    const links: SimEdge[] = data.edges
      .map((e) => ({
        source: nodeById.get(e.sourceId)!,
        target: nodeById.get(e.targetId)!,
        score: e.score,
        proximityM: e.proximityM,
        affinityReason: e.affinityReason,
      }))
      .filter((e): e is SimEdge & { source: SimNode; target: SimNode } => !!e.source && !!e.target);

    const sim = forceSimulation<SimNode, SimEdge>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(links)
          .id((d) => d.placeId)
          .strength((d) => d.score * 0.6)
          .distance((d) => {
            const mBase = d.proximityM / 3.5;
            return Math.max(50, Math.min(160, mBase));
          })
      )
      .force("charge", forceManyBody<SimNode>().strength(-200))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius((d) => nodeRadius(d as PlacesNode) + 10));

    sim.on("tick", () => {
      const map = new Map<string, NodePos>();
      nodes.forEach((n) => {
        const r = nodeRadius(n);
        map.set(n.placeId, {
          id: n.placeId,
          x: Math.max(r + 4, Math.min(W - r - 4, n.x ?? W / 2)),
          y: Math.max(r + 4, Math.min(H - r - 4, n.y ?? H / 2)),
        });
      });
      setPositions(new Map(map));
    });

    sim.on("end", () => setSettled(true));
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [data]);

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#0d1017" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #34d399", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Fetching NOTL merchants from Google Places…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1017" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Commerce graph unavailable</p>
      </div>
    );
  }

  const nodeMap = new Map(data.nodes.map((n) => [n.placeId, n]));
  const edgesByNodeId = new Map<string, PlacesEdge[]>();
  data.edges.forEach((e) => {
    if (!edgesByNodeId.has(e.sourceId)) edgesByNodeId.set(e.sourceId, []);
    if (!edgesByNodeId.has(e.targetId)) edgesByNodeId.set(e.targetId, []);
    edgesByNodeId.get(e.sourceId)!.push(e);
    edgesByNodeId.get(e.targetId)!.push(e);
  });

  const verifiedCount = data.nodes.filter((n) => n.shopifyStatus === "verified").length;
  const ghostCount = data.nodes.filter((n) => n.shopifyStatus === "ghost").length;

  // Current commerce route highlight node
  const routeCurrentId = settled && data.commerceRoute.length ? data.commerceRoute[routeStep % data.commerceRoute.length] : null;
  const routeOrder = new Map(data.commerceRoute.map((id, i) => [id, i + 1]));

  const handleNodeHover = (node: PlacesNode, pos: NodePos) => {
    const edges = edgesByNodeId.get(node.placeId) ?? [];
    const topConnections = edges
      .map((e) => {
        const otherId = e.sourceId === node.placeId ? e.targetId : e.sourceId;
        const other = nodeMap.get(otherId);
        return other ? { name: other.name, score: e.score, proximityM: e.proximityM, affinityReason: e.affinityReason } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    setTooltip({ node, x: pos.x, y: pos.y, topConnections });
  };

  return (
    <div style={{ width: "100%", height: "100%", background: "#0d1017", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "8px 12px 5px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0 }}>Commerce Discovery Graph</p>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", margin: 0, marginTop: 1 }}>
            {data.nodes.length} real NOTL merchants · Google Places{data.source === "google" ? " live" : " fallback"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(5,150,105,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
            {verifiedCount} Shopify
          </div>
          <div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
            {ghostCount} ghost
          </div>
        </div>
      </div>

      {/* SVG graph */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg
          width={W} height={H}
          style={{ display: "block", width: "100%", height: "100%" }}
          viewBox={`0 0 ${W} ${H}`}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <filter id="glow-g">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-route">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {data.edges.map((edge) => {
            const src = positions.get(edge.sourceId);
            const tgt = positions.get(edge.targetId);
            if (!src || !tgt) return null;
            const isHighlighted = tooltip &&
              (tooltip.node.placeId === edge.sourceId || tooltip.node.placeId === edge.targetId);
            const isRouteEdge = routeCurrentId &&
              (edge.sourceId === routeCurrentId || edge.targetId === routeCurrentId);
            return (
              <line
                key={`${edge.sourceId}-${edge.targetId}`}
                x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke={isHighlighted ? "#34d399" : isRouteEdge ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.1)"}
                strokeWidth={isHighlighted ? edge.score * 3 + 1 : edge.score * 2 + 0.5}
                strokeOpacity={isHighlighted ? 0.9 : tooltip ? 0.06 : edge.score * 0.5 + 0.12}
                style={{ transition: "stroke-opacity 0.2s, stroke 0.2s" }}
              />
            );
          })}

          {/* Nodes */}
          {data.nodes.map((node) => {
            const pos = positions.get(node.placeId);
            if (!pos) return null;
            const r = nodeRadius(node);
            const color = SHOPIFY_COLOR[node.shopifyStatus];
            const isHovered = tooltip?.node.placeId === node.placeId;
            const isRouteActive = node.placeId === routeCurrentId;
            const routeN = routeOrder.get(node.placeId);

            return (
              <g
                key={node.placeId}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  if (node.shopifyMerchantId) onMerchantClick?.(node.shopifyMerchantId);
                }}
                onMouseEnter={() => handleNodeHover(node, pos)}
              >
                {/* Route pulse ring */}
                {isRouteActive && (
                  <circle
                    r={r + 10}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    opacity={0.5}
                    filter="url(#glow-route)"
                  />
                )}
                {/* Glow halo */}
                {isHovered && (
                  <circle r={r + 8} fill={color} opacity={0.18} filter="url(#glow-g)" />
                )}
                {/* Main circle */}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={node.openNow === false ? 0.35 : node.shopifyStatus === "ghost" ? 0.7 : 1}
                  stroke={isRouteActive ? "#f59e0b" : isHovered ? "#fff" : "rgba(255,255,255,0.15)"}
                  strokeWidth={isRouteActive ? 2 : isHovered ? 1.5 : 1}
                  filter={isHovered || isRouteActive ? "url(#glow-g)" : undefined}
                  style={{ transition: "fill-opacity 0.2s" }}
                />
                {/* Emoji */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={r * 0.82}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {node.shopifyStatus === "ghost" ? "👻" : (TYPE_EMOJI[node.type] ?? "🏪")}
                </text>
                {/* Commerce route order badge */}
                {routeN != null && routeN <= 5 && (
                  <text
                    x={r - 2} y={-r + 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={7}
                    fontWeight="700"
                    fill="#f59e0b"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {routeN}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (() => {
          const tipX = tooltip.x > W * 0.62 ? tooltip.x - 158 : tooltip.x + 18;
          const tipY = Math.max(8, Math.min(H - 160, tooltip.y - 24));
          const shopifyColor = SHOPIFY_COLOR[tooltip.node.shopifyStatus];
          return (
            <div style={{
              position: "absolute", left: tipX, top: tipY,
              background: "rgba(13,16,23,0.97)",
              border: `1px solid ${shopifyColor}44`,
              borderRadius: 10, padding: "8px 10px",
              pointerEvents: "none", zIndex: 20,
              minWidth: 148, maxWidth: 168,
              boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            }}>
              {/* Name + type */}
              <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1.3 }}>
                {TYPE_EMOJI[tooltip.node.type] ?? "🏪"} {tooltip.node.name}
              </p>
              <p style={{ fontSize: 9, color: shopifyColor, margin: "0 0 4px", letterSpacing: 0.4 }}>
                {TYPE_LABEL[tooltip.node.type] ?? tooltip.node.type}
                {tooltip.node.rating != null ? ` · ★ ${tooltip.node.rating.toFixed(1)}` : ""}
                {tooltip.node.userRatingsTotal > 0 ? ` (${tooltip.node.userRatingsTotal})` : ""}
              </p>
              {/* Shopify status */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: shopifyColor }} />
                <span style={{ fontSize: 8, color: shopifyColor, fontWeight: 600 }}>
                  {tooltip.node.shopifyStatus === "verified"
                    ? "Shopify verified"
                    : tooltip.node.shopifyStatus === "ghost"
                    ? "Ghost — not on Shopify yet"
                    : "Status unknown"}
                </span>
              </div>
              {/* Open status */}
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>
                {tooltip.node.openNow === true ? "🟢 Open now" : tooltip.node.openNow === false ? "🔴 Closed" : "Hours unknown"}
                {tooltip.node.vicinity ? ` · ${tooltip.node.vicinity.split(",")[0]}` : ""}
              </div>
              {/* Commerce route position */}
              {routeOrder.has(tooltip.node.placeId) && (
                <div style={{ fontSize: 8, color: "#f59e0b", marginBottom: 5, fontWeight: 600 }}>
                  Commerce stop #{routeOrder.get(tooltip.node.placeId)} on optimal route
                </div>
              )}
              {/* Connections */}
              {tooltip.topConnections.length > 0 && (
                <>
                  <p style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", margin: "0 0 3px", letterSpacing: 0.4, textTransform: "uppercase" }}>Co-visit affinity</p>
                  {tooltip.topConnections.map((c) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                        {c.name.split(" ").slice(0, 2).join(" ")}
                      </span>
                      <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>{c.proximityM}m</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#34d399" }}>
                          {Math.round(c.score * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      <div style={{ padding: "5px 12px 9px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Shopify-verified</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Ghost opportunity</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700 }}>①②</div>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Commerce route order</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 18, height: 2, background: "linear-gradient(to right, rgba(255,255,255,0.15), rgba(255,255,255,0.6))", borderRadius: 1 }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Proximity × affinity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
