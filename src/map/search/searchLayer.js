// src/map/search/searchLayer.js
// helpers to add/update/remove a search highlight layer on the map.

export const addOrUpdateSearchLayer = (map, geojson) => {
  if (!map || !geojson) return;

  const hasPolygon = geojson.features.some((f) =>
    ["Polygon", "MultiPolygon"].includes(f.geometry.type)
  );

  if (map.getSource("search-result")) {
    try {
      map.getSource("search-result").setData(geojson);
    } catch (err) {
      console.warn("search setData failed", err);
    }
  } else {
    map.addSource("search-result", {
      type: "geojson",
      data: geojson,
    });

    if (hasPolygon) {
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
};

export const clearSearchLayer = (map) => {
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
};
