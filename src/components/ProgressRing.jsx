import React from "react";

/**
 * Elegant SVG progress ring — clear progress without gimmicky 3D toys.
 */
export default function ProgressRing({
  progress = 0,
  size = 112,
  stroke = 8,
  color = "#2EF0A0",
  track = "rgba(255,255,255,0.08)",
  label,
  sublabel,
  hit = false,
}) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className="dd-progress-ring"
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s ease",
            filter: hit ? `drop-shadow(0 0 10px ${color})` : `drop-shadow(0 0 4px ${color}55)`,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 10,
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
            fontWeight: 700,
            fontSize: size > 100 ? 22 : 16,
            letterSpacing: -0.8,
            color,
            lineHeight: 1,
          }}
        >
          {label ?? `${Math.round(pct)}%`}
        </div>
        {sublabel && (
          <div
            style={{
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 9,
              letterSpacing: 0.8,
              color: "var(--dd-faint, #5C6B7A)",
              marginTop: 4,
              textTransform: "uppercase",
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
