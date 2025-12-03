/* src/map/layers/villageLayers.js */
const FONT_FAMILY = "Noto Sans Thai";
const FONT_URL = "/NotoSansThai.ttf";
const DEBUG = false;

/* ---------- helpers ---------- */
function normalizeVillageGeoJSON(vg) {
  if (!vg || !Array.isArray(vg.features))
    return { type: "FeatureCollection", features: [] };

  const features = vg.features.map((orig, idx) => {
    const f = { ...orig };
    f.properties = { ...(orig.properties || {}) };
    const p = f.properties;

    p.display_name = p.village_name || p.name || p.village || "";

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
      } catch (e) {}
    }
    p.label_count = isFinite(labelCount) ? labelCount : "";

    // coords normalization (robust)
    const rawLon = p.longitude ?? p.lon ?? p.lng;
    const rawLat = p.latitude ?? p.lat;
    let lon = rawLon != null ? Number(rawLon) : NaN;
    let lat = rawLat != null ? Number(rawLat) : NaN;

    if (
      (!isFinite(lon) || !isFinite(lat)) &&
      f.geometry &&
      Array.isArray(f.geometry.coordinates) &&
      f.geometry.coordinates.length >= 2
    ) {
      const a = Number(f.geometry.coordinates[0]);
      const b = Number(f.geometry.coordinates[1]);
      if (isFinite(a) && isFinite(b)) {
        if (Math.abs(a) <= 180 && Math.abs(b) <= 90) {
          lon = a;
          lat = b;
        } else if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
          lon = b;
          lat = a;
        } else {
          lon = a;
          lat = b;
        }
      }
    }

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

    if (!f.geometry && isFinite(lon) && isFinite(lat)) {
      f.geometry = { type: "Point", coordinates: [lon, lat] };
    } else if (
      f.geometry &&
      f.geometry.type === "Point" &&
      Array.isArray(f.geometry.coordinates)
    ) {
      const [c0, c1] = f.geometry.coordinates;
      if (isFinite(c0) && isFinite(c1)) {
        if (Math.abs(c0) <= 180 && Math.abs(c1) <= 90) {
          // ok
        } else if (Math.abs(c0) <= 90 && Math.abs(c1) <= 180) {
          f.geometry.coordinates = [Number(c1), Number(c0)];
        }
      }
    }

    if (!f.id) f.id = p.village_id || p.id || `village-${idx}`;
    return f;
  });

  return { ...vg, features };
}

/* ---------- small utilities ---------- */
function findFirstSymbolLayerId(map) {
  try {
    const layers = (map.getStyle && map.getStyle().layers) || [];
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === "symbol") return layers[i].id;
    }
  } catch (e) {}
  return null;
}

/* ---------- DOM markers (CSS dot for normal villages + img for top3) ---------- */
export function removeDomMarkers(map) {
  if (!map) return;
  try {
    if (map.__villageDomMarkerUpdate) {
      try {
        map.off("move", map.__villageDomMarkerUpdate);
        map.off("moveend", map.__villageDomMarkerUpdate);
        map.off("zoom", map.__villageDomMarkerUpdate);
        map.off("resize", map.__villageDomMarkerUpdate);
      } catch {}
      map.__villageDomMarkerUpdate = null;
    }
    if (
      map.__villageDomMarkerList &&
      Array.isArray(map.__villageDomMarkerList)
    ) {
      map.__villageDomMarkerList.forEach((m) => {
        try {
          if (m.el && m.el.parentNode) m.el.parentNode.removeChild(m.el);
        } catch {}
      });
    }
    map.__villageDomMarkerList = null;

    if (
      map.__villageDomMarkerContainer &&
      map.__villageDomMarkerContainer.parentNode
    ) {
      try {
        map.__villageDomMarkerContainer.parentNode.removeChild(
          map.__villageDomMarkerContainer
        );
      } catch {}
    }
    map.__villageDomMarkerContainer = null;
  } catch (e) {}
}

