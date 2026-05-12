import { useEffect, useRef, useState } from "react";
import { MapPin, Grape, Coffee, Wheat, FlaskConical } from "lucide-react";

type Waypoint = { lat: number; lng: number; name: string | null };
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

interface DiscoveryMerchant {
  placeId: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  vicinity: string;
  rating: number | null;
  shopifyStatus: "verified" | "ghost";
  isEvent: boolean;
  distanceFromStartKm: number;
  checkoutUrl?: string | null;
}

interface DiscoveryRouteData {
  intent: string;
  resolvedLocation: { lat: number; lng: number; name: string };
  merchants: DiscoveryMerchant[];
  totalDistanceKm: number;
  estimatedWalkMinutes: number;
  source: "google" | "mock";
}

interface MapViewProps {
  route: {
    encodedPolyline: string;
    distanceKm: number;
    durationMinutes: number;
    waypoints: Waypoint[];
    summary: string;
    mapUrl: string;
  } | null;
  merchants: Merchant[];
  journeyProgress: number;
  journeyStarted: boolean;
  selectedMerchantId: string | null;
  onPinClick: (id: string) => void;
  isLoading: boolean;
  routeRequested?: boolean;
  discoveryRoute?: DiscoveryRouteData | null;
}

declare global {
  interface Window {
    google: typeof google;
    initGoogleMap?: () => void;
  }
}

// Fallback waypoints — two generic points so the SVG path has something to render
// before any real route arrives; replaced immediately once route data loads
const FALLBACK_WAYPOINTS = [
  { lat: 0.001, lng: 0 },
  { lat: 0, lng: 0.001 },
  { lat: -0.001, lng: 0 },
];

function getMerchantTypeIcon(type: string) {
  switch (type) {
    case "winery": return "🍷";
    case "bakery": return "🥐";
    case "brewery": return "🍺";
    case "cafe": return "☕";
    default: return "🛍️";
  }
}

function getMerchantTypeColor(type: string) {
  switch (type) {
    case "winery": return "#7C3AED";
    case "bakery": return "#D97706";
    case "brewery": return "#059669";
    case "cafe": return "#DC2626";
    default: return "#1D4ED8";
  }
}

