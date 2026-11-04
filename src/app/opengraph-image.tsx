import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "JobPilot AI — Your next opportunity. Already in motion.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function opengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: "#f8f9fb", padding: "72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "#087f68", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 34, fontWeight: 700 }}>J</div>
          <div style={{ fontSize: 32, fontWeight: 600, color: "#171b25" }}>JobPilot AI</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.05, fontWeight: 700, color: "#171b25", letterSpacing: "-2px" }}>
            <div>Your next opportunity.</div>
            <div style={{ color: "#087f68" }}>Already in motion.</div>
          </div>
          <div style={{ fontSize: 30, color: "#747d8c" }}>
            An AI career assistant for India — approval-first, CV-true, in your control.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#747d8c" }}>
          <div style={{ border: "1px solid #d9dde5", borderRadius: 999, padding: "10px 24px" }}>Approval-first</div>
          <div style={{ border: "1px solid #d9dde5", borderRadius: 999, padding: "10px 24px" }}>CV-true matching</div>
          <div style={{ border: "1px solid #d9dde5", borderRadius: 999, padding: "10px 24px" }}>Made for India</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