function addDomMarkers(map, features, opts = {}) {
  if (!map || !Array.isArray(features) || !features.length) return;
  try {
    removeDomMarkers(map);

    const { size = 36, top3Names = [], top3ImageSrc = null } = opts;

    const container = document.createElement("div");
    container.className = "village-dom-marker-container";
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.pointerEvents = "none";
    container.style.zIndex = 1050;

    const mapContainer = map.getContainer();
    mapContainer.style.position = mapContainer.style.position || "relative";
    mapContainer.appendChild(container);
    map.__villageDomMarkerContainer = container;
    map.__villageDomMarkerList = [];

    const dotPct = 0.7;

    features.forEach((f) => {
      try {
        if (
          !f.geometry ||
          !Array.isArray(f.geometry.coordinates) ||
          f.geometry.coordinates.length < 2
        )
          return;
        const lon = Number(f.geometry.coordinates[0]);
        const lat = Number(f.geometry.coordinates[1]);
        if (!isFinite(lon) || !isFinite(lat)) return;

        const props = f.properties || {};
        const displayName =
          props.display_name || props.village_name || props.name || "";

        // wrapper
        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
        wrapper.style.transform = "translate(-50%, -50%)";
        wrapper.style.pointerEvents = "auto";
        wrapper.style.width = `${size}px`;
        wrapper.style.height = `${size}px`;
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "center";
        wrapper.dataset.villageId = f.id;

        // Decide top3 or normal
        const isTop =
          top3Names && top3Names.length && top3Names.includes(displayName);

        if (isTop && top3ImageSrc) {
          // image element for top3
          const img = document.createElement("img");
          img.className = "village-dom-top3-img";
          img.src = top3ImageSrc;
          img.style.width = `${Math.round(size * 0.9)}px`;
          img.style.height = `${Math.round(size * 0.9)}px`;
          img.style.objectFit = "contain";
          img.style.pointerEvents = "auto";
          img.alt = displayName || "top3";
          wrapper.appendChild(img);

          // optional center label (number)
          const num =
            (props && (props.label_count ?? props.case_sum ?? props.count)) ||
            "";
          if (isFinite(Number(num))) {
            const numEl = document.createElement("div");
            numEl.className = "village-dom-top3-num";
            numEl.style.pointerEvents = "none";
            numEl.style.position = "absolute";
            numEl.style.fontWeight = "700";
            numEl.style.fontSize = `${Math.max(11, Math.round(size * 0.36))}px`;
            numEl.style.color = "#fff";
            numEl.style.textShadow = "0 1px 2px rgba(0,0,0,0.6)";
            numEl.innerText = String(Number(num));
            wrapper.appendChild(numEl);
          }
        } else {
          // small CSS dot for normal villages
          const dot = document.createElement("div");
          dot.className = "village-dom-dot";
          const dotSize = Math.round(size * dotPct);
          dot.style.width = `${dotSize}px`;
          dot.style.height = `${dotSize}px`;
          dot.style.borderRadius = "50%";
          dot.style.pointerEvents = "auto";
          // optional color from properties
          const color = (props && props.color) || "#ffb6c1";
          dot.style.background = color;

          // number inside dot
          const num =
            (props && (props.label_count ?? props.case_sum ?? props.count)) ||
            "";
          const numEl = document.createElement("div");
          numEl.className = "village-dom-dot-num";
          numEl.style.pointerEvents = "none";
          numEl.style.fontWeight = "700";
          numEl.style.fontSize = `${Math.max(9, Math.round(dotSize * 0.45))}px`;
          numEl.style.color = "#ffffff";
          numEl.style.lineHeight = "1";
          numEl.style.textAlign = "center";
          numEl.style.userSelect = "none";
          numEl.innerText = isFinite(Number(num)) ? String(Number(num)) : "";

          dot.appendChild(numEl);
          wrapper.appendChild(dot);
        }

        // small text label below (optional)
        if (displayName) {
          const label = document.createElement("div");
          label.className = "village-dom-marker-label";
          label.style.position = "absolute";
          label.style.top = `${Math.round(size * 0.6)}px`;
          label.style.left = "50%";
          label.style.transform = "translate(-50%, 0)";
          label.style.pointerEvents = "none";
          label.style.fontWeight = "700";
          label.style.fontSize = "11px";
          label.style.color = "#000";
          label.style.textShadow = "0 0 3px #fff, 0 0 4px #fff";
          label.style.userSelect = "none";
          label.style.whiteSpace = "nowrap";
          label.style.padding = "2px 6px";
          label.style.borderRadius = "6px";
          label.style.background = "rgba(255,255,255,0.9)";
          label.style.boxShadow = "0 6px 12px rgba(0,0,0,0.08)";
          label.innerText = displayName;
          // If you don't want all labels visible, comment out the append below
          // wrapper.appendChild(label);
        }

        wrapper.addEventListener("click", (ev) => {
          try {
            ev.stopPropagation();
            if (typeof map.__onClickVillage === "function")
              map.__onClickVillage(f);
          } catch (err) {}
        });

        container.appendChild(wrapper);
        map.__villageDomMarkerList.push({ el: wrapper, coords: [lon, lat] });
      } catch (e) {
        // per feature ignore
      }
    });

    const update = () => {
      if (!map.__villageDomMarkerList) return;
      try {
        map.__villageDomMarkerList.forEach((item) => {
          try {
            const p = map.project(item.coords);
            if (!isFinite(p.x) || !isFinite(p.y)) {
              item.el.style.display = "none";
            } else {
              item.el.style.display = "flex";
              item.el.style.left = `${Math.round(p.x)}px`;
              item.el.style.top = `${Math.round(p.y)}px`;
            }
          } catch (e) {}
        });
      } catch (e) {}
    };

    map.__villageDomMarkerUpdate = update;
    map.on("move", update);
    map.on("moveend", update);
    map.on("zoom", update);
    map.on("resize", update);

    update();
    if (DEBUG)
      console.debug(
        "[villageLayers] DOM markers added:",
        map.__villageDomMarkerList.length
      );
  } catch (e) {
    console.warn("addDomMarkers failed:", e);
  }
}

