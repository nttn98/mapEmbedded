// src/pages/MapEmbedded.js
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  villagesGeoJson,
  fakeFetchVillageStatsByName,
  fakeVillageStatsByName,
} from "../services/fakeVillageApi";
import top3Image from "../assets/top3.png";

/* ---------------------------
   Constants & small helpers
   --------------------------- */
const DEFAULT_CENTER = [98.8, 16.8];
const DEFAULT_ZOOM = 6;
const mapStyles = {
  light: "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
};

const safeHasSource = (map, id) => {
  try {
    return !!(map && map.getSource && map.getSource(id));
  } catch {
    return false;
  }
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* ---------------------------
   Map layer helpers
   --------------------------- */
const ensurePulsingImage = (map) => {
  if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return;
  if (!map.hasImage || map.hasImage("pulsing-dot-small")) return;

  const size = 400;
  const pulsingDot = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),
    onAdd() {
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;
      this.context = canvas.getContext("2d");
    },
    render() {
      const duration = 5000;
      const t = (performance.now() % duration) / duration;
      const radius = (size / 2) * 0.25;
      const outerRadius = (size / 2) * 0.7 * t + radius;
      const ctx = this.context;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 0, 0, ${1 - t})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 0, 0, 1)";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      this.data = ctx.getImageData(0, 0, this.width, this.height).data;
      try {
        map.triggerRepaint();
      } catch {}
      return true;
    },
  };

  try {
    map.addImage("pulsing-dot-small", pulsingDot, { pixelRatio: 2 });
  } catch (err) {
    console.warn("addImage pulsing-dot-small failed:", err);
  }
};

