import React from "react";

const SuggestionsList = ({ suggestions = [], onSelect }) => {
  if (!suggestions.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 12,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
        zIndex: 1200,
        width: 310,
        maxHeight: 350,
        overflowY: "auto",
        minWidth: 300,
      }}
    >
      {suggestions.map((f, idx) => {
        const display = f.properties?.display_name || "";
        const parts = display.split(",");
        const primary = parts[0] || display;
        const secondary = parts.slice(1).join(", ").trim();

        return (
          <div
            key={idx}
            onClick={() => onSelect(f)}
            style={{
              display: "flex",
              gap: 10,
              padding: "10px 12px",
              cursor: "pointer",
              borderBottom:
                idx === suggestions.length - 1 ? "none" : "1px solid #f0f3f6",
            }}
          >
            <div style={{ fontSize: 18, lineHeight: "24px" }}>📍</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{primary}</div>
              {secondary && (
                <div
                  style={{
                    marginTop: 4,
                    color: "#6b7785",
                    fontSize: 12,
                    maxWidth: 240,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {secondary}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SuggestionsList;