/* ---------- name/text layers (MapLibre symbol layers only for text) ---------- */
export function removeHtmlVillageLabels(map) {
  if (!map) return;
  try {
    if (map.__villageLabelList && Array.isArray(map.__villageLabelList)) {
      map.__villageLabelList.forEach((item) => {
        try {
          if (item.el && item.el.parentNode)
            item.el.parentNode.removeChild(item.el);
        } catch {}
      });
    }
    map.__villageLabelList = null;

    if (map.__villageLabelContainer && map.__villageLabelContainer.parentNode) {
      try {
        map.__villageLabelContainer.parentNode.removeChild(
          map.__villageLabelContainer
        );
      } catch {}
    }
    map.__villageLabelContainer = null;

    if (map.__villageLabelUpdateListener) {
      try {
        map.off("move", map.__villageLabelUpdateListener);
        map.off("moveend", map.__villageLabelUpdateListener);
        map.off("zoom", map.__villageLabelUpdateListener);
        map.off("resize", map.__villageLabelUpdateListener);
      } catch {}
    }
    map.__villageLabelUpdateListener = null;
  } catch (e) {}
}

function ensureLabelContainer(map) {
  if (!map) return null;
  try {
    if (!map.__villageLabelContainer) {
      const container = document.createElement("div");
      container.className = "village-label-overlay";
      const mapContainer = map.getContainer();
      container.style.position = "absolute";
      container.style.left = "0";
      container.style.top = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.pointerEvents = "none";
      container.style.zIndex = "1000";
      mapContainer.style.position = mapContainer.style.position || "relative";
      mapContainer.appendChild(container);
      map.__villageLabelContainer = container;
    }
    return map.__villageLabelContainer;
  } catch (e) {
    return null;
  }
}

