import { ImageResponse } from "next/og";

export const alt = "Frimz — The AI thinking partner that remembers.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const forest = "#1e3a34";
const cream = "#f3f6f4";
const sage = "#9fbfb3";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          background: forest,
          color: cream,
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill={forest} stroke="rgba(243,246,244,0.24)" />
            <rect x="6.5" y="6.5" width="12" height="12" rx="2.5" fill={sage} />
            <rect x="13.5" y="13.5" width="12" height="12" rx="2.5" fill={cream} />
          </svg>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 5 }}>FRIMZ</div>
        </div>
        <svg width="200" height="210" viewBox="0 0 200 210" style={{ position: "absolute", right: 80, top: 76 }}>
          <path d="M14 27V183" stroke="rgba(159,191,179,0.5)" strokeWidth="2" />
          <rect x="1" y="1" width="26" height="26" rx="7" fill={forest} stroke={sage} strokeWidth="2" />
          <rect x="1" y="92" width="26" height="26" rx="7" fill={forest} stroke={sage} strokeWidth="2" />
          <rect x="1" y="183" width="26" height="26" rx="7" fill={cream} />
          <rect x="48" y="9" width="104" height="10" rx="5" fill="rgba(197,214,206,0.3)" />
          <rect x="48" y="100" width="76" height="10" rx="5" fill="rgba(197,214,206,0.3)" />
          <rect x="48" y="191" width="140" height="10" rx="5" fill="rgba(243,246,244,0.8)" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 80, lineHeight: 1.02, letterSpacing: -2.5 }}>The AI thinking partner</div>
          <div style={{ display: "flex", fontSize: 80, lineHeight: 1.08, letterSpacing: -2.5 }}>
            <span>that</span>
            <span style={{ marginLeft: 22, color: sage }}>remembers.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#c5d6ce" }}>Think with Frimz. Keep the evolution of the idea.</div>
        </div>
      </div>
    ),
    size,
  );
}
