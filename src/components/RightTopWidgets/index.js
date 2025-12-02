// src/components/RightTopWidgets/index.jsx
import React, { useState } from "react";
import SummaryCard from "./SummaryCard";
import Top5Card from "./Top5Card";
import MarkerInfoCard from "./MarkerInfoCard";

const RightTopWidgets = ({ data, onClickVillage, loading, error }) => {
  const payload = data;
  const [isOpen, setIsOpen] = useState(true);

  const Chevron = ({ rotated }) => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#333"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: rotated ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
      }}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 10,
        zIndex: 1400,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      {/* Nút toggle đẹp với SVG */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 36,
          height: 36,
          background: "white",
          borderRadius: "50%",
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s ease",
          userSelect: "none",
        }}
      >
        <Chevron rotated={isOpen} />
      </div>

      {/* Content */}
      {isOpen && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: 320,
          }}
        >
          <SummaryCard
            data={payload}
            loading={loading}
            error={error}
            hideTitle={true}
          />

          <Top5Card
            data={payload}
            loading={loading}
            onRowClick={onClickVillage}
            hideTitle={true}
          />

          <MarkerInfoCard hideTitle={true} />
        </div>
      )}
    </div>
  );
};

export default RightTopWidgets;