function addHtmlVillageLabels(map, geojson) {
  if (!map || !geojson || !Array.isArray(geojson.features)) return;
  removeHtmlVillageLabels(map);
  const overlay = ensureLabelContainer(map);
  if (!overlay) return;

  const labelList = [];
  geojson.features.forEach((f) => {
    try {
      if (!f.geometry || f.geometry.type !== "Point") return;
      const coords = f.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!isFinite(lon) || !isFinite(lat)) return;
      const props = f.properties || {};
      const text = props.display_name || props.village_name || props.name || "";
      if (!text) return;

      const el = document.createElement("div");
      el.className = "village-html-label";
      el.style.position = "absolute";
      el.style.transform = "translate(-50%, 11px)";
      el.style.pointerEvents = "none";
      el.style.whiteSpace = "nowrap";
      el.style.fontFamily = `"${FONT_FAMILY}", Inter, Arial, sans-serif`;
      el.style.fontSize = "15px";
      el.style.color = "#000000ff";
      el.style.textShadow = "0 0 3px #fff, 0 0 4px #fff";
      el.style.fontWeight = "700";
      el.style.padding = "2px 6px";
      el.style.borderRadius = "6px";
      el.style.background = "rgba(255,255,255,0.85)";
      el.style.boxShadow = "0 6px 12px rgba(0,0,0,0.08)";
      el.style.lineHeight = "1";
      el.style.zIndex = "1000";
      el.style.display = "inline-block";
      el.innerText = text;

      overlay.appendChild(el);

      labelList.push({
        id: f.id,
        coords: [lon, lat],
        el,
      });
    } catch (e) {}
  });

  map.__villageLabelList = labelList;

  const updatePositions = () => {
    if (!map.__villageLabelList || !Array.isArray(map.__villageLabelList))
      return;
    try {
      map.__villageLabelList.forEach((item) => {
        try {
          const p = map.project(item.coords);
          const x = Math.round(p.x);
          const y = Math.round(p.y);
          item.el.style.left = x + "px";
          item.el.style.top = y + "px";
        } catch (e) {}
      });
    } catch (e) {}
  };

  updatePositions();
  const listener = () => updatePositions();
  map.__villageLabelUpdateListener = listener;
  map.on("move", listener);
  map.on("moveend", listener);
  map.on("zoom", listener);
  map.on("resize", listener);
}

