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
  light: "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
};

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

    // create point geometry if missing and lat/lng available
    if (
      (!f.geometry || f.geometry.type !== "Point") &&
      p.latitude != null &&
      p.longitude != null
    ) {
      f.geometry = {
        type: "Point",
        coordinates: [Number(p.longitude), Number(p.latitude)],
      };
    }

    return f;
  });

  return { ...vg, features };
}

const MapEmbedded = ({ onSelectVillage = () => {} }) => {
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

        // prepare normalized geojson here and pass to addVillageLayers
        const normalized = normalizeVillageGeoJSON(villagesGeoJson);

        map.on("load", () => {
          // debug: đảm bảo style đã load
          console.debug(
            "map load — adding village layers. normalized.features:",
            (normalized && normalized.features && normalized.features.length) ||
              0
          );

          // pass normalized geojson explicitly
          addVillageLayers(map, normalized, top3Image);

          // add clickable handlers
          const clickableLayers = ["village-symbol", "village-name"];
          clickableLayers.forEach((layerId) => {
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
            } catch (e) {
              console.warn(e);
            }
          }, 50);
        });

        map.on("styledata", () => {
          // re-apply village layers using the same normalized data
          addVillageLayers(map, normalized, top3Image);

          if (showStates) addStatesLayer(map, thailandStatesGeoJson);
          if (showDistricts) addDistrictsLayer(map, thailandDistrictsGeoJson);
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
    map.setStyle(mapStyles[style]);
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
