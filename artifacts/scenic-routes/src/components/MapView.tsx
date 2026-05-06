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
}

declare global {
  interface Window {
    google: typeof google;
    initGoogleMap?: () => void;
  }
}

const NIAGARA_ROUTE_WAYPOINTS = [
  { lat: 43.6532, lng: -79.3832 }, // Toronto
  { lat: 43.5553, lng: -79.6317 }, // Mississauga
  { lat: 43.2557, lng: -79.8711 }, // Hamilton
  { lat: 43.1701, lng: -79.5637 }, // Grimsby
  { lat: 43.1167, lng: -79.2167 }, // Beamsville
  { lat: 43.2553, lng: -79.0712 }, // Queenston Heights
  { lat: 43.1594, lng: -79.0678 }, // Niagara-on-the-Lake
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
}: {
  merchants: Merchant[];
  selectedMerchantId: string | null;
  onPinClick: (id: string) => void;
  journeyProgress: number;
  journeyStarted: boolean;
  route: MapViewProps["route"];
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Map real lat/lng to SVG coords
  const mapToSVG = (lat: number, lng: number) => {
    const minLat = 43.1, maxLat = 43.75;
    const minLng = -79.95, maxLng = -79.0;
    const x = ((lng - minLng) / (maxLng - minLng)) * 760 + 20;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 460 + 20;
    return { x, y };
  };

  const routePoints = NIAGARA_ROUTE_WAYPOINTS.map((wp) => mapToSVG(wp.lat, wp.lng));
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

        {/* Lake Ontario suggestion */}
        <ellipse cx="630" cy="80" rx="180" ry="60" fill="rgba(59,130,246,0.15)" />
        <text x="590" y="75" fill="rgba(147,197,253,0.5)" fontSize="11" fontFamily="sans-serif">Lake Ontario</text>

        {/* Niagara River */}
        <path d="M 740 100 Q 745 250 740 420" stroke="rgba(59,130,246,0.3)" strokeWidth="8" fill="none" strokeLinecap="round" />

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

        {/* City labels */}
        {NIAGARA_ROUTE_WAYPOINTS.map((wp, i) => {
          if (i !== 0 && i !== NIAGARA_ROUTE_WAYPOINTS.length - 1) return null;
          const { x, y } = mapToSVG(wp.lat, wp.lng);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill="white" opacity="0.8" />
              <text x={x + 8} y={y + 4} fill="rgba(255,255,255,0.8)" fontSize="10" fontFamily="sans-serif" fontWeight="600">
                {i === 0 ? "Toronto" : "Niagara-on-the-Lake"}
              </text>
            </g>
          );
        })}

        {/* Car marker */}
        {journeyStarted && carX && carY && (
          <g transform={`translate(${carX - 12}, ${carY - 10})`}>
            <rect width="24" height="14" rx="4" fill="#FCD34D" />
            <rect x="3" y="2" width="7" height="5" rx="1" fill="rgba(0,0,0,0.3)" />
            <rect x="14" y="2" width="7" height="5" rx="1" fill="rgba(0,0,0,0.3)" />
            <circle cx="5" cy="14" r="3" fill="#1F2937" />
            <circle cx="19" cy="14" r="3" fill="#1F2937" />
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
      </svg>

      {/* Route info card */}
      {route && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full flex items-center gap-3 border border-white/10">
          <span className="font-semibold">{route.distanceKm}km</span>
          <span className="text-white/40">•</span>
          <span>{route.durationMinutes} min</span>
          <span className="text-white/40">•</span>
          <span className="text-green-400">Highways avoided</span>
        </div>
      )}

      {/* API key notice */}
      <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white/70 text-[10px] px-3 py-1.5 rounded-lg border border-white/10 max-w-[200px]">
        Add <code className="text-amber-400">GOOGLE_MAPS_API_KEY</code> secret to enable live Google Maps
      </div>
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
}: {
  merchants: Merchant[];
  selectedMerchantId: string | null;
  onPinClick: (id: string) => void;
  journeyProgress: number;
  journeyStarted: boolean;
  route: MapViewProps["route"];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 43.3, lng: -79.3 },
      zoom: 9,
      mapTypeId: "terrain",
      disableDefaultUI: false,
      styles: [
        { featureType: "highway", elementType: "geometry", stylers: [{ visibility: "off" }] },
        { featureType: "road.highway", elementType: "all", stylers: [{ saturation: -100 }] },
      ],
    });
    mapInstanceRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !route) return;
    if (polylineRef.current) polylineRef.current.setMap(null);
    const path = window.google.maps.geometry?.encoding?.decodePath(route.encodedPolyline) ??
      NIAGARA_ROUTE_WAYPOINTS.map((wp) => ({ lat: wp.lat, lng: wp.lng }));
    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#34D399",
      strokeOpacity: 1,
      strokeWeight: 4,
      map: mapInstanceRef.current,
    });
  }, [route]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !merchants.length) return;
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    merchants.forEach((merchant) => {
      const el = document.createElement("div");
      el.innerHTML = getMerchantTypeIcon(merchant.type);
      el.style.cssText = `font-size:20px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));transition:transform 0.2s;`;
      el.addEventListener("mouseenter", () => (el.style.transform = "scale(1.3)"));
      el.addEventListener("mouseleave", () => (el.style.transform = "scale(1)"));
      el.addEventListener("click", () => onPinClick(merchant.id));
      // fallback if AdvancedMarkerElement not available
      if (window.google.maps.marker?.AdvancedMarkerElement) {
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: merchant.lat, lng: merchant.lng },
          map: mapInstanceRef.current,
          content: el,
          title: merchant.name,
        });
        markersRef.current.push(marker);
      }
    });
  }, [merchants, onPinClick]);

  return <div ref={mapRef} className="w-full h-full" />;
}

export function MapView({ route, merchants, journeyProgress, journeyStarted, selectedMerchantId, onPinClick, isLoading }: MapViewProps) {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey || window.google) return;
    window.initGoogleMap = () => setMapsLoaded(true);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,marker&callback=initGoogleMap`;
    script.async = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
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

  if (apiKey && mapsLoaded) {
    return (
      <GoogleMapComponent
        merchants={merchants}
        selectedMerchantId={selectedMerchantId}
        onPinClick={onPinClick}
        journeyProgress={journeyProgress}
        journeyStarted={journeyStarted}
        route={route}
      />
    );
  }

  return (
    <SvgMapPlaceholder
      merchants={merchants}
      selectedMerchantId={selectedMerchantId}
      onPinClick={onPinClick}
      journeyProgress={journeyProgress}
      journeyStarted={journeyStarted}
      route={route}
    />
  );
}
