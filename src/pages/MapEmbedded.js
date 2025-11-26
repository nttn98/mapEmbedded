// src/pages/MapEmbedded.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

import RightTopWidgets from "../components/RightTopWidgets";
import CenterModal from "../components/CenterModal";
import MapLayerControls from "../components/MapLayerControls";

import top3Image from "../assets/top3.png";

import {
  villagesGeoJson,
  fakeFetchVillageStatsByName,
} from "../services/fakeVillageApi";

import thailandStatesGeoJson from "../data/Thailand_states_provinces.simplified.geojson";
import thailandDistrictsGeoJson from "../data/Thailand_districts_counties.simplified.geojson";

// ================== CONFIG MAP ==================
const DEFAULT_CENTER = [98.8, 16.8]; // giữa vùng village
const DEFAULT_ZOOM = 6;

const mapStyles = {
  light: "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
};

// ================== VILLAGE LAYERS ==================
const addVillageLayers = (map) => {
  if (!map) return;

  // --- 0) Tính danh sách top 2 -> top 4 theo count (hoặc cases / case_sum) ---
  const features = (villagesGeoJson && villagesGeoJson.features) || [];
  const scored = features
    .map((f) => {
      const p = f.properties || {};
      const score = Number(p.count ?? p.cases ?? p.case_sum ?? 0);
      return { feature: f, score };
    })
    .filter(
      (x) =>
        x.feature &&
        x.feature.geometry &&
        x.feature.geometry.type === "Point" &&
        isFinite(x.score)
    );

  scored.sort((a, b) => b.score - a.score); // lớn → nhỏ

  // 2nd..4th (bỏ phần tử 0 là top1)
  const top234 = scored.slice(1, 4);

  // dùng name || village_name để chắc ăn
  const top234Names = top234
    .map((x) => {
      const p = x.feature.properties || {};
      return p.name || p.village_name || null;
    })
    .filter(Boolean);

  // --- 1) Image pulsing-dot (animation luôn chạy, dùng cho village thường) ---
  try {
    if (!map.hasImage || !map.hasImage("pulsing-dot-small")) {
      const size = 300;
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

          // outer pulse
          ctx.beginPath();
          ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 0, 0, ${1 - t})`;
          ctx.fill();

          // inner dot
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

      map.addImage("pulsing-dot-small", pulsingDot, { pixelRatio: 2 });
    }
  } catch (err) {
    console.warn("pulsing-dot-small error:", err);
  }

  // --- 1b) Image top3Image (dùng cho top2-4, không pulsing) ---
  try {
    if (!map.hasImage || !map.hasImage("top3-marker")) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          if (!map.hasImage("top3-marker")) {
            // dùng ảnh gốc, phóng to bằng icon-size
            map.addImage("top3-marker", img, { pixelRatio: 1 });
          }
        } catch (err) {
          console.warn("addImage top3-marker failed:", err);
        }
      };
      img.src = top3Image;
    }
  } catch (err) {
    console.warn("top3-marker image error:", err);
  }

  // --- 2) Source villages ---
  try {
    if (!map.getSource("villages")) {
      map.addSource("villages", {
        type: "geojson",
        data: villagesGeoJson,
      });
    } else {
      try {
        map.getSource("villages")?.setData?.(villagesGeoJson);
      } catch (err) {
        // ignore setData error
      }
    }
  } catch (err) {
    console.warn("ensuring villages source failed:", err);
  }

  // --- 3) Symbol layer: icon + số (count) ở giữa ---
  try {
    // biểu thức dùng name || village_name để kiểm tra top234
    const isTopExpr = [
      "in",
      ["coalesce", ["get", "name"], ["get", "village_name"]],
      ["literal", top234Names],
    ];

    if (!map.getLayer("village-symbol")) {
      map.addLayer({
        id: "village-symbol",
        type: "symbol",
        source: "villages",
        layout: {
          "icon-image": [
            "case",
            isTopExpr,
            "top3-marker", // top2-4: dùng top3 image
            "pulsing-dot-small", // còn lại: pulsing-dot
          ],
          "icon-size": ["case", isTopExpr, 0.7, 0.6],
          "icon-anchor": "center",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,

          "text-field": [
            "to-string",
            [
              "coalesce",
              ["get", "count"],
              [
                "coalesce",
                ["get", "cases"],
                ["coalesce", ["get", "case_sum"], ""],
              ],
            ],
          ],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 0],
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.3)",
          "text-halo-width": 1,
        },
      });
    } else {
      // nếu layer đã tồn tại (styledata gọi lại), update icon-image/icon-size với top234Names mới
      map.setLayoutProperty("village-symbol", "icon-image", [
        "case",
        isTopExpr,
        "top3-marker",
        "pulsing-dot-small",
      ]);
      map.setLayoutProperty("village-symbol", "icon-size", [
        "case",
        isTopExpr,
        0.7,
        0.6,
      ]);
    }
  } catch (err) {
    console.warn("Could not add/update village-symbol layer:", err);
  }

  // --- 4) Tên village bên dưới ---
  try {
    if (!map.getLayer("village-name")) {
      map.addLayer({
        id: "village-name",
        type: "symbol",
        source: "villages",
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name"],
            ["get", "village_name"],
            "",
          ],
          "text-size": 11,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-anchor": "top",
          "text-offset": [0, 1.4],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#b30000",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      });
    }
  } catch (err) {
    console.warn("Could not add village-name layer:", err);
  }
};

// ======================= COMPONENT =======================
const MapEmbedded = ({ onSelectVillage = () => {} }) => {
  const [style, setStyle] = useState("light");

  // search state
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // toggle boundary overlays
  const [showStates, setShowStates] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);
  const searchGeoJsonRef = useRef(null); // geojson highlight

  // modal state (React)
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalStats, setModalStats] = useState(null);

  const [data, setData] = useState([]);

  // lấy data villages (từ fake service)
  const getVillagesData = useCallback(() => {
    try {
      const rs = villagesGeoJson;
      if (!rs) return;
      setData(rs);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    getVillagesData();
  }, [getVillagesData]);

  // ====== BOUNDARY LAYERS: STATES & DISTRICTS ======
  const addStatesLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource("th-states")) {
      map.addSource("th-states", {
        type: "geojson",
        data: thailandStatesGeoJson,
      });
    }

    if (!map.getLayer("th-states-fill")) {
      map.addLayer(
        {
          id: "th-states-fill",
          type: "fill",
          source: "th-states",
          paint: {
            "fill-color": "#0ea5e9",
            "fill-opacity": 0.12,
          },
        },
        "village-symbol"
      );
    }

    if (!map.getLayer("th-states-outline")) {
      map.addLayer(
        {
          id: "th-states-outline",
          type: "line",
          source: "th-states",
          paint: {
            "line-color": "#0284c7",
            "line-width": 1,
          },
        },
        "village-symbol"
      );
    }
  }, []);

  const removeStatesLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (map.getLayer("th-states-outline"))
        map.removeLayer("th-states-outline");
      if (map.getLayer("th-states-fill")) map.removeLayer("th-states-fill");
      if (map.getSource("th-states")) map.removeSource("th-states");
    } catch (err) {
      console.warn("removeStatesLayer error:", err);
    }
  }, []);

  const addDistrictsLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource("th-districts")) {
      map.addSource("th-districts", {
        type: "geojson",
        data: thailandDistrictsGeoJson,
      });
    }

    if (!map.getLayer("th-districts-fill")) {
      map.addLayer(
        {
          id: "th-districts-fill",
          type: "fill",
          source: "th-districts",
          paint: {
            "fill-color": "#22c55e",
            "fill-opacity": 0.1,
          },
        },
        "village-symbol"
      );
    }

    if (!map.getLayer("th-districts-outline")) {
      map.addLayer(
        {
          id: "th-districts-outline",
          type: "line",
          source: "th-districts",
          paint: {
            "line-color": "#16a34a",
            "line-width": 0.7,
          },
        },
        "village-symbol"
      );
    }
  }, []);

  const removeDistrictsLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (map.getLayer("th-districts-outline"))
        map.removeLayer("th-districts-outline");
      if (map.getLayer("th-districts-fill"))
        map.removeLayer("th-districts-fill");
      if (map.getSource("th-districts")) map.removeSource("th-districts");
    } catch (err) {
      console.warn("removeDistrictsLayer error:", err);
    }
  }, []);

  const handleToggleStates = useCallback(() => {
    setShowStates((prev) => {
      const next = !prev;
      if (next) addStatesLayer();
      else removeStatesLayer();
      return next;
    });
  }, [addStatesLayer, removeStatesLayer]);

  const handleToggleDistricts = useCallback(() => {
    setShowDistricts((prev) => {
      const next = !prev;
      if (next) addDistrictsLayer();
      else removeDistrictsLayer();
      return next;
    });
  }, [addDistrictsLayer, removeDistrictsLayer]);

  // helper: add / update layer highlight kết quả search
  const addOrUpdateSearchLayer = useCallback((map, geojson) => {
    if (!map) return;

    const hasPolygon = geojson.features.some((f) =>
      ["Polygon", "MultiPolygon"].includes(f.geometry.type)
    );

    if (map.getSource("search-result")) {
      map.getSource("search-result").setData(geojson);
    } else {
      map.addSource("search-result", {
        type: "geojson",
        data: geojson,
      });

      if (hasPolygon) {
        // fill dưới, line viền
        if (!map.getLayer("search-result-fill")) {
          map.addLayer(
            {
              id: "search-result-fill",
              type: "fill",
              source: "search-result",
              paint: {
                "fill-color": "#0078ff",
                "fill-opacity": 0.18,
              },
            },
            "village-symbol"
          );
        }

        if (!map.getLayer("search-result-outline")) {
          map.addLayer(
            {
              id: "search-result-outline",
              type: "line",
              source: "search-result",
              paint: {
                "line-color": "#0078ff",
                "line-width": 2,
              },
            },
            "village-symbol"
          );
        }
      } else {
        // chỉ là điểm
        if (!map.getLayer("search-result-point")) {
          map.addLayer(
            {
              id: "search-result-point",
              type: "circle",
              source: "search-result",
              paint: {
                "circle-radius": 7,
                "circle-color": "#0078ff",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              },
            },
            "village-symbol"
          );
        }
      }
    }

    searchGeoJsonRef.current = geojson;
  }, []);

  // clear search layer (dùng khi Reset view)
  const clearSearchLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    [
      "search-result-fill",
      "search-result-outline",
      "search-result-point",
    ].forEach((id) => {
      if (map.getLayer(id)) {
        try {
          map.removeLayer(id);
        } catch {}
      }
    });

    if (map.getSource("search-result")) {
      try {
        map.removeSource("search-result");
      } catch {}
    }

    searchGeoJsonRef.current = null;
  }, []);

  // RESET VIEW
  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    clearSearchLayer();
    setSearchText("");
    setSuggestions([]);
    setSearchError("");

    setModalVisible(false);
    setModalStats(null);

    // tắt states & districts + remove layers để đỡ lag
    removeStatesLayer();
    removeDistrictsLayer();
    setShowStates(false);
    setShowDistricts(false);

    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      duration: 600,
      bearing: 0,
      pitch: 0,
    });
  }, [clearSearchLayer, removeStatesLayer, removeDistrictsLayer]);

  // ================== onClickVillage (map + widgets) ==================
  const onClickVillage = useCallback(
    async (maybeEventOrFeature) => {
      try {
        const map = mapRef.current;
        if (!map) return;

        let feature = null;

        if (maybeEventOrFeature && maybeEventOrFeature.features) {
          feature = maybeEventOrFeature.features[0]; // from map click
        } else if (maybeEventOrFeature && maybeEventOrFeature.properties) {
          feature = maybeEventOrFeature; // from RightTopWidgets
        }

        if (!feature) return;

        const name = feature.properties?.name;
        const coords = feature.geometry?.coordinates;

        let lngLat = null;
        if (
          coords &&
          (feature.geometry.type === "Point" ||
            feature.geometry.type === "MultiPoint")
        ) {
          const [lon, lat] = coords;
          lngLat = { lng: lon, lat };
        } else if (feature.bbox && feature.bbox.length === 4) {
          const [minLon, minLat, maxLon, maxLat] = feature.bbox;
          lngLat = { lng: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2 };
        }

        if (lngLat) {
          map.easeTo({
            center: [lngLat.lng, lngLat.lat],
            zoom: Math.max(map.getZoom(), 8),
            duration: 600,
          });
        }

        const apiData = await fakeFetchVillageStatsByName(name);

        onSelectVillage(name, apiData);

        setModalTitle(name);
        setModalStats(apiData || null);
        setModalVisible(true);
      } catch (err) {
        console.error("onClickVillage error:", err);
      }
    },
    [onSelectVillage]
  );

  // ================== AUTOCOMPLETE: CALL NOMINATIM ==================
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
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        if (canceled) return;

        const feats = data.features || [];
        setSuggestions(feats);
        if (feats.length === 0) setSearchError("Không tìm thấy kết quả.");
      } catch (err) {
        if (canceled) return;
        console.error(err);
        setSearchError("Có lỗi khi gọi Nominatim.");
        setSuggestions([]);
      } finally {
        if (!canceled) setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 400);

    return () => {
      canceled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchText]);

  // handleSelectSuggestion (chọn gợi ý)
  const handleSelectSuggestion = useCallback(
    (feature) => {
      const map = mapRef.current;
      if (!map) return;

      setSuggestions([]);
      const { properties, geometry, bbox } = feature;

      if (properties?.display_name) {
        setSearchText(properties.display_name);
      }

      if (geometry) {
        const geojson = {
          type: "FeatureCollection",
          features: [feature],
        };
        addOrUpdateSearchLayer(map, geojson);
      } else {
        clearSearchLayer();
      }

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
        map.easeTo({
          center: [lon, lat],
          zoom: 10,
          duration: 800,
        });
      }
    },
    [addOrUpdateSearchLayer, clearSearchLayer]
  );

  // INIT MAP
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
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        addVillageLayers(map);

        const clickableLayers = ["village-symbol", "village-name"];

        clickableLayers.forEach((layerId) => {
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("click", layerId, onClickVillage);
        });
      });

      map.on("styledata", () => {
        addVillageLayers(map);

        if (searchGeoJsonRef.current) {
          addOrUpdateSearchLayer(map, searchGeoJsonRef.current);
        }

        // re-apply boundaries nếu đang bật
        if (showStates) addStatesLayer();
        if (showDistricts) addDistrictsLayer();
      });
    })();

    return () => {
      canceled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapStyles[style]);
  }, [style]);

  // render danh sách gợi ý
  const renderSuggestions = () => {
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
              onClick={() => handleSelectSuggestion(f)}
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

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      {/* Search (top-left) */}
      <div
        style={{
          position: "absolute",
          left: 10,
          top: 10,
          zIndex: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
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
            style={{
              border: "none",
              outline: "none",
              flex: 1,
              fontSize: 13,
            }}
          />
          {isSearching && (
            <span style={{ fontSize: 12, color: "#999", marginRight: 4 }}>
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
              padding: "6px 10px",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
              fontSize: 12,
              color: "red",
              maxWidth: 360,
            }}
          >
            {searchError}
          </div>
        )}
      </div>

      {/* suggestion dropdown */}
      {renderSuggestions()}

      {/* bottom-left controls: tách ra component riêng */}
      <MapLayerControls
        styleName={style}
        onChangeStyle={setStyle}
        onResetView={handleResetView}
        showStates={showStates}
        showDistricts={showDistricts}
        onToggleStates={handleToggleStates}
        onToggleDistricts={handleToggleDistricts}
      />

      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Modal (React) */}
      <CenterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalTitle}
        stats={modalStats}
      />

      {/* Right widgets — pass the shared onClickVillage handler */}
      <RightTopWidgets
        data={data}
        onClickVillage={onClickVillage}
        loading={false}
      />
    </div>
  );
};

export default MapEmbedded;
