// SummaryCard.jsx
import React, { useMemo, useState } from "react";

const nf = new Intl.NumberFormat("en-US");

const SummaryCard = ({ data = null, year = 2025, width = 360 }) => {
  const features = Array.isArray(data?.features) ? data.features : [];

  const total = useMemo(
    () => features.reduce((s, f) => s + Number(f?.properties?.count ?? 0), 0),
    [features]
  );

  const axisMax = Math.max(10, Math.ceil(total / 1000) * 1000);
  const ticks = Array.from({ length: 5 }, (_, i) =>
    Math.round((axisMax / 4) * i)
  );
  const percent = Math.min(
    100,
    Math.round((total / Math.max(1, axisMax)) * 100)
  );

  const [showTooltip, setShowTooltip] = useState(false);

  // tooltip style (positioned relative to root card)
  // đặt top: '50%' và translateY(-50%) để căn giữa theo chiều dọc
  // translateX(-110%) để kéo tooltip ra bên trái thanh
  const tooltipStyleBase = {
    position: "absolute",
    top: "50%",
    left: 12, // bắt đầu gần mép trái của nội dung (card có padding 12)
    transform: "translate(-110%, -50%)",
    background: "#ffffff", // nền sáng cho dễ đọc
    color: "#12202b", // chữ đậm và dễ đọc
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    pointerEvents: "none",
    whiteSpace: "nowrap",
    zIndex: 120,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
    border: "1px solid rgba(15,23,42,0.06)",
    transition: "opacity 160ms ease, transform 160ms ease",
    opacity: 0,
  };

  // arrow (triangle) style inside tooltip
  const arrowStyle = {
    position: "absolute",
    right: -6, // đặt mũi tên hướng về phía phải (về phía thanh)
    top: "50%",
    transform: "translateY(-50%) rotate(45deg)",
    width: 12,
    height: 12,
    background: "#ffffff",
    borderRight: "1px solid rgba(15,23,42,0.06)",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    pointerEvents: "none",
  };

  return (
    <div
      style={{
        width,
        background: "#fff",
        borderRadius: 10,
        padding: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        fontFamily:
          "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        position: "relative",
        userSelect: "none",
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={-1}
    >
      <div
        style={{
          ...tooltipStyleBase,
          opacity: showTooltip ? 1 : 0,
          transform: showTooltip
            ? "translate(-110%, -50%)"
            : "translate(-110%, -42%)",
        }}
        aria-hidden={!showTooltip}
      >
        {/* content format: "2025 - 249" */}
        <span style={{ display: "inline-block", marginRight: 8 }}>
          {year} - {nf.format(total)}
        </span>

        {/* arrow */}
        <div style={arrowStyle} />
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0b5fff" }}>
          Summary
        </div>
        <div style={{ fontSize: 12, color: "#9aa6b2" }}></div>
      </div>

      {/* Big row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          role="button"
          aria-label={`Total ${nf.format(total)} in year ${year}`}
          tabIndex={0}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setShowTooltip((s) => !s);
            }
          }}
          style={{
            flex: 1,
            height: 36,
            background: "#e8f0ff",
            borderRadius: 6,
            overflow: "hidden", // giữ overflow hidden cho bar nội bộ
            position: "relative",
            outline: "none",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: "linear-gradient(90deg,#2f7efd,#1856c8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: 16,
              transition: "width 500ms cubic-bezier(.2,.9,.3,1)",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          >
            {nf.format(total)}
          </div>
        </div>

        <div
          style={{
            width: 60,
            textAlign: "right",
            fontSize: 16,
            fontWeight: 700,
            color: "#2b3d4f",
          }}
        >
          {year}
        </div>
      </div>

      {/* axis ticks */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {ticks.map((t, i) => (
            <div
              key={i}
              style={{ textAlign: "center", fontSize: 11, color: "#8fa1b2" }}
            >
              {nf.format(t)}
            </div>
          ))}
        </div>
        <div
          style={{
            textAlign: "center",
            marginTop: 6,
            fontSize: 11,
            color: "#9aa6b2",
          }}
        >
          Year: {year}
        </div>
      </div>
    </div>
  );
};

export default SummaryCard;
