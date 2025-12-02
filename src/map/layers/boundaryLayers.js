export const addStatesLayer = (map, statesGeoJson) => {
  if (!map || !statesGeoJson) return;
  try {
    if (!map.getSource("th-states")) {
      map.addSource("th-states", {
        type: "geojson",
        data: statesGeoJson,
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
  } catch (err) {
    console.warn("addStatesLayer error:", err);
  }
};

export const removeStatesLayer = (map) => {
  if (!map) return;
  try {
    if (map.getLayer("th-states-outline")) map.removeLayer("th-states-outline");
    if (map.getLayer("th-states-fill")) map.removeLayer("th-states-fill");
    if (map.getSource("th-states")) map.removeSource("th-states");
  } catch (err) {
    console.warn("removeStatesLayer error:", err);
  }
};

export const addDistrictsLayer = (map, districtsGeoJson) => {
  if (!map || !districtsGeoJson) return;
  try {
    if (!map.getSource("th-districts")) {
      map.addSource("th-districts", {
        type: "geojson",
        data: districtsGeoJson,
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
  } catch (err) {
    console.warn("addDistrictsLayer error:", err);
  }
};

export const removeDistrictsLayer = (map) => {
  if (!map) return;
  try {
    if (map.getLayer("th-districts-outline"))
      map.removeLayer("th-districts-outline");
    if (map.getLayer("th-districts-fill")) map.removeLayer("th-districts-fill");
    if (map.getSource("th-districts")) map.removeSource("th-districts");
  } catch (err) {
    console.warn("removeDistrictsLayer error:", err);
  }
};
