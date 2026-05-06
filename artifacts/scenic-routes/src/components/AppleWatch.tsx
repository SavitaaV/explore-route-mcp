import { useState, useEffect } from "react";

interface AppleWatchProps {
  alert: { name: string; type: string } | null;
  progress: number;
}

function useTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function typeEmoji(type: string) {
  switch (type) {
    case "winery": return "🍷";
    case "bakery": return "🥐";
    case "brewery": return "🍺";
    default: return "🛍️";
  }
}

export function AppleWatch({ alert, progress }: AppleWatchProps) {
  const time = useTime();
  const [isAlerting, setIsAlerting] = useState(false);
  const [shownAlert, setShownAlert] = useState<{ name: string; type: string } | null>(null);

  useEffect(() => {
    if (alert) {
      setIsAlerting(true);
      setShownAlert(alert);
      const timer = setTimeout(() => setIsAlerting(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const steps = Math.round(progress * 8430);
  const kmDisplay = (progress * 130).toFixed(1);

  return (
    <div className="select-none" style={{ width: 140, filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.5))" }}>
      {/* Watch body */}
      <div
        style={{
          width: 140,
          height: 168,
          borderRadius: 38,
          background: "linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)",
          border: "2px solid #3a3a3a",
          position: "relative",
          overflow: "hidden",
        }}
        className={isAlerting ? "animate-haptic" : ""}
      >
        {/* Screen */}
        <div
          style={{
            position: "absolute",
            inset: "8px",
            borderRadius: 30,
            background: isAlerting
              ? "linear-gradient(145deg, #1a1200 0%, #0d0800 100%)"
              : "linear-gradient(145deg, #0a0a0a 0%, #050505 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.3s ease",
            overflow: "hidden",
          }}
          className={isAlerting ? "watch-alert-glow" : ""}
        >
          {isAlerting && shownAlert ? (
            /* Alert screen */
            <div style={{ textAlign: "center", padding: "0 10px" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{typeEmoji(shownAlert.type)}</div>
              <div style={{ color: "#FCD34D", fontSize: 9, fontWeight: 700, fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                Nearby {shownAlert.type}
              </div>
              <div style={{ color: "#ffffff", fontSize: 8, fontFamily: "sans-serif", lineHeight: 1.3, opacity: 0.9, marginBottom: 8 }}>
                {shownAlert.name.length > 20 ? shownAlert.name.slice(0, 18) + "…" : shownAlert.name}
              </div>
              <div
                style={{
                  background: "#FCD34D",
                  color: "#000",
                  fontSize: 8,
                  fontWeight: 700,
                  fontFamily: "sans-serif",
                  padding: "3px 10px",
                  borderRadius: 10,
                  display: "inline-block",
                }}
              >
                Buy Now
              </div>
              {/* Haptic wave rings */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                {[30, 50, 70].map((size, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: size,
                      height: size,
                      borderRadius: "50%",
                      border: "1px solid rgba(252,211,77,0.3)",
                      animation: `hapticPulse ${0.6 + i * 0.2}s ease-in-out ${i * 0.15}s 3`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Normal watch face */
            <div style={{ textAlign: "center", width: "100%" }}>
              {/* Time */}
              <div style={{ color: "#ffffff", fontSize: 32, fontWeight: 300, fontFamily: "'Outfit', sans-serif", lineHeight: 1, letterSpacing: -1 }}>
                {hours}
                <span style={{ opacity: 0.5, animation: "pulse 1s infinite" }}>:</span>
                {minutes}
              </div>
              {/* Date */}
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, fontFamily: "sans-serif", marginTop: 3 }}>
                {time.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
              </div>

              {/* Activity ring */}
              <div style={{ margin: "8px auto 0", position: "relative", width: 52, height: 52 }}>
                <svg width="52" height="52" viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <circle
                    cx="26" cy="26" r="20"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 125.6} 125.6`}
                    transform="rotate(-90 26 26)"
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                  />
                  <circle cx="26" cy="26" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <circle
                    cx="26" cy="26" r="13"
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min(progress * 1.5, 1) * 81.6} 81.6`}
                    transform="rotate(-90 26 26)"
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "sans-serif" }}>
                    {Math.round(progress * 100)}%
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: 6, padding: "0 8px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#34D399", fontSize: 10, fontWeight: 600, fontFamily: "sans-serif" }}>{kmDisplay}</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 7, fontFamily: "sans-serif" }}>km</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#FBBF24", fontSize: 10, fontWeight: 600, fontFamily: "sans-serif" }}>{steps.toLocaleString()}</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 7, fontFamily: "sans-serif" }}>steps</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Crown button (right side) */}
        <div style={{
          position: "absolute",
          right: -4,
          top: "30%",
          width: 6,
          height: 24,
          background: "linear-gradient(90deg, #2a2a2a, #3a3a3a)",
          borderRadius: "0 4px 4px 0",
          border: "1px solid #444",
        }} />
        <div style={{
          position: "absolute",
          right: -4,
          top: "55%",
          width: 6,
          height: 14,
          background: "linear-gradient(90deg, #2a2a2a, #3a3a3a)",
          borderRadius: "0 3px 3px 0",
          border: "1px solid #444",
        }} />
      </div>

      {/* Watch band */}
      <div style={{
        width: 100,
        height: 28,
        background: "linear-gradient(145deg, #2d5a3d, #1a3d2b)",
        borderRadius: "0 0 16px 16px",
        margin: "0 auto",
        borderTop: "none",
      }} />
      <div style={{
        width: 100,
        height: 8,
        background: "linear-gradient(145deg, #2d5a3d, #1a3d2b)",
        margin: "0 auto",
        borderRadius: "0 0 8px 8px",
      }} />

      {/* Label */}
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif", letterSpacing: 1 }}>
          AMBIENT DISCOVERY
        </span>
      </div>
    </div>
  );
}
