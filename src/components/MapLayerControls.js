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
    transition: "all 0.2s",
  }),
  circle: (active) => ({
    width: 16,
    height: 16,
    background: "#fff",
    borderRadius: "50%",
    position: "absolute",
    top: 2,
    left: active ? 22 : 2,
    transition: "all 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
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
}) => {
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
            onClick={() => onChangeStyle("light")}
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
            onClick={onResetView}
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
        <div style={toggleStyle.wrapper} onClick={onToggleStates}>
          <div style={toggleStyle.label}>States</div>
          <div style={toggleStyle.switchBase(showStates)}>
            <div style={toggleStyle.circle(showStates)} />
          </div>
        </div>

        {/* SWITCH: DISTRICTS */}
        <div style={toggleStyle.wrapper} onClick={onToggleDistricts}>
          <div style={toggleStyle.label}>Districts</div>
          <div style={toggleStyle.switchBase(showDistricts)}>
            <div style={toggleStyle.circle(showDistricts)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapLayerControls;
