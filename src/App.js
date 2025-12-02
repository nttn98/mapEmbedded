import React from "react";
import { useNavigate } from "react-router-dom";
import MapEmbedded from "./pages/MapEmbedded";
import "./App.css";

function App() {
  const navigate = useNavigate();

  return (
    <MapEmbedded
      onNavigateToReport={() => navigate("/report")}
      reportPath="/report"
    />
  );
}

export default App;