// SVG placeholder map when no API key
function SvgMapPlaceholder({
  merchants,
  selectedMerchantId,
  onPinClick,
  journeyProgress,
  journeyStarted,
  route,
  discoveryRoute,
}: {
  merchants: Merchant[];
  selectedMerchantId: string | null;
  onPinClick: (id: string) => void;
  journeyProgress: number;
  journeyStarted: boolean;
  route: MapViewProps["route"];
  discoveryRoute?: DiscoveryRouteData | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Use route waypoints if available, otherwise the minimal fallback
  const sourceWaypoints = (route?.waypoints?.length ? route.waypoints : FALLBACK_WAYPOINTS);

  // Map real lat/lng to SVG coords dynamically based on the actual waypoints
  const lats = sourceWaypoints.map((w) => w.lat);
  const lngs = sourceWaypoints.map((w) => w.lng);
  const pad = 0.005;
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;

  const mapToSVG = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * 760 + 20;
    const y = ((maxLat - lat) / (maxLat - minLat || 1)) * 460 + 20;
    return { x, y };
  };

  const routePoints = sourceWaypoints.map((wp) => mapToSVG(wp.lat, wp.lng));
  const pathD = routePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Car position along path
  const carIndex = Math.min(Math.floor(journeyProgress * (routePoints.length - 1)), routePoints.length - 2);
  const segProgress = (journeyProgress * (routePoints.length - 1)) % 1;
  const carX = routePoints[carIndex]?.x + (routePoints[carIndex + 1]?.x - routePoints[carIndex]?.x) * segProgress;
  const carY = routePoints[carIndex]?.y + (routePoints[carIndex + 1]?.y - routePoints[carIndex]?.y) * segProgress;

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        viewBox="0 0 800 500"
        className="w-full h-full"
        style={{ background: "linear-gradient(135deg, #1a3d2b 0%, #2d5a3d 40%, #1e4a35 70%, #153322 100%)" }}
      >
        {/* Terrain texture */}
        <defs>
          <pattern id="terrain" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.03)" />
            <circle cx="30" cy="25" r="1" fill="rgba(255,255,255,0.02)" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <rect width="800" height="500" fill="url(#terrain)" />

        {/* Scenic route — dashed background */}
        <path d={pathD} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Animated route line */}
        <path
          d={pathD}
          stroke="url(#routeGrad)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          className="animate-draw-path"
        />

        {/* Journey progress overlay */}
        {journeyStarted && (
          <path
            d={pathD}
            stroke="rgba(251,191,36,0.9)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${journeyProgress * 1200} 1200`}
          />
        )}

        {/* Route waypoint dots — derived from actual route, no hardcoded labels */}
        {routePoints.filter((_, i) => i % Math.max(1, Math.floor(routePoints.length / 4)) === 0).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" opacity="0.5" />
        ))}

        {/* Walker marker */}
        {journeyStarted && carX && carY && (
          <g transform={`translate(${carX - 10}, ${carY - 22})`}>
            <circle cx="10" cy="5" r="5" fill="#FCD34D" stroke="white" strokeWidth="1.5" />
            <path d="M10 10 L7 22 M10 10 L13 22 M7 14 L13 14" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* Merchant pins */}
        {merchants.map((merchant) => {
          const { x, y } = mapToSVG(merchant.lat, merchant.lng);
          const isSelected = merchant.id === selectedMerchantId;
          const color = getMerchantTypeColor(merchant.type);
          return (
            <g
              key={merchant.id}
              transform={`translate(${x - 14}, ${y - 28})`}
              style={{ cursor: "pointer" }}
              onClick={() => onPinClick(merchant.id)}
            >
              {isSelected && (
                <circle cx="14" cy="14" r="20" fill={color} opacity="0.2" className="animate-pin" />
              )}
              <path
                d="M14 0C8.48 0 4 4.48 4 10c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
                fill={isSelected ? color : `${color}CC`}
                stroke="white"
                strokeWidth="1.5"
              />
              <text x="14" y="13" textAnchor="middle" fontSize="8" dominantBaseline="middle">
                {getMerchantTypeIcon(merchant.type)}
              </text>
            </g>
          );
        })}

        {/* Discovery route overlay */}
        {discoveryRoute && discoveryRoute.merchants.length > 1 && (() => {
          const pts = discoveryRoute.merchants.map((m) => mapToSVG(m.lat, m.lng));
          const dPath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          return (
            <g>
              <path d={dPath} stroke="rgba(99,102,241,0.5)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d={dPath} stroke="#6366f1" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 5" />
              {discoveryRoute.merchants.map((m, i) => {
                const { x, y } = mapToSVG(m.lat, m.lng);
                const color = m.shopifyStatus === "verified" ? "#059669" : "#d97706";
                const emoji = m.isEvent ? "🎪" : (m.type === "winery" ? "🍷" : m.type === "bakery" ? "🥐" : m.type === "cafe" ? "☕" : "🏪");
                return (
                  <g key={`dr-${m.placeId}-${i}`} transform={`translate(${x - 11}, ${y - 22})`}>
                    <path d="M11 0C6.58 0 3 3.58 3 8c0 6 8 14 8 14s8-8 8-14c0-4.42-3.58-8-8-8z" fill={color} stroke="white" strokeWidth="1.5" />
                    <text x="11" y="10" textAnchor="middle" fontSize="7" dominantBaseline="middle">{emoji}</text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>

      {/* Route info card — compact for phone frame */}
      {route && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white rounded-full border border-white/10 whitespace-nowrap" style={{ fontSize: 10, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>{route.distanceKm}km</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{route.durationMinutes}min</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span style={{ color: "#34d399", fontWeight: 600 }}>{route.summary || "Scenic route"}</span>
        </div>
      )}
    </div>
  );
}

// Google Maps component
function GoogleMapComponent({
  merchants,
  selectedMerchantId,
  onPinClick,
  journeyProgress,
  journeyStarted,
  route,
  discoveryRoute,
}: {
  merchants: Merchant[];
  selectedMerchantId: string | null;
  onPinClick: (id: string) => void;
  journeyProgress: number;
  journeyStarted: boolean;
  route: MapViewProps["route"];
  discoveryRoute?: DiscoveryRouteData | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const discoveryPolylineRef = useRef<google.maps.Polyline | null>(null);
  const discoveryMarkersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    // Default: Canada overview — zoom in once a route loads
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 56.1304, lng: -106.3468 },
      zoom: 4,
      mapTypeId: "roadmap",
      disableDefaultUI: false,
    });
    mapInstanceRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !route) return;
    if (polylineRef.current) polylineRef.current.setMap(null);

    const path: google.maps.LatLngLiteral[] =
      window.google.maps.geometry?.encoding
        ? window.google.maps.geometry.encoding.decodePath(route.encodedPolyline).map((p) => ({
            lat: p.lat(),
            lng: p.lng(),
          }))
        : (route.waypoints.length > 0
            ? route.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }))
            : FALLBACK_WAYPOINTS.map((wp) => ({ lat: wp.lat, lng: wp.lng })));

    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#34D399",
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: mapInstanceRef.current,
    });

    // Fit the map to the route bounds
    if (path.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      mapInstanceRef.current.fitBounds(bounds, { top: 48, bottom: 24, left: 16, right: 16 });
    }
  }, [route]);

  // Discovery route polyline + pins
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    // Clear old discovery overlays
    if (discoveryPolylineRef.current) { discoveryPolylineRef.current.setMap(null); discoveryPolylineRef.current = null; }
    discoveryMarkersRef.current.forEach((m) => m.setMap(null));
    discoveryMarkersRef.current = [];

    if (!discoveryRoute || discoveryRoute.merchants.length === 0) return;

    const path = discoveryRoute.merchants.map((m) => ({ lat: m.lat, lng: m.lng }));
    discoveryPolylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#6366f1",
      strokeOpacity: 0.85,
      strokeWeight: 4,
      map: mapInstanceRef.current,
      icons: [{
        icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
        offset: "0",
        repeat: "20px",
      }],
    });

    // Pins for discovery merchants
    discoveryRoute.merchants.forEach((m) => {
      const emoji = m.isEvent ? "🎪" : (m.type === "winery" ? "🍷" : m.type === "bakery" ? "🥐" : m.type === "cafe" ? "☕" : "🏪");
      const color = m.shopifyStatus === "verified" ? "#059669" : "#d97706";
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">
        <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter>
        <path d="M18 2C10.27 2 4 8.27 4 16C4 26 18 40 18 40C18 40 32 26 32 16C32 8.27 25.73 2 18 2Z"
          fill="${color}" stroke="white" stroke-width="2" filter="url(#s)"/>
        <text x="18" y="20" text-anchor="middle" dominant-baseline="middle" font-size="12">${emoji}</text>
      </svg>`;
      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapInstanceRef.current,
        title: m.name,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgIcon),
          scaledSize: new window.google.maps.Size(36, 42),
          anchor: new window.google.maps.Point(18, 42),
        },
      });
      discoveryMarkersRef.current.push(marker);
    });

    // Re-center map to discovery route bounds
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    mapInstanceRef.current.fitBounds(bounds, { top: 56, bottom: 32, left: 24, right: 24 });
  }, [discoveryRoute]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !merchants.length) return;
    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    merchants.forEach((merchant) => {
      const emoji = getMerchantTypeIcon(merchant.type);
      const color = getMerchantTypeColor(merchant.type);
      const isSelected = merchant.id === selectedMerchantId;

      // Custom SVG icon — avoids AdvancedMarkerElement (needs Map ID) and
      // suppresses the google.maps.Marker deprecation noise with a proper icon
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
        <path d="M20 2C11.16 2 4 9.16 4 18C4 30 20 46 20 46C20 46 36 30 36 18C36 9.16 28.84 2 20 2Z"
          fill="${color}" stroke="white" stroke-width="2" filter="url(#s)"/>
        <text x="20" y="22" text-anchor="middle" dominant-baseline="middle" font-size="${isSelected ? 14 : 13}">
          ${emoji}
        </text>
      </svg>`;

      const marker = new window.google.maps.Marker({
        position: { lat: merchant.lat, lng: merchant.lng },
        map: mapInstanceRef.current,
        title: merchant.name,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgIcon),
          scaledSize: new window.google.maps.Size(isSelected ? 48 : 40, isSelected ? 58 : 48),
          anchor: new window.google.maps.Point(isSelected ? 24 : 20, isSelected ? 58 : 48),
        },
      });

      marker.addListener("click", () => onPinClick(merchant.id));
      markersRef.current.push(marker);
    });
  }, [merchants, selectedMerchantId, onPinClick]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {discoveryRoute && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white rounded-full border border-indigo-400/30 z-10 pointer-events-none whitespace-nowrap" style={{ fontSize: 10, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#818cf8" }}>✦</span>
          <span style={{ fontWeight: 700 }}>{discoveryRoute.intent}</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{discoveryRoute.merchants.length} stops</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span style={{ color: "#34d399", fontWeight: 600 }}>{discoveryRoute.estimatedWalkMinutes}min</span>
        </div>
      )}
      {!discoveryRoute && route && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white rounded-full border border-white/10 z-10 pointer-events-none whitespace-nowrap" style={{ fontSize: 10, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>{route.distanceKm}km</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{route.durationMinutes}min</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span style={{ color: "#34d399", fontWeight: 600 }}>{route.summary || "Scenic route"}</span>
        </div>
      )}
    </div>
  );
}

