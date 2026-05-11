import { useEffect, useRef, useState, useMemo } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── API types ────────────────────────────────────────────────────────────────

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

// ─── Styling constants ────────────────────────────────────────────────────────

const SHOPIFY_GREEN = "#059669";
const GHOST_AMBER   = "#f59e0b";

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
const CX = W / 2;
const CY = H / 2 - 10;

// ─── d3 simulation types ──────────────────────────────────────────────────────

interface SimNode extends SimulationNodeDatum, PlacesNode {}

type RealEdge = SimulationLinkDatum<SimNode> & {
  score: number;
  proximityM: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineMetre(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nodeRadius(n: PlacesNode) {
  const base = n.shopifyStatus === "verified" ? 15 : 10;
  const boost = n.rating != null ? (n.rating - 4.0) * 3 : 0;
  return Math.max(8, base + boost);
}

// For each ghost node, pick the nearest verified node → shadow edge
function computeShadowEdges(
  nodes: PlacesNode[]
): Array<{ ghostId: string; shopifyId: string; proximityM: number }> {
  const verified = nodes.filter((n) => n.shopifyStatus === "verified");
  const ghosts   = nodes.filter((n) => n.shopifyStatus !== "verified");
  return ghosts.map((g) => {
    const nearest = verified.reduce<{ node: PlacesNode | null; dist: number }>(
      (best, v) => {
        const d = haversineMetre(g.lat, g.lng, v.lat, v.lng);
        return d < best.dist ? { node: v, dist: d } : best;
      },
      { node: null, dist: Infinity }
    );
    return {
      ghostId: g.placeId,
      shopifyId: nearest.node?.placeId ?? "",
      proximityM: Math.round(nearest.dist),
    };
  }).filter((e) => e.shopifyId);
}

interface NodePos { id: string; x: number; y: number; }

interface TooltipState {
  node: PlacesNode;
  x: number;
  y: number;
  nearestShopify?: PlacesNode;
  nearestDistM?: number;
}

interface MerchantGraphProps {
  onMerchantClick?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MerchantGraph({ onMerchantClick }: MerchantGraphProps) {
  const [data, setData]       = useState<PlacesGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [positions, setPositions] = useState<Map<string, NodePos>>(new Map());
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null);
  const [settled, setSettled]     = useState(false);

  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode, RealEdge>> | null>(null);

  // Fetch
  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/places-graph`)
      .then((r) => r.json())
      .then((d: PlacesGraph) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Shadow edges (display-only, not in simulation)
  const shadowEdges = useMemo(
    () => (data ? computeShadowEdges(data.nodes) : []),
    [data]
  );

  // d3 simulation — only Shopify↔Shopify real links; ghosts float freely
  useEffect(() => {
    if (!data?.nodes.length) return;
    setSettled(false);

    const nodes: SimNode[] = data.nodes.map((n, i) => {
      if (n.shopifyStatus === "verified") {
        // Start verified nodes near center
        return { ...n, x: CX + (Math.random() - 0.5) * 30, y: CY + (Math.random() - 0.5) * 30 };
      }
      // Start ghost nodes on a ring
      const angle = (i / data.nodes.length) * 2 * Math.PI;
      const r = 105 + Math.random() * 25;
      return { ...n, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
    });

    const nodeById = new Map(nodes.map((n) => [n.placeId, n]));

    // Only edges between verified nodes enter the force simulation
    const verifiedSet = new Set(
      data.nodes.filter((n) => n.shopifyStatus === "verified").map((n) => n.placeId)
    );

    const realLinks: RealEdge[] = data.edges
      .filter((e) => verifiedSet.has(e.sourceId) && verifiedSet.has(e.targetId))
      .map((e) => ({
        source: nodeById.get(e.sourceId)!,
        target: nodeById.get(e.targetId)!,
        score: e.score,
        proximityM: e.proximityM,
      }))
      .filter((e): e is RealEdge & { source: SimNode; target: SimNode } =>
        !!e.source && !!e.target
      );

    const sim = forceSimulation<SimNode, RealEdge>(nodes)
      .force(
        "link",
        forceLink<SimNode, RealEdge>(realLinks)
          .id((d) => d.placeId)
          .strength(0.8)
          .distance(55)
      )
      .force(
        "charge",
        forceManyBody<SimNode>().strength((d) =>
          (d as SimNode).shopifyStatus === "verified" ? -80 : -55
        )
      )
      // Pull verified nodes strongly to center; ghosts only weakly
      .force(
        "x",
        forceX<SimNode>(CX).strength((d) =>
          (d as SimNode).shopifyStatus === "verified" ? 0.45 : 0.04
        )
      )
      .force(
        "y",
        forceY<SimNode>(CY).strength((d) =>
          (d as SimNode).shopifyStatus === "verified" ? 0.45 : 0.04
        )
      )
      .force("center", forceCenter(CX, CY).strength(0.05))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => nodeRadius(d as PlacesNode) + 8)
      );

    sim.on("tick", () => {
      const map = new Map<string, NodePos>();
      nodes.forEach((n) => {
        const r = nodeRadius(n);
        map.set(n.placeId, {
          id: n.placeId,
          x: Math.max(r + 4, Math.min(W - r - 4, n.x ?? CX)),
          y: Math.max(r + 4, Math.min(H - r - 4, n.y ?? CY)),
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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#0a0d12" }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid #34d399", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Mapping NOTL commerce graph…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0d12" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Commerce graph unavailable</p>
      </div>
    );
  }

  const nodeMap    = new Map(data.nodes.map((n) => [n.placeId, n]));
  const verified   = data.nodes.filter((n) => n.shopifyStatus === "verified");
  const ghosts     = data.nodes.filter((n) => n.shopifyStatus !== "verified");
  const shadowMap  = new Map(shadowEdges.map((e) => [e.ghostId, e]));

  const handleNodeEnter = (node: PlacesNode, pos: NodePos) => {
    const shadow = shadowMap.get(node.placeId);
    const nearestShopify = shadow ? nodeMap.get(shadow.shopifyId) : undefined;
    setTooltip({ node, x: pos.x, y: pos.y, nearestShopify, nearestDistM: shadow?.proximityM });
  };

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0d12", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* ── Header ── */}
      <div style={{ padding: "8px 12px 4px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0 }}>
              Spatial Commerce Graph
            </p>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", margin: "1px 0 0", letterSpacing: 0.3 }}>
              Google Places · NOTL Old Town · {data.source === "google" ? "live" : "mock data"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 8.5, padding: "2px 7px", borderRadius: 10, background: "rgba(5,150,105,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)", fontWeight: 600 }}>
              {verified.length} connected
            </span>
            <span style={{ fontSize: 8.5, padding: "2px 7px", borderRadius: 10, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", fontWeight: 600 }}>
              {ghosts.length} orphaned
            </span>
          </div>
        </div>
      </div>

      {/* ── SVG ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "100%", display: "block" }}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <filter id="glow-shopify">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-ghost">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="cluster-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Shopify cluster glow halo — renders behind everything */}
          {settled && (() => {
            const vpos = verified.map((n) => positions.get(n.placeId)).filter(Boolean) as NodePos[];
            if (!vpos.length) return null;
            const cx = vpos.reduce((s, p) => s + p.x, 0) / vpos.length;
            const cy = vpos.reduce((s, p) => s + p.y, 0) / vpos.length;
            return (
              <circle cx={cx} cy={cy} r={55}
                fill="url(#cluster-glow)"
                style={{ pointerEvents: "none" }}
              />
            );
          })()}

          {/* ── Real edges (Shopify↔Shopify only) ── */}
          {data.edges
            .filter((e) => {
              const s = nodeMap.get(e.sourceId);
              const t = nodeMap.get(e.targetId);
              return s?.shopifyStatus === "verified" && t?.shopifyStatus === "verified";
            })
            .map((edge) => {
              const src = positions.get(edge.sourceId);
              const tgt = positions.get(edge.targetId);
              if (!src || !tgt) return null;
              const isHovered =
                tooltip?.node.placeId === edge.sourceId ||
                tooltip?.node.placeId === edge.targetId;
              return (
                <line
                  key={`${edge.sourceId}-${edge.targetId}`}
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={SHOPIFY_GREEN}
                  strokeWidth={isHovered ? edge.score * 4 + 1.5 : edge.score * 3 + 0.8}
                  strokeOpacity={isHovered ? 0.85 : 0.45}
                  style={{ transition: "stroke-opacity 0.2s" }}
                />
              );
            })}

          {/* ── Shadow edges (ghost → nearest Shopify, dotted) ── */}
          {shadowEdges.map((se) => {
            const gpos = positions.get(se.ghostId);
            const spos = positions.get(se.shopifyId);
            if (!gpos || !spos) return null;
            const isHoveredGhost  = tooltip?.node.placeId === se.ghostId;
            const isHoveredShopify = tooltip?.node.placeId === se.shopifyId;
            const active = isHoveredGhost || isHoveredShopify;
            return (
              <g key={`shadow-${se.ghostId}`}>
                <line
                  x1={gpos.x} y1={gpos.y}
                  x2={spos.x} y2={spos.y}
                  stroke={GHOST_AMBER}
                  strokeWidth={active ? 1.2 : 0.8}
                  strokeOpacity={active ? 0.55 : 0.18}
                  strokeDasharray="4 5"
                  style={{ transition: "stroke-opacity 0.25s, stroke-width 0.25s" }}
                />
                {/* Midpoint label on hover */}
                {active && (
                  <text
                    x={(gpos.x + spos.x) / 2}
                    y={(gpos.y + spos.y) / 2 - 5}
                    textAnchor="middle"
                    fontSize={6.5}
                    fill={GHOST_AMBER}
                    fillOpacity={0.7}
                    fontWeight="600"
                    letterSpacing={0.4}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    SHADOW EDGE · {se.proximityM}m
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {data.nodes.map((node) => {
            const pos = positions.get(node.placeId);
            if (!pos) return null;
            const r = nodeRadius(node);
            const isVerified  = node.shopifyStatus === "verified";
            const isHovered   = tooltip?.node.placeId === node.placeId;
            const color       = isVerified ? SHOPIFY_GREEN : GHOST_AMBER;
            const dimmed      = node.openNow === false;

            return (
              <g
                key={node.placeId}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => handleNodeEnter(node, pos)}
                onClick={() => { if (node.shopifyMerchantId) onMerchantClick?.(node.shopifyMerchantId); }}
              >
                {/* Hover ring */}
                {isHovered && (
                  <circle
                    r={r + 9}
                    fill={color}
                    fillOpacity={0.1}
                    stroke={color}
                    strokeWidth={0.8}
                    strokeOpacity={0.4}
                    filter={isVerified ? "url(#glow-shopify)" : "url(#glow-ghost)"}
                  />
                )}

                {/* Ghost pulse ring — subtle, always on */}
                {!isVerified && (
                  <circle
                    r={r + 4}
                    fill="none"
                    stroke={GHOST_AMBER}
                    strokeWidth={0.6}
                    strokeOpacity={0.22}
                    strokeDasharray="3 4"
                  />
                )}

                {/* Main node */}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={dimmed ? 0.3 : isVerified ? 1 : 0.72}
                  stroke={isHovered ? "#fff" : isVerified ? "rgba(52,211,153,0.5)" : "rgba(245,158,11,0.3)"}
                  strokeWidth={isHovered ? 1.5 : 0.8}
                  filter={isVerified && !dimmed ? "url(#glow-shopify)" : undefined}
                  style={{ transition: "fill-opacity 0.2s" }}
                />

                {/* Emoji */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={r * 0.78}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {!isVerified ? "👻" : (TYPE_EMOJI[node.type] ?? "🏪")}
                </text>

                {/* "S" verified badge */}
                {isVerified && (
                  <g transform={`translate(${r - 3},${-r + 3})`}>
                    <circle r={5} fill="#059669" stroke="#0a0d12" strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={6} fill="#fff" fontWeight="800" style={{ userSelect: "none" }}>S</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Tooltip ── */}
        {tooltip && (() => {
          const { node, x, y, nearestShopify, nearestDistM } = tooltip;
          const isVerified = node.shopifyStatus === "verified";
          const tipX = x > W * 0.6 ? x - 172 : x + 20;
          const tipY = Math.max(8, Math.min(H - 200, y - 30));
          const color = isVerified ? SHOPIFY_GREEN : GHOST_AMBER;

          return (
            <div style={{
              position: "absolute", left: tipX, top: tipY, zIndex: 30,
              background: "rgba(10,13,18,0.98)",
              border: `1px solid ${color}44`,
              borderRadius: 10, padding: "9px 11px",
              minWidth: 158, maxWidth: 178,
              boxShadow: `0 6px 24px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
              pointerEvents: "none",
            }}>
              {/* Name */}
              <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1.3 }}>
                {TYPE_EMOJI[node.type] ?? "🏪"} {node.name}
              </p>
              <p style={{ fontSize: 8.5, color: "rgba(255,255,255,0.4)", margin: "0 0 6px" }}>
                {TYPE_LABEL[node.type] ?? node.type}
                {node.rating != null ? ` · ★${node.rating.toFixed(1)}` : ""}
                {node.userRatingsTotal > 0 ? ` (${node.userRatingsTotal})` : ""}
              </p>

              {isVerified ? (
                /* Shopify verified node */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: SHOPIFY_GREEN }} />
                    <span style={{ fontSize: 8.5, color: "#34d399", fontWeight: 600 }}>
                      Connected to commerce graph
                    </span>
                  </div>
                  <p style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", margin: "0 0 4px", lineHeight: 1.5 }}>
                    Real-time inventory edges. Shopify agents can query stock, trigger purchase, verify checkout.
                  </p>
                  <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.3)" }}>
                    {node.openNow === true ? "🟢 Open now" : node.openNow === false ? "🔴 Closed" : "Hours unknown"}
                  </div>
                </>
              ) : (
                /* Ghost orphan node */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: GHOST_AMBER }} />
                    <span style={{ fontSize: 8.5, color: GHOST_AMBER, fontWeight: 600 }}>
                      Orphaned — not on Shopify
                    </span>
                  </div>
                  {nearestShopify && (
                    <div style={{
                      background: "rgba(245,158,11,0.07)",
                      border: "1px dashed rgba(245,158,11,0.25)",
                      borderRadius: 7, padding: "6px 8px", marginBottom: 7,
                    }}>
                      <p style={{ fontSize: 7.5, color: GHOST_AMBER, fontWeight: 700, margin: "0 0 2px", letterSpacing: 0.3 }}>
                        SHADOW EDGE
                      </p>
                      <p style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.45 }}>
                        {nearestDistM}m from <strong>{nearestShopify.name}</strong>. Co-visit probability inferred — no inventory edge until they join Shopify.
                      </p>
                    </div>
                  )}
                  <div style={{
                    background: "rgba(5,150,105,0.08)",
                    border: "1px solid rgba(5,150,105,0.2)",
                    borderRadius: 7, padding: "6px 8px",
                  }}>
                    <p style={{ fontSize: 7.5, color: "#34d399", fontWeight: 700, margin: "0 0 2px", letterSpacing: 0.3 }}>
                      BRIDGE TRANSACTION
                    </p>
                    <p style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.45 }}>
                      Walkers are being routed past this merchant. They can't receive orders yet — no Shopify = no edge = no revenue.
                    </p>
                  </div>
                  <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                    {node.openNow === true ? "🟢 Open now" : node.openNow === false ? "🔴 Closed" : "Hours unknown"}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Legend ── */}
      <div style={{ padding: "5px 12px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: SHOPIFY_GREEN }} />
            <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.35)" }}>Shopify — real inventory edges</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: GHOST_AMBER, opacity: 0.72 }} />
            <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.35)" }}>Ghost — isolated, no edges</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={18} height={4}>
              <line x1={0} y1={2} x2={18} y2={2} stroke={GHOST_AMBER} strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.5} />
            </svg>
            <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.35)" }}>Shadow edge (LLM-inferred)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={18} height={4}>
              <line x1={0} y1={2} x2={18} y2={2} stroke={SHOPIFY_GREEN} strokeWidth={1.5} strokeOpacity={0.5} />
            </svg>
            <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.35)" }}>Commerce edge (verified)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
