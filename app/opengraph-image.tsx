import { ImageResponse } from "next/og";

export const alt = "Frimz — The AI thinking partner that remembers.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          background: "#f6f5f2",
          color: "#1c1b19",
          padding: 72,
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#1e3a34" }}>FRIMZ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 68, lineHeight: 1.05, maxWidth: 900 }}>The AI thinking partner that remembers.</div>
          <div style={{ fontSize: 28, color: "#6f6b64" }}>Think with Frimz. Keep the evolution of the idea.</div>
        </div>
      </div>
    ),
    size,
  );
}
