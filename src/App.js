// src/App.js (hoặc page cha nào đó)
import React from "react";
import MapEmbedded from "./pages/MapEmbedded";
import "./App.css";

function App() {
  const handleSelectState = (stateName) => {
    console.log("Selected state:", stateName);
  };

  return <MapEmbedded onSelectState={handleSelectState} />;
}

export default App;
