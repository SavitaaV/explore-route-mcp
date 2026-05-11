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
import { useGetMerchantGraph } from "@workspace/api-client-react";
import type { MerchantNode, MerchantEdge } from "@workspace/api-client-react";

const TYPE_COLOR: Record<string, string> = {
  winery:     "#7c3aed",
  bakery:     "#d97706",
  cafe:       "#dc2626",
  restaurant: "#059669",
  artisan:    "#2563eb",
  boutique:   "#db2777",
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

interface SimNode extends SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  rating: number | null;
  photoUrl?: string | null;
  topTags: string[];
  avgPrice?: number | null;
}

interface SimEdge extends SimulationLinkDatum<SimNode> {
  similarityScore: number;
  sharedTags: string[];
}

interface NodePos {
  id: string;
  x: number;
  y: number;
}

interface TooltipData {
  node: SimNode;
  x: number;
  y: number;
  topConnections: Array<{ name: string; score: number; sharedTags: string[] }>;
}

function nodeRadius(rating: number | null) {
  return rating != null ? 12 + (rating - 4.0) * 6 : 12;
}

interface MerchantGraphProps {
  onMerchantClick?: (id: string) => void;
}

export function MerchantGraph({ onMerchantClick }: MerchantGraphProps) {
  const { data, isLoading, isError } = useGetMerchantGraph({ minSimilarity: 0.25 });

  const [positions, setPositions] = useState<Map<string, NodePos>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [settled, setSettled] = useState(false);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode, SimEdge>> | null>(null);

  useEffect(() => {
    if (!data?.nodes.length) return;

    setSettled(false);
    const nodes: SimNode[] = data.nodes.map((n: MerchantNode) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H / 2 + (Math.random() - 0.5) * 120,
    }));

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const links: SimEdge[] = data.edges
      .map((e: MerchantEdge) => ({
        source: nodeById.get(e.sourceId)!,
        target: nodeById.get(e.targetId)!,
        similarityScore: e.similarityScore,
        sharedTags: e.sharedTags,
      }))
      .filter((e): e is SimEdge & { source: SimNode; target: SimNode } => !!e.source && !!e.target);

    const sim = forceSimulation<SimNode, SimEdge>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(links)
          .id((d) => d.id)
          .strength((d) => d.similarityScore * 0.5)
          .distance((d) => 110 - d.similarityScore * 40)
      )
      .force("charge", forceManyBody<SimNode>().strength(-220))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius((d) => nodeRadius(d.rating) + 8));

    sim.on("tick", () => {
      const map = new Map<string, NodePos>();
      nodes.forEach((n) => {
        const r = nodeRadius(n.rating);
        map.set(n.id, {
          id: n.id,
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

  if (isLoading) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #34d399", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Computing similarity graph…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Graph unavailable</p>
      </div>
    );
  }

  const nodeMap = new Map(data.nodes.map((n: MerchantNode) => [n.id, n]));
  const edgesByNodeId = new Map<string, MerchantEdge[]>();
  data.edges.forEach((e: MerchantEdge) => {
    if (!edgesByNodeId.has(e.sourceId)) edgesByNodeId.set(e.sourceId, []);
    if (!edgesByNodeId.has(e.targetId)) edgesByNodeId.set(e.targetId, []);
    edgesByNodeId.get(e.sourceId)!.push(e);
    edgesByNodeId.get(e.targetId)!.push(e);
  });

  const handleNodeHover = (node: MerchantNode, pos: NodePos) => {
    const edges = edgesByNodeId.get(node.id) ?? [];
    const topConnections = edges
      .map((e) => {
        const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
        const other = nodeMap.get(otherId);
        return other ? { name: other.name, score: e.similarityScore, sharedTags: e.sharedTags } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    setTooltip({
      node: node as unknown as SimNode,
      x: pos.x,
      y: pos.y,
      topConnections,
    });
  };

  return (
    <div style={{ width: "100%", height: "100%", background: "#0d1017", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "10px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", margin: 0 }}>Co-purchase Similarity Graph</p>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", margin: 0, marginTop: 1 }}>
            {data.nodes.length} merchants · {data.edges.length} connections · powered by Mock.shop
          </p>
        </div>
        {settled && (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
        )}
      </div>

      {/* SVG graph */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg
          width={W}
          height={H}
          style={{ display: "block", width: "100%", height: "100%" }}
          viewBox={`0 0 ${W} ${H}`}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <filter id="glow-g">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {data.edges.map((edge: MerchantEdge) => {
            const src = positions.get(edge.sourceId);
            const tgt = positions.get(edge.targetId);
            if (!src || !tgt) return null;
            const color = tooltip &&
              (tooltip.node.id === edge.sourceId || tooltip.node.id === edge.targetId)
              ? "#34d399"
              : "rgba(255,255,255,0.15)";
            return (
              <line
                key={`${edge.sourceId}-${edge.targetId}`}
                x1={src.x} y1={src.y}
                x2={tgt.x} y2={tgt.y}
                stroke={color}
                strokeWidth={edge.similarityScore * 3.5 + 0.5}
                strokeOpacity={tooltip ? (tooltip.node.id === edge.sourceId || tooltip.node.id === edge.targetId ? 0.9 : 0.08) : edge.similarityScore * 0.7 + 0.15}
                style={{ transition: "stroke-opacity 0.2s, stroke 0.2s" }}
              />
            );
          })}

          {/* Nodes */}
          {data.nodes.map((node: MerchantNode) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const r = nodeRadius(node.rating);
            const color = TYPE_COLOR[node.type] ?? "#6b7280";
            const isHovered = tooltip?.node.id === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => onMerchantClick?.(node.id)}
                onMouseEnter={() => handleNodeHover(node, pos)}
              >
                {isHovered && (
                  <circle r={r + 8} fill={color} opacity={0.18} filter="url(#glow-g)" />
                )}
                <circle
                  r={r}
                  fill={color}
                  stroke={isHovered ? "#fff" : "rgba(255,255,255,0.2)"}
                  strokeWidth={isHovered ? 2 : 1}
                  filter={isHovered ? "url(#glow-g)" : undefined}
                  style={{ transition: "r 0.15s" }}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={r * 0.85}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {TYPE_EMOJI[node.type] ?? "🏪"}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (() => {
          const tipX = tooltip.x > W * 0.65 ? tooltip.x - 148 : tooltip.x + 18;
          const tipY = Math.max(8, Math.min(H - 140, tooltip.y - 20));
          return (
            <div style={{
              position: "absolute",
              left: tipX,
              top: tipY,
              background: "rgba(15,17,28,0.96)",
              border: `1px solid ${TYPE_COLOR[tooltip.node.type] ?? "#444"}`,
              borderRadius: 10,
              padding: "8px 10px",
              pointerEvents: "none",
              zIndex: 20,
              minWidth: 140,
              maxWidth: 160,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>
                {TYPE_EMOJI[tooltip.node.type]} {tooltip.node.name}
              </p>
              <p style={{ fontSize: 9, color: TYPE_COLOR[tooltip.node.type] ?? "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {TYPE_LABEL[tooltip.node.type] ?? tooltip.node.type}
                {tooltip.node.rating != null ? ` · ★ ${tooltip.node.rating.toFixed(1)}` : ""}
              </p>
              {tooltip.node.topTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                  {tooltip.node.topTags.slice(0, 3).map((t) => (
                    <span key={t} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 20, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {tooltip.topConnections.length > 0 && (
                <>
                  <p style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", margin: "0 0 4px", letterSpacing: 0.5, textTransform: "uppercase" }}>Pairs well with</p>
                  {tooltip.topConnections.map((c) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name.split(" ").slice(0, 2).join(" ")}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#34d399", flexShrink: 0 }}>
                        {Math.round(c.score * 100)}%
                      </span>
                    </div>
                  ))}
                </>
              )}
              <p style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", margin: "6px 0 0", fontStyle: "italic" }}>Click to open merchant card</p>
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      <div style={{ padding: "6px 12px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
          {Object.entries(TYPE_COLOR).map(([type, color]) => {
            const hasNode = data.nodes.some((n: MerchantNode) => n.type === type);
            if (!hasNode) return null;
            return (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>{TYPE_LABEL[type]}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 18, height: 2, background: "linear-gradient(to right, rgba(255,255,255,0.2), rgba(255,255,255,0.7))", borderRadius: 1 }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Edge = similarity</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
            </div>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Size = rating</span>
          </div>
        </div>
      </div>
    </div>
  );
}
