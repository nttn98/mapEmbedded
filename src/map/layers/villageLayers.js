const FONT_FAMILY = "Noto Sans Thai";
const FONT_URL = "/NotoSansThai.ttf";

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

    if (
      (!f.geometry || f.geometry.type !== "Point") &&
      (p.longitude != null || p.lat != null || p.latitude != null)
    ) {
      const lon = Number(p.longitude ?? p.lon ?? p.lng);
      const lat = Number(p.latitude ?? p.lat);
      if (!isNaN(lon) && !isNaN(lat)) {
        f.geometry = { type: "Point", coordinates: [lon, lat] };
      }
    }

    if (!f.id) f.id = p.village_id || p.id || `village-${idx}`;

    return f;
  });

  return { ...vg, features };
}

/* ---------- HTML overlay helpers ---------- */
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
  } catch (e) {
    // ignore
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
    } catch (e) {
      // ignore per feature
    }
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

/* ---------- Font loader (fetch + arrayBuffer -> FontFace) ---------- */
async function loadFontForOverlay() {
  if (typeof window === "undefined" || !window.document || !window.FontFace) {
    return Promise.reject(new Error("FontFace not supported"));
  }

  // if already loaded, resolve
  for (const f of document.fonts) {
    if (
      (f.family || f.familyName || "")
        .toLowerCase()
        .includes(FONT_FAMILY.toLowerCase())
    ) {
      return Promise.resolve();
    }
  }

  try {
    const resp = await fetch(FONT_URL, { cache: "no-store" });
    if (!resp.ok)
      throw new Error(`Font fetch failed: ${resp.status} ${resp.statusText}`);
    const contentType = resp.headers.get("content-type");
    console.debug(
      "Font fetch content-type:",
      contentType,
      "content-length:",
      resp.headers.get("content-length")
    );
    const buffer = await resp.arrayBuffer();

    // Try to create FontFace from buffer (some browsers accept)
    let font;
    try {
      font = new FontFace(FONT_FAMILY, buffer);
    } catch (err) {
      // fallback: convert to data URL and create
      const base64 = arrayBufferToBase64(buffer);
      font = new FontFace(
        FONT_FAMILY,
        `url(data:font/ttf;base64,${base64}) format('truetype')`
      );
    }

    const loaded = await font.load();
    try {
      document.fonts.add(loaded);
    } catch (e) {
      // ignore if add fails
    }
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

/* ---------- Main exported function ---------- */
export const addVillageLayers = (map, villagesGeoJson, top3ImageSrc) => {
  if (!map) return;

  const normalizedGeoJson = normalizeVillageGeoJSON(villagesGeoJson);

  const hasImageSafe = (name) =>
    typeof map.hasImage === "function" ? map.hasImage(name) : false;

  // pulsing-dot
  try {
    if (!hasImageSafe("pulsing-dot-small")) {
      const size = 350;
      const pulsingDot = {
        width: size,
        height: size,
        data: new Uint8Array(size * size * 4),
        onAdd() {
          const canvas = document.createElement("canvas");
          canvas.width = this.width;
          canvas.height = this.height;
          this.context = canvas.getContext("2d", { willReadFrequently: true });
          try {
            this._imageData = this.context.createImageData(
              this.width,
              this.height
            );
          } catch (e) {
            this._imageData = null;
          }
        },
        render() {
          const duration = 2000;
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
          try {
            const imgData = ctx.getImageData(0, 0, this.width, this.height);
            this.data = imgData.data;
          } catch (err) {
            if (this._imageData) {
              try {
                this._imageData = ctx.getImageData(
                  0,
                  0,
                  this.width,
                  this.height
                );
                this.data = this._imageData.data;
              } catch (e) {}
            }
          }
          try {
            map.triggerRepaint();
          } catch {}
          return true;
        },
      };
      try {
        map.addImage("pulsing-dot-small", pulsingDot, { pixelRatio: 2 });
      } catch (e) {
        console.warn("addImage pulsing-dot-small failed:", e);
      }
    }
  } catch (e) {
    console.warn("pulsing-dot prepare error:", e);
  }

  // top3 marker image
  try {
    if (top3ImageSrc && !hasImageSafe("top3-marker")) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          if (!hasImageSafe("top3-marker"))
            map.addImage("top3-marker", img, { pixelRatio: 1 });
        } catch (err) {
          console.warn("addImage top3-marker failed:", err);
        }
      };
      img.src = top3ImageSrc;
    }
  } catch (e) {
    console.warn("top3 image error:", e);
  }

  // add/update source
  try {
    if (!map.getSource("villages")) {
      map.addSource("villages", { type: "geojson", data: normalizedGeoJson });
    } else {
      try {
        map.getSource("villages").setData(normalizedGeoJson);
      } catch (err) {
        console.warn("setData failed:", err);
      }
    }
  } catch (err) {
    console.warn("ensuring villages source failed:", err);
  }

  // compute top234
  let top234Names = [];
  try {
    const features = (normalizedGeoJson && normalizedGeoJson.features) || [];
    const scored = features
      .map((f) => {
        const p = f.properties || {};
        const score = Number(
          p.label_count ?? p.count ?? p.cases ?? p.case_sum ?? 0
        );
        return { feature: f, score };
      })
      .filter(
        (x) =>
          x.feature &&
          x.feature.geometry &&
          x.feature.geometry.type === "Point" &&
          isFinite(x.score)
      );
    scored.sort((a, b) => b.score - a.score);
    const top234 = scored.slice(1, 4);
    top234Names = top234
      .map((x) => {
        const p = x.feature.properties || {};
        return p.display_name || p.village_name || p.name || null;
      })
      .filter(Boolean);
  } catch (e) {
    top234Names = [];
  }

  // village-symbol
  try {
    const isTopExpr = [
      "in",
      [
        "coalesce",
        ["get", "display_name"],
        ["get", "village_name"],
        ["get", "name"],
      ],
      ["literal", top234Names],
    ];

    if (!map.getLayer("village-symbol")) {
      map.addLayer({
        id: "village-symbol",
        type: "symbol",
        source: "villages",
        layout: {
          "icon-image": ["case", isTopExpr, "top3-marker", "pulsing-dot-small"],
          "icon-size": ["case", isTopExpr, 0.7, 0.6],
          "icon-anchor": "center",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "text-field": ["to-string", ["coalesce", ["get", "label_count"], ""]],
          "text-size": 13,
          "text-offset": [0, 0],
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#000000ff",
          "text-halo-color": "rgba(0,0,0,0.3)",
          "text-halo-width": 1.2,
        },
      });
    } else {
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
      map.setLayoutProperty("village-symbol", "text-field", [
        "to-string",
        ["coalesce", ["get", "label_count"], ""],
      ]);
    }
  } catch (e) {
    console.warn("Could not add/update village-symbol layer:", e);
  }

  // village-name layer (symbol fallback)
  try {
    if (!map.getLayer("village-name")) {
      map.addLayer({
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
          "text-offset": [0, 1.0],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#b30000",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });
    } else {
      map.setLayoutProperty("village-name", "text-field", [
        "coalesce",
        ["get", "display_name"],
        ["get", "village_name"],
        ["get", "name"],
        "",
      ]);
      map.setLayoutProperty("village-name", "text-offset", [0, -1.2]);
    }

    try {
      const layers = map.getStyle().layers || [];
      if (layers && layers.length) {
        const topId = layers[layers.length - 1].id;
        if (map.getLayer("village-name") && topId !== "village-name") {
          try {
            map.moveLayer("village-name", topId);
          } catch {}
        }
      }
    } catch (e) {}
  } catch (e) {
    console.warn("Could not add village-name layer:", e);
  }

  // try to load font via fetch + FontFace; fallback to HTML overlay labels
  loadFontForOverlay()
    .then(() => {
      try {
        // re-add overlay labels so they use loaded font
        removeHtmlVillageLabels(map);
        addHtmlVillageLabels(map, normalizedGeoJson);
        console.debug("Overlay font loaded:", FONT_FAMILY, FONT_URL);
      } catch (e) {
        console.warn("addHtmlVillageLabels after font load failed:", e);
      }
    })
    .catch((err) => {
      try {
        addHtmlVillageLabels(map, normalizedGeoJson);
      } catch (e) {
        console.warn("fallback html overlay failed:", e);
      }
      console.warn(
        "Could not load overlay font; using HTML overlay labels without custom font:",
        err
      );
    });
};

export default addVillageLayers;
