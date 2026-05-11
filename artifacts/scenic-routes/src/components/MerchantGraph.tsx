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
  city?: string;
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

interface MockProduct {
  title: string;
  handle: string;
  productType: string;
  tags: string[];
  minPrice: number;
  maxPrice: number;
  currency: string;
  imageUrl: string | null;
}

interface MockCollection {
  handle: string;
  title: string;
  products: MockProduct[];
}

interface MockCatalog {
  source: string;
  collectionsCount: number;
  totalProducts: number;
  collections: MockCollection[];
  allProductTypes: string[];
  sampleTags: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHOPIFY_GREEN = "#059669";
const GHOST_AMBER = "#f59e0b";

const TYPE_EMOJI: Record<string, string> = {
  winery: "🍷", bakery: "🥐", cafe: "☕",
  restaurant: "🍽️", artisan: "🫙", boutique: "🛍️",
};
const TYPE_LABEL: Record<string, string> = {
  winery: "Winery", bakery: "Bakery", cafe: "Café",
  restaurant: "Restaurant", artisan: "Artisan", boutique: "Boutique",
};
const CITY_COLOR: Record<string, string> = {
  Toronto: "#60a5fa",
  Ottawa: "#a78bfa",
  Hamilton: "#34d399",
  London: "#fb923c",
  Niagara: "#f472b6",
};

// ─── Sim types ────────────────────────────────────────────────────────────────

interface SimNode extends SimulationNodeDatum, PlacesNode {}
type SimEdge = SimulationLinkDatum<SimNode> & { score: number; proximityM: number };

interface NodePos { id: string; x: number; y: number; }

interface TooltipState {
  node: PlacesNode;
  x: number;
  y: number;
  nearestShopify?: PlacesNode;
  nearestDistM?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineMetre(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nodeRadius(n: PlacesNode) {
  const base = n.shopifyStatus === "verified" ? 16 : 10;
  const boost = n.rating != null ? (n.rating - 4.0) * 3 : 0;
  return Math.max(8, base + boost);
}

function computeShadowEdges(nodes: PlacesNode[]): Array<{ ghostId: string; shopifyId: string; proximityM: number }> {
  const verified = nodes.filter((n) => n.shopifyStatus === "verified");
  const ghosts = nodes.filter((n) => n.shopifyStatus !== "verified");
  if (!verified.length) return [];
  return ghosts.map((g) => {
    const nearest = verified.reduce<{ node: PlacesNode | null; dist: number }>(
      (best, v) => { const d = haversineMetre(g.lat, g.lng, v.lat, v.lng); return d < best.dist ? { node: v, dist: d } : best; },
      { node: null, dist: Infinity }
    );
    return { ghostId: g.placeId, shopifyId: nearest.node?.placeId ?? "", proximityM: Math.round(nearest.dist) };
  }).filter((e) => e.shopifyId);
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// ─── Graph SVG dimensions ──────────────────────────────────────────────────

const GW = 700;
const GH = 520;
const GCX = GW / 2;
const GCY = GH / 2;

// ─── Component ────────────────────────────────────────────────────────────────

interface MerchantGraphProps {
  onMerchantClick?: (id: string) => void;
}

export function MerchantGraph({ onMerchantClick }: MerchantGraphProps) {
  const [graphData, setGraphData] = useState<PlacesGraph | null>(null);
  const [catalog, setCatalog] = useState<MockCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [positions, setPositions] = useState<Map<string, NodePos>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [settled, setSettled] = useState(false);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [catalogTab, setCatalogTab] = useState(0);

  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode, SimEdge>> | null>(null);

  // Fetch graph + catalog in parallel
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE_URL}/api/places-graph`).then((r) => r.json()),
      fetch(`${BASE_URL}/api/mockshop-catalog`).then((r) => r.json()).catch(() => null),
    ]).then(([g, c]) => {
      setGraphData(g as PlacesGraph);
      setCatalog(c as MockCatalog | null);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, []);

  const shadowEdges = useMemo(() => (graphData ? computeShadowEdges(graphData.nodes) : []), [graphData]);

  const shadowMap = useMemo(() => new Map(shadowEdges.map((e) => [e.ghostId, e])), [shadowEdges]);

  // d3 simulation
  useEffect(() => {
    if (!graphData?.nodes.length) return;
    setSettled(false);

    const nodes: SimNode[] = graphData.nodes.map((n, i) => {
      if (n.shopifyStatus === "verified") {
        return { ...n, x: GCX + (Math.random() - 0.5) * 40, y: GCY + (Math.random() - 0.5) * 40 };
      }
      const angle = (i / graphData.nodes.length) * 2 * Math.PI;
      const r = 160 + Math.random() * 60;
      return { ...n, x: GCX + r * Math.cos(angle), y: GCY + r * Math.sin(angle) };
    });

    const nodeById = new Map(nodes.map((n) => [n.placeId, n]));
    const verifiedSet = new Set(graphData.nodes.filter((n) => n.shopifyStatus === "verified").map((n) => n.placeId));

    const realLinks: SimEdge[] = graphData.edges
      .filter((e) => verifiedSet.has(e.sourceId) && verifiedSet.has(e.targetId))
      .map((e) => ({
        source: nodeById.get(e.sourceId)!,
        target: nodeById.get(e.targetId)!,
        score: e.score,
        proximityM: e.proximityM,
      }))
      .filter((e): e is SimEdge & { source: SimNode; target: SimNode } => !!e.source && !!e.target);

    const sim = forceSimulation<SimNode, SimEdge>(nodes)
      .force("link", forceLink<SimNode, SimEdge>(realLinks).id((d) => d.placeId).strength(0.9).distance(70))
      .force("charge", forceManyBody<SimNode>().strength((d) => (d as SimNode).shopifyStatus === "verified" ? -120 : -60))
      .force("x", forceX<SimNode>(GCX).strength((d) => (d as SimNode).shopifyStatus === "verified" ? 0.5 : 0.03))
      .force("y", forceY<SimNode>(GCY).strength((d) => (d as SimNode).shopifyStatus === "verified" ? 0.5 : 0.03))
      .force("center", forceCenter(GCX, GCY).strength(0.04))
      .force("collide", forceCollide<SimNode>().radius((d) => nodeRadius(d as PlacesNode) + 14));

    sim.on("tick", () => {
      const map = new Map<string, NodePos>();
      nodes.forEach((n) => {
        const r = nodeRadius(n);
        map.set(n.placeId, {
          id: n.placeId,
          x: Math.max(r + 6, Math.min(GW - r - 6, n.x ?? GCX)),
          y: Math.max(r + 6, Math.min(GH - r - 6, n.y ?? GCY)),
        });
      });
      setPositions(new Map(map));
    });

    sim.on("end", () => setSettled(true));
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [graphData]);

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#0a0d12" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #34d399", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Fetching Ontario merchants from Google Places…</p>
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.18)" }}>Toronto · Ottawa · Hamilton · London · Niagara</p>
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0d12" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Commerce graph unavailable</p>
      </div>
    );
  }

  const nodeMap = new Map(graphData.nodes.map((n) => [n.placeId, n]));
  const verified = graphData.nodes.filter((n) => n.shopifyStatus === "verified");
  const ghosts = graphData.nodes.filter((n) => n.shopifyStatus !== "verified");
  const cities = [...new Set(graphData.nodes.map((n) => n.city).filter(Boolean))] as string[];

  const displayedNodes = activeCity
    ? graphData.nodes.filter((n) => !n.city || n.city === activeCity)
    : graphData.nodes;

  const handleNodeEnter = (node: PlacesNode, pos: NodePos) => {
    const shadow = shadowMap.get(node.placeId);
    const nearestShopify = shadow ? nodeMap.get(shadow.shopifyId) : undefined;
    setTooltip({ node, x: pos.x, y: pos.y, nearestShopify, nearestDistM: shadow?.proximityM });
  };

  // Sidebar merchant list sorted: verified first, then by rating
  const sidebarNodes = [...graphData.nodes].sort((a, b) => {
    if (a.shopifyStatus === "verified" && b.shopifyStatus !== "verified") return -1;
    if (b.shopifyStatus === "verified" && a.shopifyStatus !== "verified") return 1;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0d12", display: "flex", overflow: "hidden" }}>

      {/* ── Left sidebar ── */}
      <div style={{
        width: 290, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Sidebar header */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>Commerce Network</p>
            <p style={{ fontSize: 8.5, color: "rgba(255,255,255,0.25)", margin: 0 }}>
              {graphData.source === "google" ? "Google Places · live" : "mock data"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 10, background: "rgba(5,150,105,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)", fontWeight: 600 }}>
              {verified.length} Shopify-verified
            </span>
            <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 10, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", fontWeight: 600 }}>
              {ghosts.length} ghost nodes
            </span>
            <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
              {graphData.edges.length} edges
            </span>
          </div>
          {/* City filter */}
          {cities.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
              <button
                onClick={() => setActiveCity(null)}
                style={{ fontSize: 7.5, padding: "1px 7px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: !activeCity ? "rgba(255,255,255,0.12)" : "transparent", color: !activeCity ? "#fff" : "rgba(255,255,255,0.35)", cursor: "pointer", fontWeight: 600 }}
              >
                All
              </button>
              {cities.map((city) => (
                <button
                  key={city}
                  onClick={() => setActiveCity(activeCity === city ? null : city)}
                  style={{ fontSize: 7.5, padding: "1px 7px", borderRadius: 8, border: `1px solid ${CITY_COLOR[city] ?? "#888"}44`, background: activeCity === city ? `${CITY_COLOR[city] ?? "#888"}22` : "transparent", color: CITY_COLOR[city] ?? "rgba(255,255,255,0.4)", cursor: "pointer", fontWeight: 600 }}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Merchant list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {sidebarNodes.map((node, i) => {
            const isVerified = node.shopifyStatus === "verified";
            const color = isVerified ? SHOPIFY_GREEN : GHOST_AMBER;
            const cityColor = node.city ? (CITY_COLOR[node.city] ?? "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.3)";
            const isActive = tooltip?.node.placeId === node.placeId;
            return (
              <div
                key={node.placeId}
                onClick={() => {
                  const pos = positions.get(node.placeId);
                  if (pos) handleNodeEnter(node, pos);
                  if (node.shopifyMerchantId) onMerchantClick?.(node.shopifyMerchantId);
                }}
                style={{
                  padding: "8px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                  transition: "background 0.15s",
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}
              >
                {/* Rank */}
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", minWidth: 14, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {/* Status dot */}
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {TYPE_EMOJI[node.type] ?? "🏪"} {truncate(node.name, 22)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 7.5, color: color, fontWeight: 600 }}>
                      {isVerified ? "Shopify" : "👻 ghost"}
                    </span>
                    <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.25)" }}>
                      {TYPE_LABEL[node.type] ?? node.type}
                    </span>
                    {node.rating != null && (
                      <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.25)" }}>★{node.rating.toFixed(1)}</span>
                    )}
                    {node.city && (
                      <span style={{ fontSize: 7, color: cityColor, fontWeight: 600 }}>{node.city}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 7, color: node.openNow === true ? "#34d399" : node.openNow === false ? "#f87171" : "rgba(255,255,255,0.2)", marginTop: 1 }}>
                    {node.openNow === true ? "Open" : node.openNow === false ? "Closed" : "—"}
                    {node.vicinity ? ` · ${node.vicinity.split(",")[0]}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mock.shop catalog panel */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, maxHeight: 220, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 16px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: 0 }}>
              🛍️ Mock.shop Catalog
            </p>
            {catalog && (
              <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.25)" }}>
                {catalog.totalProducts} products · {catalog.collectionsCount} collections
              </span>
            )}
          </div>
          {catalog ? (
            <>
              {/* Collection tabs */}
              <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "0 16px 6px", flexShrink: 0 }}>
                {catalog.collections.map((col, i) => (
                  <button
                    key={col.handle}
                    onClick={() => setCatalogTab(i)}
                    style={{ fontSize: 7.5, padding: "2px 8px", borderRadius: 8, border: `1px solid rgba(150,191,72,${catalogTab === i ? "0.4" : "0.15"})`, background: catalogTab === i ? "rgba(150,191,72,0.12)" : "transparent", color: catalogTab === i ? "#96BF48" : "rgba(255,255,255,0.3)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600, flexShrink: 0 }}
                  >
                    {col.title}
                  </button>
                ))}
              </div>
              {/* Products in active collection */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {catalog.collections[catalogTab]?.products.map((p) => (
                  <div key={p.handle} style={{ padding: "5px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", gap: 8 }}>
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt={p.title} style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 8.5, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{p.title}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 1 }}>
                        <span style={{ fontSize: 7, color: "#96BF48" }}>
                          ${p.minPrice.toFixed(0)}{p.maxPrice !== p.minPrice ? `–$${p.maxPrice.toFixed(0)}` : ""} {p.currency}
                        </span>
                        {p.productType && <span style={{ fontSize: 7, color: "rgba(255,255,255,0.25)" }}>{p.productType}</span>}
                      </div>
                      {p.tags.length > 0 && (
                        <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.2)", margin: "1px 0 0" }}>{p.tags.slice(0, 3).join(" · ")}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "6px 16px" }}>Loading Mock.shop catalog…</p>
          )}
        </div>
      </div>

      {/* ── Graph area ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Graph title strip */}
        <div style={{ padding: "10px 18px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", margin: 0 }}>
              Spatial Commerce Graph — Ontario
            </p>
            <p style={{ fontSize: 8.5, color: "rgba(255,255,255,0.25)", margin: "2px 0 0" }}>
              {displayedNodes.length} merchants · {settled ? "simulation settled" : "running…"}
              {activeCity ? ` · filtered to ${activeCity}` : " · all cities"}
            </p>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: SHOPIFY_GREEN }} />
              <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.3)" }}>Shopify — real edges</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: GHOST_AMBER, opacity: 0.72 }} />
              <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.3)" }}>Ghost — isolated</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke={GHOST_AMBER} strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.5} /></svg>
              <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.3)" }}>Shadow edge (LLM-inferred)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke={SHOPIFY_GREEN} strokeWidth={1.5} strokeOpacity={0.6} /></svg>
              <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.3)" }}>Commerce edge (verified)</span>
            </div>
          </div>
        </div>

        {/* SVG */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <svg
            width={GW} height={GH}
            viewBox={`0 0 ${GW} ${GH}`}
            style={{ width: "100%", height: "100%", display: "block" }}
            onMouseLeave={() => setTooltip(null)}
          >
            <defs>
              <filter id="glow-s"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="glow-g"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <radialGradient id="cluster-halo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Shopify cluster glow */}
            {settled && (() => {
              const vpos = verified.map((n) => positions.get(n.placeId)).filter(Boolean) as NodePos[];
              if (!vpos.length) return null;
              const cx = vpos.reduce((s, p) => s + p.x, 0) / vpos.length;
              const cy = vpos.reduce((s, p) => s + p.y, 0) / vpos.length;
              return <circle cx={cx} cy={cy} r={80} fill="url(#cluster-halo)" style={{ pointerEvents: "none" }} />;
            })()}

            {/* Real edges (Shopify↔Shopify only) */}
            {graphData.edges
              .filter((e) => {
                const s = nodeMap.get(e.sourceId), t = nodeMap.get(e.targetId);
                return s?.shopifyStatus === "verified" && t?.shopifyStatus === "verified";
              })
              .map((edge) => {
                const src = positions.get(edge.sourceId), tgt = positions.get(edge.targetId);
                if (!src || !tgt) return null;
                const dim = activeCity && nodeMap.get(edge.sourceId)?.city !== activeCity && nodeMap.get(edge.targetId)?.city !== activeCity;
                const hl = tooltip?.node.placeId === edge.sourceId || tooltip?.node.placeId === edge.targetId;
                return (
                  <line key={`${edge.sourceId}-${edge.targetId}`}
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={SHOPIFY_GREEN}
                    strokeWidth={hl ? edge.score * 4 + 1.5 : edge.score * 2.5 + 0.8}
                    strokeOpacity={dim ? 0.05 : hl ? 0.9 : 0.4}
                    style={{ transition: "stroke-opacity 0.2s" }}
                  />
                );
              })}

            {/* Shadow edges */}
            {shadowEdges.map((se) => {
              const gpos = positions.get(se.ghostId), spos = positions.get(se.shopifyId);
              if (!gpos || !spos) return null;
              const active = tooltip?.node.placeId === se.ghostId || tooltip?.node.placeId === se.shopifyId;
              const dim = activeCity && nodeMap.get(se.ghostId)?.city !== activeCity;
              return (
                <g key={`sh-${se.ghostId}`}>
                  <line
                    x1={gpos.x} y1={gpos.y} x2={spos.x} y2={spos.y}
                    stroke={GHOST_AMBER} strokeWidth={active ? 1.2 : 0.7}
                    strokeOpacity={dim ? 0.04 : active ? 0.6 : 0.15}
                    strokeDasharray="4 5"
                    style={{ transition: "stroke-opacity 0.2s" }}
                  />
                  {active && (
                    <text x={(gpos.x + spos.x) / 2} y={(gpos.y + spos.y) / 2 - 5}
                      textAnchor="middle" fontSize={6.5} fill={GHOST_AMBER} fillOpacity={0.7} fontWeight="600" letterSpacing={0.3}
                      style={{ pointerEvents: "none", userSelect: "none" }}>
                      SHADOW EDGE · {(se.proximityM / 1000).toFixed(1)}km
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {graphData.nodes.map((node) => {
              const pos = positions.get(node.placeId);
              if (!pos) return null;
              const r = nodeRadius(node);
              const isVerified = node.shopifyStatus === "verified";
              const isHovered = tooltip?.node.placeId === node.placeId;
              const color = isVerified ? SHOPIFY_GREEN : GHOST_AMBER;
              const dimmed = activeCity && node.city && node.city !== activeCity;
              const cityColor = node.city ? (CITY_COLOR[node.city] ?? "rgba(255,255,255,0.3)") : undefined;
              const label = truncate(node.name.split(" ")[0], 10);

              return (
                <g key={node.placeId} transform={`translate(${pos.x},${pos.y})`}
                  style={{ cursor: "pointer", opacity: dimmed ? 0.2 : 1, transition: "opacity 0.2s" }}
                  onMouseEnter={() => handleNodeEnter(node, pos)}
                  onClick={() => { if (node.shopifyMerchantId) onMerchantClick?.(node.shopifyMerchantId); }}>

                  {isHovered && <circle r={r + 10} fill={color} fillOpacity={0.1} stroke={color} strokeWidth={0.8} strokeOpacity={0.3} filter={isVerified ? "url(#glow-s)" : "url(#glow-g)"} />}
                  {!isVerified && <circle r={r + 5} fill="none" stroke={GHOST_AMBER} strokeWidth={0.6} strokeOpacity={0.2} strokeDasharray="2 4" />}

                  {/* City ring */}
                  {cityColor && (
                    <circle r={r + 2} fill="none" stroke={cityColor} strokeWidth={1} strokeOpacity={isVerified ? 0.5 : 0.3} />
                  )}

                  <circle r={r}
                    fill={color}
                    fillOpacity={node.openNow === false ? 0.3 : isVerified ? 1 : 0.75}
                    stroke={isHovered ? "#fff" : isVerified ? "rgba(52,211,153,0.5)" : "rgba(245,158,11,0.3)"}
                    strokeWidth={isHovered ? 1.5 : 0.8}
                    filter={isVerified && !dimmed ? "url(#glow-s)" : undefined}
                  />

                  {/* Emoji */}
                  <text textAnchor="middle" dominantBaseline="middle" fontSize={r * 0.78} style={{ pointerEvents: "none", userSelect: "none" }}>
                    {!isVerified ? "👻" : (TYPE_EMOJI[node.type] ?? "🏪")}
                  </text>

                  {/* Name label below node */}
                  <text
                    y={r + 10} textAnchor="middle" fontSize={7.5} fill={isVerified ? "#34d399" : "rgba(245,158,11,0.8)"}
                    fontWeight={isVerified ? "700" : "500"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {label}
                  </text>

                  {/* Shopify S badge */}
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

          {/* Tooltip */}
          {tooltip && (() => {
            const { node, x: nx, y: ny, nearestShopify, nearestDistM } = tooltip;
            const isVerified = node.shopifyStatus === "verified";
            const color = isVerified ? SHOPIFY_GREEN : GHOST_AMBER;
            // position tooltip relative to the SVG rendered dimensions
            const svgEl = document.querySelector("svg[viewBox]") as SVGSVGElement | null;
            const sw = svgEl?.clientWidth ?? GW;
            const sh = svgEl?.clientHeight ?? GH;
            const scaleX = sw / GW;
            const scaleY = sh / GH;
            const px = nx * scaleX;
            const py = ny * scaleY;
            const tipX = px > sw * 0.65 ? px - 190 : px + 22;
            const tipY = Math.max(8, Math.min(sh - 220, py - 30));

            return (
              <div style={{
                position: "absolute", left: tipX, top: tipY, zIndex: 30,
                background: "rgba(10,13,18,0.98)", border: `1px solid ${color}44`,
                borderRadius: 10, padding: "10px 12px", minWidth: 168, maxWidth: 200,
                boxShadow: `0 8px 28px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
                pointerEvents: "none",
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1.3 }}>
                  {TYPE_EMOJI[node.type] ?? "🏪"} {node.name}
                </p>
                <p style={{ fontSize: 8.5, color: "rgba(255,255,255,0.35)", margin: "0 0 6px" }}>
                  {TYPE_LABEL[node.type] ?? node.type}
                  {node.city ? ` · ${node.city}` : ""}
                  {node.rating != null ? ` · ★${node.rating.toFixed(1)} (${node.userRatingsTotal})` : ""}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 8.5, color, fontWeight: 700 }}>
                    {isVerified ? "Connected to commerce graph" : "Orphaned — not on Shopify"}
                  </span>
                </div>

                {!isVerified && nearestShopify && (
                  <div style={{ background: "rgba(245,158,11,0.07)", border: "1px dashed rgba(245,158,11,0.25)", borderRadius: 7, padding: "6px 8px", marginBottom: 6 }}>
                    <p style={{ fontSize: 7.5, color: GHOST_AMBER, fontWeight: 700, margin: "0 0 2px", letterSpacing: 0.3 }}>SHADOW EDGE</p>
                    <p style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.4 }}>
                      {(nearestDistM! / 1000).toFixed(1)}km from <strong>{nearestShopify.name}</strong>. Co-visit inferred — no real edge without Shopify inventory.
                    </p>
                  </div>
                )}

                {!isVerified && (
                  <div style={{ background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 7, padding: "6px 8px" }}>
                    <p style={{ fontSize: 7.5, color: "#34d399", fontWeight: 700, margin: "0 0 2px", letterSpacing: 0.3 }}>BRIDGE TRANSACTION</p>
                    <p style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.4 }}>
                      Agents route shoppers past this merchant. No Shopify = no edge = no revenue captured.
                    </p>
                  </div>
                )}

                {isVerified && (
                  <p style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5 }}>
                    Real-time inventory edges. AI agents can query stock, trigger purchase, verify checkout.
                  </p>
                )}

                <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                  {node.openNow === true ? "🟢 Open now" : node.openNow === false ? "🔴 Closed" : "Hours unknown"}
                  {node.vicinity ? ` · ${node.vicinity.split(",")[0]}` : ""}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
