// src/map/search/useNominatimSearch.js
// Hook that manages searchText, suggestions, and calling Nominatim.
// Accepts the mapRef plus helpers to draw search layer.

import { useEffect, useState, useRef, useCallback } from "react";

export default function useNominatimSearch({
  mapRef,
  addOrUpdateSearchLayer,
  clearSearchLayer,
}) {
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearchError("");
      return;
    }

    let canceled = false;
    const controller = new AbortController();
    abortRef.current = controller;

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
        const feats = data.features || [];
        setSuggestions(feats);
        if (feats.length === 0) setSearchError("Không tìm thấy kết quả.");
      } catch (err) {
        if (canceled) return;
        console.error("nominatim error:", err);
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

  const handleSelectSuggestion = useCallback(
    (feature) => {
      const map = mapRef?.current;
      if (!map) return;

      setSuggestions([]);
      const { properties, geometry, bbox } = feature;

      if (properties?.display_name) {
        setSearchText(properties.display_name);
      }

      if (geometry) {
        const geojson = { type: "FeatureCollection", features: [feature] };
        try {
          addOrUpdateSearchLayer(map, geojson);
        } catch (err) {
          console.warn("addOrUpdateSearchLayer failed", err);
        }
      } else {
        clearSearchLayer(map);
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
        map.easeTo({ center: [lon, lat], zoom: 10, duration: 800 });
      }
    },
    [mapRef, addOrUpdateSearchLayer, clearSearchLayer]
  );

  return {
    searchText,
    setSearchText,
    suggestions,
    isSearching,
    searchError,
    handleSelectSuggestion,
    clearSearch: () => {
      const map = mapRef?.current;
      if (map) clearSearchLayer(map);
    },
  };
}
