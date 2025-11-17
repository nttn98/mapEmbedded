// Top5Card.jsx
import React, { useMemo } from "react";

const nf = new Intl.NumberFormat("en-US");

const Top5Card = ({ data, loading, onRowClick }) => {
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"]; // top1 → top5

  const top5 = useMemo(() => {
    const features = data?.features ?? [];
    const sorted = features
      .slice()
      .sort((a, b) => b.properties.count - a.properties.count);
    return sorted.slice(0, 5).map((item, index) => ({
      ...item,
      properties: {
        ...item.properties,
        color: colors[index] ?? "#cbd5e1",
        rank: index + 1,
      },
    }));
  }, [data]);

  const maxCount = top5[0]?.properties?.count || 1;

  if (loading) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.98)",
          borderRadius: 10,
          padding: 10,
          boxShadow: "0 8px 20px rgba(20,40,80,0.08)",
          minWidth: 260,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          Top 5
        </div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.98)",
        borderRadius: 10,
        padding: 10,
        boxShadow: "0 8px 20px rgba(20,40,80,0.08)",
        minWidth: 260,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>Top 5</div>
      </div>

      <div
        role="table"
        aria-label="Top 5 table"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {top5.map((v) => {
          const count = v?.properties?.count ?? 0;
          const ratio = Math.min(100, Math.round((count / maxCount) * 100));
          return (
            <div
              key={v?.properties?.name}
              role="row"
              tabIndex={0}
              onClick={() => onRowClick && onRowClick(v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick && onRowClick(v);
                }
              }}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "8px",
                borderRadius: 8,
                outline: "none",
                cursor: "pointer",
                transition:
                  "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
                // base background
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fbfdff";
                e.currentTarget.style.boxShadow =
                  "0 6px 18px rgba(20,40,80,0.06)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = "#fbfdff";
                e.currentTarget.style.boxShadow =
                  "0 6px 18px rgba(20,40,80,0.06)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }}
            >
              {/* left accent (rank color) */}
              <div
                style={{
                  width: 6,
                  height: 40,
                  borderRadius: 4,
                  background: v.properties.color,
                }}
              />

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: v.properties.color,
                        minWidth: 20,
                      }}
                    >
                      #{v.properties.rank}
                    </div>
                    <div
                      style={{ fontSize: 13, fontWeight: 700, color: "#122" }}
                    >
                      {v.properties.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    {nf.format(count)}
                  </div>
                </div>

                <div
                  style={{
                    height: 8,
                    background: "#f1f5f9",
                    borderRadius: 6,
                    overflow: "hidden",
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      width: `${ratio}%`,
                      height: "100%",
                      background: v.properties.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {(!top5 || top5.length === 0) && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No data</div>
        )}
      </div>
    </div>
  );
};

export default Top5Card;
