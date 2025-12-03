import React, { useEffect, useRef, useState, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

import RightTopWidgets from "../components/RightTopWidgets";
import CenterModal from "../components/CenterModal";
import MapLayerControls from "../components/MapLayerControls";

import top3Image from "../assets/top3.png";
import {
  villagesGeoJson,
  fakeFetchVillageStatsByName,
} from "../services/dataVillageApi";

import thailandStatesGeoJson from "../data/Thailand_states_provinces.simplified.geojson";
import thailandDistrictsGeoJson from "../data/Thailand_districts_counties.simplified.geojson";

import { addVillageLayers } from "../map/layers/villageLayers";
import {
  addStatesLayer,
  removeStatesLayer,
  addDistrictsLayer,
  removeDistrictsLayer,
} from "../map/layers/boundaryLayers";

import {
  addOrUpdateSearchLayer,
  clearSearchLayer,
} from "../map/search/searchLayer";
import useNominatimSearch from "../map/search/useNominatimSearch";
import SearchBox from "../map/search/SearchBox";
import SuggestionsList from "../map/search/SuggestionsList";

// CONFIG
const DEFAULT_CENTER = [98.8, 16.8];
const DEFAULT_ZOOM = 6;
const mapStyles = {
  light: "https://tiles.openfreemap.org/styles/bright",
};

const DEBUG = false;

// Helper: same normalization logic used in the layer file so UI and layers agree
function normalizeVillageGeoJSON(vg) {
  if (!vg || !Array.isArray(vg.features))
    return { type: "FeatureCollection", features: [] };

  const features = vg.features.map((orig) => {
    const f = { ...orig };
    f.properties = { ...(orig.properties || {}) };
    const p = f.properties;

    // display_name: prefer village_name then name then village then empty
    p.display_name = p.village_name || p.name || p.village || "";

    // derive label_count:
    let labelCount = null;
    if (p.count != null) labelCount = Number(p.count);
    else if (p.cases != null) labelCount = Number(p.cases);
    else if (p.case_sum != null) labelCount = Number(p.case_sum);
    else if (Array.isArray(p.years) && p.years.length) {
      try {
        const latest = p.years
          .slice()
          .filter((y) => y && (y.case_sum != null || y.case_sum === 0))
          .sort((a, b) => (b.year || 0) - (a.year || 0))[0];
        if (latest && latest.case_sum != null)
          labelCount = Number(latest.case_sum);
      } catch (e) {
        // ignore
      }
    }
    p.label_count = isFinite(labelCount) ? labelCount : "";

    // create point geometry if missing and lat/lng available (ensure [lon, lat])
    try {
      const rawLon = p.longitude ?? p.lon ?? p.lng;
      const rawLat = p.latitude ?? p.lat;
      let lon = rawLon != null ? Number(rawLon) : NaN;
      let lat = rawLat != null ? Number(rawLat) : NaN;

      // fallback to geometry if provided
      if ((!lon && !lat) || !isFinite(lon) || !isFinite(lat)) {
        if (f.geometry && Array.isArray(f.geometry.coordinates)) {
          const a = Number(f.geometry.coordinates[0]);
          const b = Number(f.geometry.coordinates[1]);
          if (isFinite(a) && isFinite(b)) {
            // heuristics: if a in [-180,180] and b in [-90,90] assume [lon,lat]
            if (Math.abs(a) <= 180 && Math.abs(b) <= 90) {
              lon = a;
              lat = b;
            } else if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
              // probably [lat,lon] -> swap
              lon = b;
              lat = a;
            } else {
              lon = a;
              lat = b;
            }
          }
        }
      }

      // sanity swaps if values look reversed
      if (isFinite(lon) && isFinite(lat)) {
        if ((lat > 90 || lat < -90) && lon <= 90 && lon >= -90) {
          const tmp = lon;
          lon = lat;
          lat = tmp;
        }
        if (
          (lon > 180 || lon < -180) &&
          lat <= 180 &&
          lat >= -180 &&
          Math.abs(lat) <= 180
        ) {
          const tmp = lon;
          lon = lat;
          lat = tmp;
        }
      }

      if (
        (!f.geometry || f.geometry.type !== "Point") &&
        isFinite(lon) &&
        isFinite(lat)
      ) {
        f.geometry = { type: "Point", coordinates: [Number(lon), Number(lat)] };
      } else if (
        f.geometry &&
        f.geometry.type === "Point" &&
        Array.isArray(f.geometry.coordinates)
      ) {
        const [c0, c1] = f.geometry.coordinates;
        if (isFinite(c0) && isFinite(c1)) {
          // ensure numbers
          f.geometry.coordinates = [
            Number(f.geometry.coordinates[0]),
            Number(f.geometry.coordinates[1]),
          ];
        }
      }
    } catch (e) {
      // ignore coordinate normalization errors
    }

    return f;
  });

  return { ...vg, features };
}