export function MapView({ route, merchants, journeyProgress, journeyStarted, selectedMerchantId, onPinClick, isLoading, discoveryRoute }: MapViewProps) {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey) return;
    // Already loaded
    if (window.google?.maps) { setMapsLoaded(true); return; }

    window.initGoogleMap = () => setMapsLoaded(true);

    const script = document.createElement("script");
    // Use loading=async as recommended by Google
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async&callback=initGoogleMap`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setMapsError(true);
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
      delete window.initGoogleMap;
    };
  }, [apiKey]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-primary/10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading scenic route...</p>
        </div>
      </div>
    );
  }

  if (apiKey && mapsLoaded && !mapsError) {
    return (
      <GoogleMapComponent
        merchants={merchants}
        selectedMerchantId={selectedMerchantId}
        onPinClick={onPinClick}
        journeyProgress={journeyProgress}
        journeyStarted={journeyStarted}
        route={route}
        discoveryRoute={discoveryRoute}
      />
    );
  }

  // Fallback: SVG map (no key, or key error)
  return (
    <SvgMapPlaceholder
      merchants={merchants}
      selectedMerchantId={selectedMerchantId}
      onPinClick={onPinClick}
      journeyProgress={journeyProgress}
      journeyStarted={journeyStarted}
      route={route}
      discoveryRoute={discoveryRoute}
    />
  );
}