const ensureVillageSourceAndLayers = (map) => {
  if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return;
  if (
    !villagesGeoJson ||
    typeof villagesGeoJson !== "object" ||
    !Array.isArray(villagesGeoJson.features)
  )
    return;

  try {
    if (!safeHasSource(map, "villages")) {
      map.addSource("villages", { type: "geojson", data: villagesGeoJson });
    } else {
      try {
        map.getSource("villages").setData(villagesGeoJson);
      } catch {}
    }
  } catch (err) {
    console.warn("map.addSource('villages') failed:", err);
  }

  // symbol (count) layer
  if (!map.getLayer || !map.getLayer("village-symbol")) {
    try {
      map.addLayer({
        id: "village-symbol",
        type: "symbol",
        source: "villages",
        layout: {
          "icon-image": "pulsing-dot-small",
          "icon-size": 0.6,
          "icon-anchor": "center",
          "text-field": ["to-string", ["coalesce", ["get", "count"], ""]],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 0],
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.3)",
          "text-halo-width": 1,
        },
      });
    } catch (err) {
      console.warn("Could not add village-symbol layer:", err);
    }
  }

  // name layer
  if (!map.getLayer || !map.getLayer("village-name")) {
    try {
      map.addLayer({
        id: "village-name",
        type: "symbol",
        source: "villages",
        layout: {
          "text-field": ["coalesce", ["get", "name"], ""],
          "text-size": 11,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-anchor": "top",
          "text-offset": [0, 1.4],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#b30000",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      });
    } catch (err) {
      console.warn("Could not add village-name layer:", err);
    }
  }
};

const addTopVillageMarkers = (map, top5Villages, fakeVillageStats) => {
  if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return;
  // remove old source/layer if present
  try {
    if (map.getLayer && map.getLayer("top-village-markers"))
      map.removeLayer("top-village-markers");
    if (map.getSource && map.getSource("top-village-markers"))
      map.removeSource("top-village-markers");
  } catch {}

  const safeTop5 = Array.isArray(top5Villages) ? top5Villages : [];
  const topVillagesToMark = safeTop5.slice(1, 4); // 2nd-4th
  if (!topVillagesToMark.length) return;

  const features = topVillagesToMark
    .map((v) => {
      const coords = Object.values(fakeVillageStats).find(
        (x) => x.village_name === v.name
      );
      if (!coords) return null;
      const lon = Number(coords.longitude);
      const lat = Number(coords.latitude);
      if (!isFinite(lon) || !isFinite(lat)) return null;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { name: v.name, cases: v.cases },
      };
    })
    .filter(Boolean);

  if (!features.length) return;

  const geojson = { type: "FeatureCollection", features };

  const addSourceAndLayer = () => {
    try {
      if (!map.getSource("top-village-markers"))
        map.addSource("top-village-markers", {
          type: "geojson",
          data: geojson,
        });
      else map.getSource("top-village-markers").setData(geojson);

      if (!map.getLayer("top-village-markers")) {
        map.addLayer({
          id: "top-village-markers",
          type: "symbol",
          source: "top-village-markers",
          layout: {
            "icon-image": "top3-marker",
            "icon-size": 2.4,
            "icon-anchor": "bottom",
            "icon-offset": [0, -40],
            "icon-allow-overlap": true,
          },
        });
      }
    } catch (err) {
      console.warn("Error adding top-village source/layer:", err);
    }
  };

  try {
    if (!map.hasImage || !map.hasImage("top3-marker")) {
      const img = new Image();
      img.onload = () => {
        try {
          if (!map.hasImage("top3-marker"))
            map.addImage("top3-marker", img, { pixelRatio: 2 });
        } catch {}
        addSourceAndLayer();
      };
      img.onerror = addSourceAndLayer;
      img.src = top3Image;
    } else addSourceAndLayer();
  } catch (err) {
    console.warn("Error in addTopVillageMarkers:", err);
    addSourceAndLayer();
  }
};

/* ---------------------------
   Small presentational components
   --------------------------- */
const Card = ({ title, collapsed, onToggle, children }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 12,
      padding: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
        {title}
      </div>
      <button
        onClick={onToggle}
        style={{ border: "none", background: "transparent", cursor: "pointer" }}
      >
        {collapsed ? "Show" : "Hide"}
      </button>
    </div>
    {!collapsed && children}
  </div>
);

/* ---------------------------
   Main component
   --------------------------- */
const MapEmbedded = ({
  onSelectVillage = () => {},
  onSelectState = () => {},
}) => {
  const [style, setStyle] = useState("light");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [collapsed, setCollapsed] = useState({
    controls: false,
    date: false,
    summary: false,
    top5: false,
    marker: false,
  });

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);
  const popupRef = useRef(null);
  const searchGeoJsonRef = useRef(null);

  const summaryData = useMemo(() => {
    const allVillages = Object.values(fakeVillageStatsByName);
    const totalByYear = { 2023: 0, 2024: 0, 2025: 0 };
    allVillages.forEach((v) =>
      v.years.forEach((y) => (totalByYear[y.year] += y.case_sum))
    );
    return totalByYear;
  }, []);

  const top5Villages = useMemo(() => {
    const allVillages = Object.values(fakeVillageStatsByName);
    const withCases = allVillages.map((v) => {
      const yearData = v.years.find((y) => y.year === selectedYear);
      return { name: v.village_name, cases: yearData ? yearData.case_sum : 0 };
    });
    return withCases.sort((a, b) => b.cases - a.cases).slice(0, 5);
  }, [selectedYear]);

  const maxCases = useMemo(
    () => Math.max(...top5Villages.map((v) => v.cases || 0), 0),
    [top5Villages]
  );

  /* ------------ search helpers ------------ */
  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearchError("");
      return;
    }
    let canceled = false;
    const controller = new AbortController();

    const fetchSuggestions = async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&addressdetails=1&limit=5&q=${encodeURIComponent(
          q
        )}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (canceled) return;
        setSuggestions(data.features || []);
        if (!(data.features || []).length)
          setSearchError("Không tìm thấy kết quả.");
      } catch (err) {
        if (canceled) return;
        console.error(err);
        setSearchError("Có lỗi khi gọi Nominatim.");
        setSuggestions([]);
      } finally {
        if (!canceled) setIsSearching(false);
      }
    };

    const id = setTimeout(fetchSuggestions, 400);
    return () => {
      canceled = true;
      controller.abort();
      clearTimeout(id);
    };
  }, [searchText]);

  const addOrUpdateSearchLayer = useCallback((map, geojson) => {
    if (!map) return;
    const hasPolygon = (geojson.features || []).some((f) =>
      ["Polygon", "MultiPolygon"].includes(f.geometry.type)
    );
    try {
      if (map.getSource("search-result"))
        map.getSource("search-result").setData(geojson);
      else {
        map.addSource("search-result", { type: "geojson", data: geojson });
        if (hasPolygon) {
          if (!map.getLayer("search-result-fill"))
            map.addLayer(
              {
                id: "search-result-fill",
                type: "fill",
                source: "search-result",
                paint: { "fill-color": "#0078ff", "fill-opacity": 0.2 },
              },
              "village-symbol"
            );
          if (!map.getLayer("search-result-outline"))
            map.addLayer(
              {
                id: "search-result-outline",
                type: "line",
                source: "search-result",
                paint: { "line-color": "#0078ff", "line-width": 2 },
              },
              "village-symbol"
            );
        } else {
          if (!map.getLayer("search-result-point"))
            map.addLayer(
              {
                id: "search-result-point",
                type: "circle",
                source: "search-result",
                paint: {
                  "circle-radius": 6,
                  "circle-color": "#0078ff",
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 2,
                },
              },
              "village-symbol"
            );
        }
      }
    } catch (err) {
      console.warn("Error updating/adding search-result layer:", err);
    }
    searchGeoJsonRef.current = geojson;
  }, []);

  const clearSearchLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    [
      "search-result-fill",
      "search-result-outline",
      "search-result-point",
    ].forEach((id) => {
      try {
        if (map.getLayer && map.getLayer(id)) map.removeLayer(id);
      } catch {}
    });
    try {
      if (map.getSource && map.getSource("search-result"))
        map.removeSource("search-result");
    } catch {}
    searchGeoJsonRef.current = null;
  }, []);

  const handleSelectSuggestion = (feature) => {
    const map = mapRef.current;
    if (!map) return;
    setSuggestions([]);
    const { properties, geometry, bbox } = feature || {};
    if (properties?.display_name) setSearchText(properties.display_name);
    if (geometry)
      addOrUpdateSearchLayer(map, {
        type: "FeatureCollection",
        features: [feature],
      });
    else clearSearchLayer();

    try {
      if (bbox && bbox.length === 4) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        map.fitBounds(
          [
            [minLon, minLat],
            [maxLon, maxLat],
          ],
          { padding: 40, duration: 800 }
        );
      } else if (geometry?.type === "Point") {
        const [lon, lat] = geometry.coordinates;
        map.easeTo({ center: [lon, lat], zoom: 10, duration: 800 });
      }
    } catch (err) {
      console.warn("Error fitting map to selection:", err);
    }
  };

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    } catch {}
    clearSearchLayer();
    setSearchText("");
    setSuggestions([]);
    setSearchError("");
    try {
      map.easeTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        duration: 600,
        bearing: 0,
        pitch: 0,
      });
    } catch (err) {
      console.warn("reset view failed", err);
    }
  }, [clearSearchLayer]);

  /* ------------ shared click handler for map & Top5 ------------ */
  const buildPopupHtml = useCallback((detail, selectedYear = 2025) => {
    if (!detail)
      return `<div style=\"padding:14px;font-family:Inter,Arial,sans-serif\">No data</div>`;

    const years = [...(detail.years || [])].sort((a, b) => b.year - a.year);
    const values = years.map((y) => y.case_sum || 0);
    const maxVal = Math.max(...values, 1);
    const colorPrimary = "#2f86ff";
    const colorSecondary = "#18b8a0";
    const colorTertiary = "#f6b042";
    const barColor = (year) =>
      year === selectedYear
        ? colorPrimary
        : year === selectedYear - 1
        ? colorSecondary
        : colorTertiary;

    const leftHtml = years
      .map(
        (y) =>
          `<div class=\"pv-row\"><div class=\"pv-year\">Year: ${y.year}</div><div class=\"pv-value\">${y.case_sum}</div></div>`
      )
      .join("");
    const barsHtml = years
      .map((y) => {
        const pct = Math.round((y.case_sum / maxVal) * 100);
        const c = barColor(y.year);
        return `<div class=\"pv-bar-col\"><div class=\"pv-bar-wrap\"><div class=\"pv-bar\" style=\"height:${pct}%; background:${c};\"></div><div class=\"pv-pill\" style=\"border: 2px solid rgba(0,0,0,0.04); color:${c};\">${y.case_sum}</div></div><div class=\"pv-bar-label\">${y.year}</div></div>`;
      })
      .join("");

    const t1 = Math.round(maxVal),
      t2 = Math.round(maxVal * 0.66),
      t3 = Math.round(maxVal * 0.33);

    return `
  <style> .pv-root { font-family: Inter, Arial, Helvetica, sans-serif; color:#222; min-width:520px; max-width:680px; padding:14px; } .pv-card { background:#fff; border-radius:10px; padding:14px; box-shadow:0 10px 30px rgba(0,0,0,0.08); border:1px solid rgba(0,0,0,0.03); } .pv-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; } .pv-title { font-size:18px; font-weight:800; } .pv-sub { display:flex; align-items:center; gap:8px; margin-bottom:12px; } .pv-body { display:flex; gap:20px; align-items:flex-start; } .pv-left { flex:1; padding:6px 8px; } .pv-row { display:flex; align-items:center; justify-content:flex-start; gap:12px; margin-bottom:10px; } .pv-year { font-weight:700; color:#222; min-width:120px; font-size:14px; } .pv-value { color:#d32f2f; font-weight:800; font-size:16px; } .pv-right { width:320px; position:relative; } .pv-chart { display:flex; align-items:flex-end; justify-content:center; gap:12px; height:140px; } .pv-bar-col { display:flex; flex-direction:column; align-items:center; width:76px; } .pv-bar-wrap { position:relative; width:100%; height:120px; display:flex; align-items:flex-end; justify-content:center; } .pv-bar { width:46%; border-radius:8px 8px 6px 6px; box-shadow: inset 0 -6px 8px rgba(0,0,0,0.06); } .pv-pill { position:absolute; bottom: calc(100% + 8px); left:50%; transform:translateX(-50%); background:#fff; padding:6px 10px; border-radius:10px; font-weight:700; font-size:12px; box-shadow:0 6px 18px rgba(0,0,0,0.07); } .pv-bar-label { margin-top:8px; font-size:12px; color:#666; } .pv-ticks { position:absolute; right:-48px; top:8px; height:120px; display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; font-size:12px; color:#999; } @media (max-width:560px){ .pv-root{min-width:420px} .pv-right{width:240px} .pv-bar-col{width:60px} } </style>
  <div class=\"pv-root\"><div class=\"pv-card\"><div class=\"pv-header\"><div><div class=\"pv-title\">Village: ${
    detail.village_name || ""
  }</div></div></div><div class=\"pv-sub\"><div class=\"tag\">Detail |</div><div class=\"range\">${
      detail.from_date || ""
    } -> ${
      detail.to_date || ""
    }</div></div><div class=\"pv-body\"><div class=\"pv-left\">${leftHtml}</div><div class=\"pv-right\"><div class=\"pv-chart\">${barsHtml}</div><div class=\"pv-ticks\"><div>— ${t1}</div><div>— ${t2}</div><div>— ${t3}</div><div>— 0</div></div></div></div></div></div>`;
  }, []);

  const handleClickVillageByName = useCallback(
    async (name) => {
      const map = mapRef.current;
      if (!map || !name) return;

      try {
        const coords = Object.values(fakeVillageStatsByName).find(
          (v) => v.village_name === name
        );
        if (!coords) return;
        const lon = Number(coords.longitude);
        const lat = Number(coords.latitude);
        if (!isFinite(lon) || !isFinite(lat)) return;

        try {
          map.easeTo({
            center: [lon, lat],
            zoom: clamp(Math.max(map.getZoom(), 8), 5, 16),
            duration: 600,
          });
        } catch {}

        const apiData = await fakeFetchVillageStatsByName(name);
        try {
          onSelectVillage(name, apiData);
        } catch {}
        try {
          onSelectState(name, apiData);
        } catch {}

        if (!popupRef.current && maplibreRef.current)
          popupRef.current = new maplibreRef.current.Popup({
            closeButton: true,
          });

        const html = apiData?.detail
          ? buildPopupHtml(apiData.detail, selectedYear)
          : `<div style=\"padding:10px;font-family:Arial,sans-serif\"><b>${name}</b><div style=\"margin-top:6px;color:#666\">No details</div></div>`;

        try {
          popupRef.current.setLngLat([lon, lat]).setHTML(html).addTo(map);
        } catch (err) {
          console.warn(err);
        }
      } catch (err) {
        console.warn("handleClickVillageByName error:", err);
      }
    },
    [onSelectState, onSelectVillage, selectedYear]
  );

  /* ------------ map init ------------ */
  useEffect(() => {
    let canceled = false;
    (async () => {
      const maplibreModule = await import("maplibre-gl");
      if (canceled) return;
      const maplibregl = maplibreModule.default || maplibreModule;
      maplibreRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: mapStyles[style],
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 5,
        maxZoom: 10,
        renderWorldCopies: false,
      });
      mapRef.current = map;

      try {
        map.addControl(new maplibregl.NavigationControl(), "top-right");
      } catch {}

      map.on("load", () => {
        try {
          ensurePulsingImage(map);
          ensureVillageSourceAndLayers(map);
          addTopVillageMarkers(map, top5Villages, fakeVillageStatsByName);
        } catch (err) {
          console.warn("Error in load handlers:", err);
        }

        ["village-symbol", "village-name"].forEach((layerId) => {
          try {
            map.on(
              "mouseenter",
              layerId,
              () => (map.getCanvas().style.cursor = "pointer")
            );
            map.on(
              "mouseleave",
              layerId,
              () => (map.getCanvas().style.cursor = "")
            );
            map.on("click", layerId, async (e) => {
              const feature = e?.features && e.features[0];
              if (!feature) return;
              const name = feature.properties?.name;
              if (!name) return;
              await handleClickVillageByName(name);
            });
          } catch (err) {
            console.warn(err);
          }
        });
      });

      map.on("styledata", () => {
        try {
          ensurePulsingImage(map);
          ensureVillageSourceAndLayers(map);
          addTopVillageMarkers(map, top5Villages, fakeVillageStatsByName);
          if (searchGeoJsonRef.current)
            addOrUpdateSearchLayer(map, searchGeoJsonRef.current);
        } catch (err) {
          console.warn("Error in styledata handler:", err);
        }
      });
    })();

    return () => {
      canceled = true;
      try {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      } catch {}
      try {
        if (mapRef.current) mapRef.current.remove();
      } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(mapStyles[style]);
    } catch (err) {
      console.warn("setStyle failed:", err);
    }
  }, [style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return;
    try {
      addTopVillageMarkers(map, top5Villages, fakeVillageStatsByName);
    } catch (err) {
      console.warn("addTopVillageMarkers failed in effect:", err);
    }
  }, [top5Villages]);

  /* ------------ rendering helpers ------------ */
  const renderSuggestions = () => {
    if (!suggestions.length || collapsed.controls) return null;
    return (
      <div
        style={{
          position: "absolute",
          top: 62,
          left: 10,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          zIndex: 20,
          maxHeight: 260,
          overflowY: "auto",
          minWidth: 260,
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
              onClick={() => handleSelectSuggestion(f)}
              style={{
                display: "flex",
                gap: 8,
                padding: "8px 10px",
                cursor: "pointer",
                borderBottom:
                  idx === suggestions.length - 1 ? "none" : "1px solid #eee",
              }}
            >
              <div style={{ fontSize: 18, lineHeight: "24px" }}>📍</div>
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{primary}</div>
                {secondary && (
                  <div
                    style={{
                      marginTop: 2,
                      color: "#555",
                      fontSize: 11,
                      maxWidth: 210,
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

  /* ------------ UI ------------ */
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        display: "flex",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Card
            title="Controls"
            collapsed={collapsed.controls}
            onToggle={() =>
              setCollapsed((s) => ({ ...s, controls: !s.controls }))
            }
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ marginRight: 6 }}>🔍</span>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search place (vd: Mudon, Vietnam...)"
                style={{
                  border: "none",
                  outline: "none",
                  flex: 1,
                  fontSize: 12,
                }}
              />
              {isSearching && (
                <span style={{ fontSize: 11, color: "#999", marginRight: 4 }}>
                  ...
                </span>
              )}
              {searchText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    setSuggestions([]);
                    clearSearchLayer();
                  }}
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
            {searchError && (
              <div
                style={{
                  background: "#fff",
                  padding: "4px 8px",
                  borderRadius: 6,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  fontSize: 11,
                  color: "red",
                  maxWidth: 260,
                  marginTop: 8,
                }}
              >
                {searchError}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={handleResetView}
                style={{
                  padding: "6px 12px",
                  background: "#0a84ff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Reset view
              </button>
            </div>
          </Card>

          {renderSuggestions()}

          <div
            style={{
              background: "#fff",
              padding: 10,
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 180,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>Date range</div>
              <button
                onClick={() => setCollapsed((s) => ({ ...s, date: !s.date }))}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {collapsed.date ? "Show" : "Hide"}
              </button>
            </div>
            {!collapsed.date && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "#1976d2",
                  background: "#e3f2fd",
                  padding: "4px 12px",
                  borderRadius: 16,
                  display: "inline-block",
                }}
              >
                Wed 01-Jan-2025 ~ Wed 31-Dec-2025
              </div>
            )}
          </div>
        </div>

        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      <div
        style={{
          width: 320,
          background: "#f8f9fa",
          padding: 16,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Card
          title="Summary"
          collapsed={collapsed.summary}
          onToggle={() => setCollapsed((s) => ({ ...s, summary: !s.summary }))}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0a84ff" }}>
              {summaryData[selectedYear]}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Year: {selectedYear}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              height: 80,
            }}
          >
            {[2023, 2024, 2025].map((year) => {
              const maxVal = Math.max(...Object.values(summaryData));
              const height = maxVal ? (summaryData[year] / maxVal) * 100 : 0;
              return (
                <div
                  key={year}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      background: year === selectedYear ? "#0a84ff" : "#e5e7eb",
                      height: `${height}%`,
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      paddingTop: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: year === selectedYear ? "#fff" : "#6b7280",
                        fontWeight: 600,
                      }}
                    >
                      {summaryData[year]}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{year}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Top5"
          collapsed={collapsed.top5}
          onToggle={() => setCollapsed((s) => ({ ...s, top5: !s.top5 }))}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {top5Villages.map((village, idx) => {
              const colors = [
                "#d45079",
                "#e67e50",
                "#f9a66b",
                "#4ecdc4",
                "#5b9bd5",
              ];
              const barWidth = maxCases ? (village.cases / maxCases) * 100 : 0;
              return (
                <div
                  key={idx}
                  onClick={() => handleClickVillageByName(village.name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "6px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f0f0f0")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      minWidth: 70,
                      textAlign: "right",
                    }}
                  >
                    {village.name}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#f1f5f9",
                      borderRadius: 6,
                      height: 20,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: "100%",
                        background: colors[idx % colors.length],
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: 8,
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {village.cases}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Marker"
          collapsed={collapsed.marker}
          onToggle={() => setCollapsed((s) => ({ ...s, marker: !s.marker }))}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={top3Image}
              alt="Top3"
              style={{ width: 48, height: 48, borderRadius: 8 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                CaseInVillage • Top3
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                Click a cluster to load details
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MapEmbedded;
