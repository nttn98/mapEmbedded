// src/pages/MapEmbedded.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import RightTopWidgets from "../components/RightTopWidgets";
import CenterModal from "../components/CenterModal";

import {
  villagesGeoJson,
  fakeFetchVillageStatsByName,
  // fakeVillageStatsByName, // not used here but available in your service
} from "../services/fakeVillageApi";

// ================== CONFIG MAP ==================
const DEFAULT_CENTER = [98.8, 16.8]; // giữa vùng village
const DEFAULT_ZOOM = 6;

const mapStyles = {
  light: "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
};

// ====== TẠO IMAGE PULSING + LAYER VILLAGE ======
const addVillageLayers = (map) => {
  if (!map) return;

  // 1) Image pulsing-dot (animation luôn chạy)
  if (!map.hasImage("pulsing-dot-small")) {
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

        map.triggerRepaint();
        return true;
      },
    };

    map.addImage("pulsing-dot-small", pulsingDot, { pixelRatio: 2 });
  }

  // 2) Source villages (nếu chưa có)
  if (!map.getSource("villages")) {
    map.addSource("villages", {
      type: "geojson",
      data: villagesGeoJson,
    });
  } else {
    // nếu đã có source, cập nhật data (an toàn khi reload style)
    try {
      map.getSource("villages")?.setData?.(villagesGeoJson);
    } catch (err) {
      // some styles may recreate sources; ignore
    }
  }

  // 3) Symbol layer: icon pulsing + số (count) ở giữa
  if (!map.getLayer("village-symbol")) {
    map.addLayer({
      id: "village-symbol",
      type: "symbol",
      source: "villages",
      layout: {
        "icon-image": "pulsing-dot-small",
        "icon-size": 0.6,
        "icon-anchor": "center",
        // show all icons even when crowded
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,

        "text-field": ["to-string", ["get", "count"]],
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
  }

  // 4) Tên village bên dưới
  if (!map.getLayer("village-name")) {
    map.addLayer({
      id: "village-name",
      type: "symbol",
      source: "villages",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-anchor": "top",
        "text-offset": [0, 1.4],
        // keep names readable but allow overlap when crowded
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#b30000",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1,
      },
    });
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
      if (!rs) return null;
      setData(rs);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  useEffect(() => {
    getVillagesData();
  }, [getVillagesData]);

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
        } catch (err) {
          // ignore
        }
      }
    });

    if (map.getSource("search-result")) {
      try {
        map.removeSource("search-result");
      } catch (err) {
        // ignore
      }
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

    // close modal if any
    setModalVisible(false);
    setModalStats(null);

    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      duration: 600,
      bearing: 0,
      pitch: 0,
    });
  }, [clearSearchLayer]);

  // ============================
  // onClickVillage: single handler dùng cho map click & Top5 click
  // Accept either: (eventFromMap) or (feature)
  // ============================
  const onClickVillage = useCallback(
    async (maybeEventOrFeature) => {
      try {
        const map = mapRef.current;
        if (!map) return;

        // extract feature
        let feature = null;

        // case A: called from map event (maplibre event has .features)
        if (maybeEventOrFeature && maybeEventOrFeature.features) {
          feature = maybeEventOrFeature.features[0];
        } else if (maybeEventOrFeature && maybeEventOrFeature.properties) {
          // case B: called from Top5Card with feature object
          feature = maybeEventOrFeature;
        }

        if (!feature) return;

        const name = feature.properties?.name;
        const coords = feature.geometry?.coordinates;

        // if point, get lon/lat
        let lngLat = null;
        if (
          coords &&
          (feature.geometry.type === "Point" ||
            feature.geometry.type === "MultiPoint")
        ) {
          const [lon, lat] = coords;
          lngLat = { lng: lon, lat };
        } else if (feature.bbox && feature.bbox.length === 4) {
          // fallback: center of bbox
          const [minLon, minLat, maxLon, maxLat] = feature.bbox;
          lngLat = { lng: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2 };
        }

        // zoom nhẹ vào village nếu có tọa độ
        if (lngLat) {
          map.easeTo({
            center: [lngLat.lng, lngLat.lat],
            zoom: Math.max(map.getZoom(), 8),
            duration: 600,
          });
        }

        // GỌI FAKE API (dùng hàm từ service)
        const apiData = await fakeFetchVillageStatsByName(name);

        // callback lên parent (nếu cần)
        onSelectVillage(name, apiData);

        // show React modal (centered, 1/3 screen)
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
            // NOTE: tốt nhất nên gọi từ backend và set User-Agent ở server
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

    // debounce nhẹ
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

      // set text lên input
      if (properties?.display_name) {
        setSearchText(properties.display_name);
      }

      // highlight geometry
      if (geometry) {
        const geojson = {
          type: "FeatureCollection",
          features: [feature],
        };
        addOrUpdateSearchLayer(map, geojson);
      } else {
        clearSearchLayer();
      }

      // zoom theo bbox nếu có, không thì dùng point
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
      const maplibregl = await import("maplibre-gl");
      if (canceled) return;

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

        // Hover đổi cursor
        clickableLayers.forEach((layerId) => {
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        });

        // CLICK VILLAGE -> gọi onClickVillage (chung)
        clickableLayers.forEach((layerId) => {
          map.on("click", layerId, onClickVillage);
        });
      });

      // Khi đổi style – re-add layers + search result
      map.on("styledata", () => {
        addVillageLayers(map);

        if (searchGeoJsonRef.current) {
          addOrUpdateSearchLayer(map, searchGeoJsonRef.current);
        }
      });

      return () => {
        try {
          map.remove();
        } catch (err) {
          // ignore
        }
      };
    })();

    return () => {
      canceled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (err) {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi style (hiện tại chỉ có light nhưng để sẵn)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapStyles[style]);
  }, [style]);

  // render danh sách gợi ý (top-right)
  const renderSuggestions = () => {
    if (!suggestions.length) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: 52,
          right: 10,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          zIndex: 1200,
          maxHeight: 300,
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

      {/* compact control - bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          zIndex: 1200,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: "#fff",
            padding: "6px",
            borderRadius: 9,
            boxShadow: "0 8px 22px rgba(0,0,0,0.10)",
            minWidth: 110,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>
            Map
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setStyle("light")}
              style={{
                padding: "6px 8px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #eef2f6",
                background: "#f8fbff",
                cursor: "pointer",
              }}
              aria-label="Light style"
            >
              Light
            </button>

            <button
              onClick={handleResetView}
              style={{
                padding: "6px 8px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #eef2f6",
                background: "#fff",
                cursor: "pointer",
              }}
              aria-label="Reset view"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

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