const MapEmbedded = ({
  onSelectVillage = () => {},
  onNavigateToReport,
  reportPath = "/dashboard/report",
}) => {
  const [style, setStyle] = useState("light");
  const [selectedVillage, setSelectedVillage] = useState(null);

  const [showStates, setShowStates] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);

  // modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalStats, setModalStats] = useState(null);

  // data (store normalized geojson so UI components can read display_name/label_count)
  const [data, setData] = useState({ type: "FeatureCollection", features: [] });

  // search hook
  const {
    searchText,
    setSearchText,
    suggestions,
    isSearching,
    searchError,
    handleSelectSuggestion,
    clearSearch,
  } = useNominatimSearch({ mapRef, addOrUpdateSearchLayer, clearSearchLayer });

  // get villages data -> normalize for UI
  useEffect(() => {
    try {
      const rs = villagesGeoJson;
      if (!rs) return;
      const normalized = normalizeVillageGeoJSON(rs);
      setData(normalized);
    } catch (err) {
      console.error("failed to load villagesGeoJson:", err);
    }
  }, []);

  // toggle boundaries
  const handleToggleStates = useCallback(() => {
    setShowStates((prev) => {
      const next = !prev;
      const map = mapRef.current;
      if (next) addStatesLayer(map, thailandStatesGeoJson);
      else removeStatesLayer(map);
      return next;
    });
  }, []);

  const handleToggleDistricts = useCallback(() => {
    setShowDistricts((prev) => {
      const next = !prev;
      const map = mapRef.current;
      if (next) addDistrictsLayer(map, thailandDistrictsGeoJson);
      else removeDistrictsLayer(map);
      return next;
    });
  }, []);

  const clearSearchLayerWrapper = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    clearSearchLayer(map);
  }, []);

  // click handler for villages: accept either map click event or feature object
  const onClickVillage = useCallback(
    async (maybeEventOrFeature) => {
      try {
        const map = mapRef.current;
        if (!map) return;

        let feature = null;
        if (maybeEventOrFeature && maybeEventOrFeature.features) {
          feature = maybeEventOrFeature.features[0];
        } else if (maybeEventOrFeature && maybeEventOrFeature.properties) {
          feature = maybeEventOrFeature;
        }

        if (!feature) return;

        // prefer display_name (normalized) then village_name then name
        const props = feature.properties || {};
        const name =
          props.display_name || props.village_name || props.name || "";

        // if still empty, try to derive a fallback (village_id)
        const fallbackName = props.village_id || props.id || "";
        const chosenName = name || fallbackName;
        if (!chosenName) {
          console.warn("Clicked feature has no name/village_name/display_name");
        }

        setSelectedVillage(chosenName);

        // compute center
        let lngLat = null;
        const coords = feature.geometry?.coordinates;
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

        // fetch api by chosenName — fakeFetchVillageStatsByName should accept that key
        const apiData = await fakeFetchVillageStatsByName(chosenName);

        onSelectVillage(chosenName, apiData);

        setModalTitle(chosenName);
        setModalStats(apiData || null);
        setModalVisible(true);
      } catch (err) {
        console.error("onClickVillage error:", err);
      }
    },
    [onSelectVillage]
  );

  // --- Utility: ensure images are present on the map (we still add top3-marker safely) ---
  async function ensureImages(map) {
    if (!map) return;

    const hasImageSafe = (name) =>
      typeof map.hasImage === "function" ? map.hasImage(name) : false;

    // 1) Try to add top3-marker but defensively remove existing id first
    try {
      if (top3Image) {
        try {
          if (
            typeof map.hasImage === "function" &&
            map.hasImage("top3-marker")
          ) {
            try {
              if (typeof map.removeImage === "function")
                map.removeImage("top3-marker");
              if (DEBUG)
                console.debug("removed existing top3-marker before re-adding");
            } catch (remErr) {
              if (DEBUG)
                console.warn("removeImage('top3-marker') failed:", remErr);
            }
          }
        } catch (e) {}

        try {
          const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.crossOrigin = "anonymous";
            i.onload = () => resolve(i);
            i.onerror = (err) => reject(err);
            i.src = top3Image;
          });

          const cw = img.naturalWidth || img.width || 64;
          const ch = img.naturalHeight || img.height || 64;
          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, cw, ch);

          try {
            map.addImage("top3-marker", canvas, { pixelRatio: 1 });
            if (DEBUG) console.debug("registered top3-marker");
          } catch (addErr) {
            if (!/already exists/i.test(addErr?.message || "")) {
              console.warn("ensureImages addImage top3-marker failed:", addErr);
            } else {
              if (DEBUG) console.debug("top3-marker already exists (caught)");
            }
          }
        } catch (loadErr) {
          if (DEBUG) console.warn("ensureImages top3 load failed:", loadErr);
        }
      }
    } catch (e) {
      if (DEBUG) console.warn("ensureImages top3 outer error:", e);
    }
  }

  // move village layers to be before first symbol layer (so they appear below labels)
  function moveVillageLayersBelowLabels(map) {
    if (!map || !map.getStyle) return;
    try {
      const layers = (map.getStyle() && map.getStyle().layers) || [];
      let firstSymbolId = null;
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === "symbol") {
          firstSymbolId = layers[i].id;
          break;
        }
      }
      if (!firstSymbolId) return;

      // known village layer ids created by addVillageLayers
      const candidateLayers = [
        "village-name",
        "village-symbol",
        "village-fill",
        "village-circle",
      ];
      candidateLayers.forEach((lid) => {
        try {
          if (map.getLayer && map.getLayer(lid)) {
            map.moveLayer(lid, firstSymbolId);
          }
        } catch (e) {
          // ignore individual failures
        }
      });
    } catch (e) {
      console.warn("moveVillageLayersBelowLabels error:", e);
    }
  }

  // INIT MAP
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
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

        // expose click handler for DOM-marker fallback
        map.__onClickVillage = onClickVillage;

        // prepare normalized geojson here and pass to addVillageLayers
        const normalized = normalizeVillageGeoJSON(villagesGeoJson);

        map.on("load", async () => {
          try {
            if (canceled) return;

            // ensure images exist (we still add top3-marker for convenience)
            await ensureImages(map);

            // call addVillageLayers but don't await to avoid throwing errors up
            addVillageLayers(map, normalized, top3Image)
              .then(() => {
                try {
                  // attach clickable handlers (only if layers exist)
                  const clickableLayers = ["village-symbol", "village-name"];
                  clickableLayers.forEach((layerId) => {
                    try {
                      if (map.getLayer && map.getLayer(layerId)) {
                        map.on("mouseenter", layerId, () => {
                          try {
                            map.getCanvas().style.cursor = "pointer";
                          } catch {}
                        });
                        map.on("mouseleave", layerId, () => {
                          try {
                            map.getCanvas().style.cursor = "";
                          } catch {}
                        });
                        map.on("click", layerId, onClickVillage);
                      }
                    } catch (e) {
                      // skip layer if not present
                    }
                  });

                  // Move village layers to below labels
                  moveVillageLayersBelowLabels(map);

                  // apply states/district layers if toggled
                  if (showStates) addStatesLayer(map, thailandStatesGeoJson);
                  if (showDistricts)
                    addDistrictsLayer(map, thailandDistrictsGeoJson);
                } catch (e) {
                  if (DEBUG)
                    console.warn(
                      "post addVillageLayers then() handler failed:",
                      e
                    );
                }
              })
              .catch((err) => {
                console.warn("addVillageLayers (load) threw:", err);
                // even if adding villageLayers fails, still try to add states/districts
                if (showStates) addStatesLayer(map, thailandStatesGeoJson);
                if (showDistricts)
                  addDistrictsLayer(map, thailandDistrictsGeoJson);
              });

            // debug: print source after a tick
            setTimeout(() => {
              try {
                const src = map.getSource && map.getSource("villages");
                console.debug(
                  "villages source after add:",
                  !!src,
                  src &&
                    src._data &&
                    src._data.features &&
                    src._data.features.length
                );
                if (DEBUG) {
                  console.debug(
                    "hasImage top3-marker:",
                    map.hasImage && map.hasImage("top3-marker")
                  );
                }
              } catch (e) {
                console.warn(e);
              }
            }, 50);
          } catch (e) {
            console.error("map load handler error:", e);
          }
        });

        map.on("styledata", async () => {
          try {
            // only proceed if style fully loaded
            if (
              typeof map.isStyleLoaded === "function" &&
              !map.isStyleLoaded()
            ) {
              if (DEBUG)
                console.debug(
                  "styledata fired but style not loaded yet - skipping"
                );
              return;
            }

            // Re-add images (images are lost after setStyle)
            await ensureImages(map);

            // Re-add village layers & boundaries because setStyle resets sources/layers
            const normalizedAgain = normalizeVillageGeoJSON(villagesGeoJson);
            addVillageLayers(map, normalizedAgain, top3Image)
              .then(() => {
                // reattach click handlers (they may be removed when style resets)
                const clickableLayers = ["village-symbol", "village-name"];
                clickableLayers.forEach((layerId) => {
                  try {
                    // remove old listeners safely
                    map.off("mouseenter", layerId);
                    map.off("mouseleave", layerId);
                    map.off("click", layerId);
                  } catch {}
                  try {
                    if (map.getLayer && map.getLayer(layerId)) {
                      map.on("mouseenter", layerId, () => {
                        try {
                          map.getCanvas().style.cursor = "pointer";
                        } catch {}
                      });
                      map.on("mouseleave", layerId, () => {
                        try {
                          map.getCanvas().style.cursor = "";
                        } catch {}
                      });
                      map.on("click", layerId, onClickVillage);
                    }
                  } catch (e) {
                    // ignore
                  }
                });

                if (showStates) addStatesLayer(map, thailandStatesGeoJson);
                if (showDistricts)
                  addDistrictsLayer(map, thailandDistrictsGeoJson);

                // ensure village layers are placed below label symbols
                moveVillageLayersBelowLabels(map);
              })
              .catch((err) => {
                console.warn("addVillageLayers (styledata) failed:", err);
              });
          } catch (e) {
            console.warn("styledata handler error:", e);
          }
        });
      } catch (err) {
        console.error("Failed initializing map:", err);
      }
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

  // change style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(mapStyles[style]);
    } catch (e) {
      console.warn("setStyle failed:", e);
    }
  }, [style]);

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear search highlight
    clearSearchLayerWrapper();
    // clear search input/got suggestions
    setSearchText("");

    // hide modal
    setModalVisible(false);
    setModalStats(null);

    // remove boundaries for perf
    removeStatesLayer(map);
    removeDistrictsLayer(map);
    setShowStates(false);
    setShowDistricts(false);

    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      duration: 600,
      bearing: 0,
      pitch: 0,
    });
  }, [clearSearchLayerWrapper, setSearchText]);

  const handleOpenReport = useCallback(() => {
    if (typeof onNavigateToReport === "function") {
      try {
        onNavigateToReport();
        return;
      } catch (e) {
        console.warn("onNavigateToReport threw:", e);
      }
    }
    window.location.href = reportPath;
  }, [onNavigateToReport, reportPath]);

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
        <SearchBox
          searchText={searchText}
          setSearchText={setSearchText}
          isSearching={isSearching}
          onClear={() => {
            setSearchText("");
            clearSearch();
          }}
        />
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
      <SuggestionsList
        suggestions={suggestions}
        onSelect={handleSelectSuggestion}
      />

      {/* MapLayerControls */}
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

      {/* Modal */}
      <CenterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalTitle}
        stats={modalStats}
      />

      {/* Right widgets */}
      <RightTopWidgets
        data={data}
        onClickVillage={onClickVillage}
        loading={false}
        selectedVillage={selectedVillage}
        onClearSelection={() => setSelectedVillage(null)}
      />
    </div>
  );
};

export default MapEmbedded;
