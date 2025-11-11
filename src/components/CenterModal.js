import React, { useMemo, useState } from "react";

/**
 * CenterModal (compact columns, no hover tooltip, click-to-highlight)
 *
 * Hooks are at the top to satisfy rules-of-hooks.
 */
const CenterModal = ({ visible, onClose, title, stats }) => {
  // Hooks
  const detail = stats?.detail || null;
  const years = detail?.years || [];

  const total = useMemo(
    () => years.reduce((s, y) => s + Number(y.case_sum || 0), 0),
    [years]
  );
  const maxVal = useMemo(
    () => Math.max(1, ...years.map((y) => Number(y.case_sum || 0))),
    [years]
  );

  // selected year state: clicking a bar or a year card toggles selection
  const [selectedYear, setSelectedYear] = useState(null);

  // Early return after hooks
  if (!visible) return null;

  // Chart sizing: smaller columns (half width)
  const svgW = 820;
  const svgH = 320;
  const padding = { top: 34, right: 20, bottom: 58, left: 56 };
  const innerW = svgW - padding.left - padding.right;
  const innerH = svgH - padding.top - padding.bottom;
  const gap = 8;
  const barCount = Math.max(1, years.length);
  // compute a "normal" bar width then halve it
  const baseBarWidth = Math.max(10, (innerW - gap * (barCount - 1)) / barCount);
  const barWidth = Math.max(6, Math.floor(baseBarWidth / 2)); // HALF width
  // With narrow bars, center them in the available area horizontally.
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * gap;
  const startOffset = padding.left + Math.max(0, (innerW - totalBarsWidth) / 2);

  const fmt = (n) => new Intl.NumberFormat().format(n);
  const pct = (n) => (total ? ((n / total) * 100).toFixed(1) : "0.0");

  const palette = {
    bg: "#fbfdff",
    card: "#ffffff",
    muted: "#6d7a85",
    accentA: "#4b8ff6",
    accentB: "#245fc4",
    text: "#1f2d36",
    highlight: "#ff9400",
  };

  // Toggle selection (click)
  const toggleSelect = (yr) => {
    setSelectedYear((prev) => (prev === yr ? null : yr));
  };

  return (
    <>
      {/* overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(6,12,20,0.34)",
          zIndex: 9998,
        }}
      />

      {/* modal container */}
      <div
        id="center-modal"
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "64vw",
          height: "64vh",
          minWidth: 720,
          minHeight: 420,
          background: palette.card,
          borderRadius: 12,
          boxShadow: "0 28px 80px rgba(8,24,48,0.36)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "Inter, Roboto, Arial, sans-serif",
          color: palette.text,
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #eef4fb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
            {detail && (
              <div style={{ fontSize: 12, color: palette.muted, marginTop: 4 }}>
                {detail.from_date} → {detail.to_date}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 18,
              cursor: "pointer",
              color: palette.muted,
            }}
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* details panel */}
          <div
            style={{
              flex: 0.4,
              background: palette.bg,
              padding: 14,
              borderLeft: "1px solid #e8f0f8",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: palette.text,
                marginBottom: 8,
              }}
            >
              Details by year
            </div>

            {years.length ? (
              years.map((yr) => {
                const val = Number(yr.case_sum || 0);
                const percent = total
                  ? ((val / total) * 100).toFixed(1)
                  : "0.0";
                const miniPct = Math.round((val / maxVal) * 100);
                const isSelected =
                  selectedYear === String(yr.year) || selectedYear === yr.year;

                return (
                  <div
                    key={yr.year}
                    onClick={() => toggleSelect(yr.year)}
                    style={{
                      background: isSelected ? "#fff9f2" : "#fff",
                      padding: 10,
                      borderRadius: 10,
                      boxShadow: isSelected
                        ? `0 8px 26px rgba(255,148,0,0.12)`
                        : "0 6px 18px rgba(8,16,28,0.04)",
                      marginBottom: 10,
                      cursor: "pointer",
                      border: isSelected
                        ? `1px solid ${palette.highlight}`
                        : "1px solid rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontWeight: 800, color: palette.text }}>
                        {yr.year}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: isSelected
                              ? palette.highlight
                              : palette.accentB,
                          }}
                        >
                          {fmt(val)}
                        </div>
                        <div style={{ fontSize: 12, color: palette.muted }}>
                          {percent}%
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        height: 8,
                        background: "#eef6ff",
                        borderRadius: 8,
                        overflow: "hidden",
                        marginTop: 8,
                      }}
                    >
                      <div
                        style={{
                          width: `${miniPct}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${palette.accentA}, ${palette.accentB})`,
                        }}
                      />
                    </div>

                    {yr.note && (
                      <div
                        style={{ marginTop: 8, fontSize: 12, color: "#42515a" }}
                      >
                        {yr.note}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ color: palette.muted }}>
                No yearly data available.
              </div>
            )}

            <div
              style={{
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: palette.muted,
              }}
            >
              <div>Total years: {years.length}</div>
              <div>
                Total:{" "}
                <strong style={{ color: palette.accentB }}>{fmt(total)}</strong>
              </div>
            </div>
          </div>

          {/* chart panel */}
          <div
            style={{
              flex: 0.6,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, color: palette.muted }}>
                Yearly cases
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: palette.muted }}>
                    Total
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: palette.accentB,
                    }}
                  >
                    {fmt(total)}
                  </div>
                </div>
                <div style={{ width: 1, height: 26, background: "#eef4fb" }} />
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: palette.muted }}>
                    Years
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {years.length}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                background: palette.card,
                borderRadius: 10,
                padding: 8,
                boxShadow: "inset 0 1px 0 rgba(0,0,0,0.02)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {years.length ? (
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  width="100%"
                  height="100%"
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={palette.accentA} />
                      <stop offset="100%" stopColor={palette.accentB} />
                    </linearGradient>
                    <linearGradient
                      id="gradHighlight"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={palette.highlight} />
                      <stop offset="100%" stopColor="#ff6c00" />
                    </linearGradient>
                    <filter
                      id="soft"
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="6"
                        stdDeviation="6"
                        floodColor="#0b2a57"
                        floodOpacity="0.07"
                      />
                    </filter>
                  </defs>

                  {/* Y grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                    const val = Math.round(maxVal * (1 - t));
                    const y = padding.top + innerH * t;
                    return (
                      <g key={i}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgW - padding.right}
                          y2={y}
                          stroke="rgba(8,24,40,0.05)"
                        />
                        <text
                          x={padding.left - 10}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="11"
                          fill={palette.muted}
                        >
                          {fmt(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* baseline */}
                  <line
                    x1={padding.left}
                    y1={padding.top + innerH}
                    x2={svgW - padding.right}
                    y2={padding.top + innerH}
                    stroke="rgba(8,24,40,0.06)"
                  />

                  {/* Bars (narrow) */}
                  {years.map((yr, i) => {
                    const val = Number(yr.case_sum || 0);
                    const h = (val / maxVal) * innerH;
                    const x = startOffset + i * (barWidth + gap);
                    const y = padding.top + (innerH - h);

                    const isSelected =
                      selectedYear === String(yr.year) ||
                      selectedYear === yr.year;

                    return (
                      <g key={yr.year}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={h}
                          rx={4}
                          fill={
                            isSelected ? "url(#gradHighlight)" : "url(#grad)"
                          }
                          filter={isSelected ? "url(#soft)" : undefined}
                          stroke={
                            isSelected ? palette.highlight : "transparent"
                          }
                          strokeWidth={isSelected ? 2 : 0}
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleSelect(yr.year)}
                        />
                        {/* value label (bigger for readability) */}
                        <text
                          x={x + barWidth / 2}
                          y={Math.max(y - 8, padding.top + 10)}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight={700}
                          fill={isSelected ? palette.highlight : "#082040"}
                        >
                          {fmt(val)}
                        </text>
                        {/* year label */}
                        <text
                          x={x + barWidth / 2}
                          y={svgH - 18}
                          textAnchor="middle"
                          fontSize="11"
                          fill={palette.muted}
                        >
                          {yr.year}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div style={{ color: palette.muted }}>No data</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CenterModal;
