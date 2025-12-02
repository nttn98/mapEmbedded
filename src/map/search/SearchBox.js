// src/map/search/SearchBox.jsx
import React from "react";

const SearchBox = ({ searchText, setSearchText, isSearching, onClear }) => {
  return (
    <div
      style={{
        background: "#fff",
        padding: "6px 10px",
        borderRadius: 999,
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        minWidth: 300,
        maxWidth: 420,
        gap: 8,
      }}
    >
      <span style={{ marginRight: 6 }}>🔍</span>
      <input
        type="text"
        placeholder="Search place (vd: Mudon, Vietnam...)"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ border: "none", outline: "none", flex: 1, fontSize: 13 }}
      />
      {isSearching && (
        <span style={{ fontSize: 12, color: "#999", marginRight: 4 }}>...</span>
      )}
      {searchText && (
        <button
          type="button"
          onClick={onClear}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 14,
            marginLeft: 4,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default SearchBox;
