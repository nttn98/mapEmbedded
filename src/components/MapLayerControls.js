import React from "react";

const toggleStyle = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
  },
  switchBase: (active) => ({
    width: 40,
    height: 20,
    borderRadius: 20,
    background: active ? "#4ade80" : "#e5e7eb",
    position: "relative",
    transition: "all 0.18s",
  }),
  circle: (active) => ({
    width: 16,
    height: 16,
    background: "#fff",
    borderRadius: "50%",
    position: "absolute",
    top: 2,
    left: active ? 22 : 2,
    transition: "all 0.18s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
  }),
};

const MapLayerControls = ({
  styleName,
  onChangeStyle,
  onResetView,
  showStates,
  showDistricts,
  onToggleStates,
  onToggleDistricts,
  onNavigateToReport,
  reportPath = "/report",
}) => {
  const openReport = () => {
    try {
      if (typeof onNavigateToReport === "function") {
        onNavigateToReport();
      } else {
        window.location.href = reportPath;
      }
    } catch (e) {
      window.location.href = reportPath;
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        bottom: 10,
        zIndex: 1200,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "#fff",
          padding: "10px 12px",
          borderRadius: 10,
          boxShadow: "0 8px 22px rgba(0,0,0,0.10)",
          minWidth: 170,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>
          Map Controls
        </div>

        {/* MAP STYLE + RESET */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => onChangeStyle && onChangeStyle("light")}
            style={{
              padding: "6px 8px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #eef2f6",
              background: styleName === "light" ? "#e0f2fe" : "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Light
          </button>

          <button
            onClick={() => onResetView && onResetView()}
            style={{
              padding: "6px 8px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #eef2f6",
              background: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>

        {/* SWITCH: STATES */}
        <div
          style={toggleStyle.wrapper}
          onClick={() => onToggleStates && onToggleStates()}
        >
          <div style={toggleStyle.label}>States</div>
          <div style={toggleStyle.switchBase(Boolean(showStates))}>
            <div style={toggleStyle.circle(Boolean(showStates))} />
          </div>
        </div>

        {/* SWITCH: DISTRICTS */}
        <div
          style={toggleStyle.wrapper}
          onClick={() => onToggleDistricts && onToggleDistricts()}
        >
          <div style={toggleStyle.label}>Districts</div>
          <div style={toggleStyle.switchBase(Boolean(showDistricts))}>
            <div style={toggleStyle.circle(Boolean(showDistricts))} />
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "#f3f4f6",
            borderRadius: 2,
            margin: "6px 0",
          }}
        />

        {/* VIEW REPORTS BUTTON */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={openReport}
            title="View reports"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.06)",
              background: "linear-gradient(180deg,#ffffff,#fbfdff)",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
              fontSize: 13,
              color: "#111",
              fontWeight: 700,
              width: "100%",
              justifyContent: "center",
            }}
          >
            {/* icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 3h18v4H3zM3 11h18v10H3z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* label — hide text on very small screens using CSS-like inline trick */}
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              View Reports
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapLayerControls;
