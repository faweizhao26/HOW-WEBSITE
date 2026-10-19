import { ImageResponse } from "next/og"

export const alt = "HOW 2027 - PostgreSQL Ecosystem Conference"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "62px 72px", background: "#f8fafc", color: "#101817", borderTop: "18px solid #00cba9", justifyContent: "space-between" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#006a58" }}>
        <span>OPEN SOURCE CONFERENCE</span><span>2027</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1 }}>HOW 2027</div>
        <div style={{ fontSize: 40, lineHeight: 1.25 }}>PostgreSQL Ecosystem Conference</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24, borderTop: "2px solid #b5ccc6", paddingTop: 24, fontSize: 25 }}>
        <span style={{ color: "#006a58" }}>Community</span><span>Engineering</span><span>Collaboration</span>
      </div>
    </div>,
    size,
  )
}
