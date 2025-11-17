// RightTopWidgets/index.jsx
import React from "react";
import SummaryCard from "./SummaryCard";
import Top5Card from "./Top5Card";
import MarkerInfoCard from "./MarkerInfoCard";

const RightTopWidgets = ({ data, onClickVillage, loading, error }) => {
  const payload = data;
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 10,
        zIndex: 1400,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      <SummaryCard data={payload} loading={loading} error={error} />
      <Top5Card data={payload} loading={loading} onRowClick={onClickVillage} />
      <MarkerInfoCard />
    </div>
  );
};

export default RightTopWidgets;
