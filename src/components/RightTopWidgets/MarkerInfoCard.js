// src/components/RightTopWidgets/MarkerInfoCard.jsx
import React from "react";
import top3Image from "../../assets/top3.png";

const MarkerInfoCard = () => {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.98)",
        borderRadius: 10,
        padding: 10,
        boxShadow: "0 8px 20px rgba(20,40,80,0.08)",
        minWidth: 240,
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
        <div style={{ fontSize: 13, fontWeight: 700 }}>Marker Info</div>
      </div>

      <div
        style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: "#ffb6c1",
            }}
          />
          <div>CaseInVillage</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <img src={top3Image} alt="Top3" width={22} />
          <div>Top 3</div>
        </div>
      </div>
    </div>
  );
};

export default MarkerInfoCard;
