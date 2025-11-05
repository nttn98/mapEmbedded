// src/pages/MapEmbedded.js
import React, { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  villagesGeoJson,
  fakeFetchVillageStatsByName,
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
    const size = 150;
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
        const duration = 2000;
        const t = (performance.now() % duration) / duration;

        const radius = (size / 2) * 0.25;
        const outerRadius = (size / 2) * 0.7 * t + radius;
        const ctx = this.context;

        ctx.clearRect(0, 0, this.width, this.height);

        // outer
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 0, 0, ${1 - t})`;
        ctx.fill();

        // inner
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
        "text-field": ["to-string", ["get", "count"]],
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
  const popupRef = useRef(null);
  const searchGeoJsonRef = useRef(null); // geojson highlight

  // helper: add / update layer highlight kết quả search
  const addOrUpdateSearchLayer = (map, geojson) => {
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
                "fill-opacity": 0.2,
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
    }

    searchGeoJsonRef.current = geojson;
  };

  // clear search layer (dùng khi Reset view)
  const clearSearchLayer = () => {
    const map = mapRef.current;
    if (!map) return;

    [
      "search-result-fill",
      "search-result-outline",
      "search-result-point",
    ].forEach((id) => {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    });

    if (map.getSource("search-result")) {
      map.removeSource("search-result");
    }

    searchGeoJsonRef.current = null;
  };

  // RESET VIEW
  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    clearSearchLayer();
    setSearchText("");
    setSuggestions([]);
    setSearchError("");

    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      duration: 600,
      bearing: 0,
      pitch: 0,
    });
  };

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

  // chọn 1 gợi ý
  const handleSelectSuggestion = (feature) => {
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
  };

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

        // CLICK VILLAGE -> chỉ lúc này mới gọi fake API + popup
        const onClickVillage = async (e) => {
          const feature = e.features && e.features[0];
          if (!feature) return;

          const name = feature.properties?.name;
          const coordinates = feature.geometry.coordinates;
          const lngLat = { lng: coordinates[0], lat: coordinates[1] };

          // zoom nhẹ vào village
          map.easeTo({
            center: [lngLat.lng, lngLat.lat],
            zoom: Math.max(map.getZoom(), 8),
            duration: 600,
          });

          // GỌI FAKE API
          const apiData = await fakeFetchVillageStatsByName(name);
          onSelectVillage(name, apiData);

          // POPUP DETAIL
          if (!popupRef.current) {
            const { default: _defaultMaybe } = maplibreRef.current;
            const lib =
              typeof _defaultMaybe === "function"
                ? _defaultMaybe
                : maplibreRef.current;
            const PopupClass = lib.Popup || lib; // fallback
            popupRef.current = new PopupClass({ closeButton: true });
          }

          let html = `<b>${name}</b>`;
          if (apiData?.detail) {
            const d = apiData.detail;
            const yearLines = d.years
              .map(
                (x) =>
                  `<div>Year: <b>${x.year}</b> = <span style="color:red;">${x.case_sum}</span></div>`
              )
              .join("");

            html = `
              <div style="font-family: sans-serif; font-size: 12px;">
                <div><b>Village: ${d.village_name}</b></div>
                <div style="margin-top:4px;">
                  Detail | <b>${d.from_date}</b> -> <b>${d.to_date}</b>
                </div>
                <div style="margin-top:8px;">
                  ${yearLines}
                </div>
              </div>
            `;
          }

          popupRef.current.setLngLat(lngLat).setHTML(html).addTo(map);
        };

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
        map.remove();
      };
    })();

    return () => {
      canceled = true;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
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

  // render danh sách gợi ý dưới ô search
  const renderSuggestions = () => {
    if (!suggestions.length) return null;

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

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {/* Search + control panel */}
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
        {/* ô search giống screenshot */}
        <div
          style={{
            background: "#fff",
            padding: "4px 8px",
            borderRadius: 999,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            minWidth: 260,
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
            }}
          >
            {searchError}
          </div>
        )}

        {/* panel điều khiển */}
        <div
          style={{
            background: "#fff",
            padding: 10,
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: 180,
          }}
        >
          <h4 style={{ marginBottom: 8 }}>Village Map</h4>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <button onClick={() => setStyle("light")}>Light</button>
          </div>
          <button onClick={handleResetView}>Reset view</button>
        </div>
      </div>

      {/* suggestion dropdown */}
      {renderSuggestions()}

      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default MapEmbedded;