export const addVillageLayers = async (map, villagesGeoJson, top3ImageSrc) => {
  if (!map) return;

  const normalized = normalizeVillageGeoJSON(
    villagesGeoJson || { type: "FeatureCollection", features: [] }
  );

  // ensure source
  try {
    if (!map.getSource("villages")) {
      map.addSource("villages", { type: "geojson", data: normalized });
    } else {
      try {
        map.getSource("villages").setData(normalized);
      } catch (e) {
        console.warn("setData villages failed:", e);
      }
    }
  } catch (e) {
    console.warn("ensure source failed:", e);
  }

  // compute top3 names
  let top3Names = [];
  try {
    const features = (normalized.features || []).slice();
    const scored = features
      .map((f) => ({
        f,
        score: Number(
          (f.properties &&
            (f.properties.label_count ??
              f.properties.case_sum ??
              f.properties.count)) ||
            0
        ),
      }))
      .filter(
        (x) =>
          x.f &&
          x.f.geometry &&
          x.f.geometry.type === "Point" &&
          isFinite(x.score)
      )
      .sort((a, b) => b.score - a.score);
    const top = scored
      .slice(0, 3)
      .map(
        (x) =>
          (x.f.properties &&
            (x.f.properties.display_name ||
              x.f.properties.village_name ||
              x.f.properties.name)) ||
          null
      )
      .filter(Boolean);
    top3Names = top;
  } catch (e) {
    top3Names = [];
  }

  // --- add/update a symbol layer used only for text (counts) ---
  try {
    const beforeLayer = findFirstSymbolLayerId(map);
    const symbolLayerDef = {
      id: "village-symbol",
      type: "symbol",
      source: "villages",
      layout: {
        // no icon-image here (we render visuals with DOM)
        "text-field": [
          "to-string",
          [
            "coalesce",
            ["get", "label_count"],
            ["get", "case_sum"],
            ["get", "count"],
            "",
          ],
        ],
        "text-size": 12,
        "text-anchor": "center",
        "text-offset": ["literal", [0, 0]],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0,0,0,0.6)",
        "text-halo-width": 2,
      },
    };

    if (!map.getLayer("village-symbol")) {
      if (beforeLayer) map.addLayer(symbolLayerDef, beforeLayer);
      else map.addLayer(symbolLayerDef);
    } else {
      try {
        map.setLayoutProperty("village-symbol", "text-field", [
          "to-string",
          [
            "coalesce",
            ["get", "label_count"],
            ["get", "case_sum"],
            ["get", "count"],
            "",
          ],
        ]);
      } catch (e) {}
    }
  } catch (e) {
    console.warn("add/update symbol layer failed:", e);
  }

  // add village-name layer (top labels) if not present
  try {
    const beforeLayer = findFirstSymbolLayerId(map);
    const nameLayerDef = {
      id: "village-name",
      type: "symbol",
      source: "villages",
      layout: {
        "text-field": [
          "coalesce",
          ["get", "display_name"],
          ["get", "village_name"],
          ["get", "name"],
          "",
        ],
        "text-size": 13,
        "text-anchor": "top",
        "text-offset": ["literal", [0, 1.0]],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#b30000",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.2,
      },
    };

    if (!map.getLayer("village-name")) {
      if (beforeLayer) map.addLayer(nameLayerDef, beforeLayer);
      else map.addLayer(nameLayerDef);
    } else {
      try {
        map.setLayoutProperty("village-name", "text-field", [
          "coalesce",
          ["get", "display_name"],
          ["get", "village_name"],
          ["get", "name"],
          "",
        ]);
      } catch (e) {}
    }
  } catch (e) {
    console.warn("add/update name layer failed:", e);
  }

  // --- DOM markers for visuals (top3 image + small CSS dot) ---
  try {
    const allPointFeatures = (normalized.features || []).filter(
      (f) => f.geometry && f.geometry.type === "Point"
    );
    addDomMarkers(map, allPointFeatures, { size: 42, top3Names, top3ImageSrc });
  } catch (e) {
    console.warn("add DOM markers error:", e);
  }

  // labels overlay (optional)
  try {
    loadFontForOverlay()
      .then(() => {
        try {
          removeHtmlVillageLabels(map);
          addHtmlVillageLabels(map, normalized);
        } catch (e) {}
      })
      .catch(() => {
        try {
          addHtmlVillageLabels(map, normalized);
        } catch (e) {}
      });
  } catch (e) {}
};

export default addVillageLayers;

/* ---------- font loader / helper functions used above ---------- */
async function loadFontForOverlay() {
  if (typeof window === "undefined" || !window.document || !window.FontFace) {
    return Promise.reject(new Error("FontFace not supported"));
  }

  for (const f of document.fonts) {
    if (
      (f.family || f.familyName || "")
        .toLowerCase()
        .includes(FONT_FAMILY.toLowerCase())
    )
      return Promise.resolve();
  }

  try {
    const resp = await fetch(FONT_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Font fetch failed: ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    let face;
    try {
      face = new FontFace(FONT_FAMILY, buffer);
    } catch (err) {
      const base64 = arrayBufferToBase64(buffer);
      face = new FontFace(
        FONT_FAMILY,
        `url(data:font/ttf;base64,${base64}) format('truetype')`
      );
    }
    const loaded = await face.load();
    try {
      document.fonts.add(loaded);
    } catch (e) {}
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
