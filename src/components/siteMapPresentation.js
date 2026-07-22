import { SITE_TYPE_COLORS, drawSiteTypeSignalGlyph } from "./SiteTypeIcon";

export const OSM_FALLBACK_STYLE = {
  version: 8,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster",
      minzoom: 0,
      maxzoom: 19,
      paint: {
        "raster-saturation": -0.62,
        "raster-contrast": -0.08,
        "raster-brightness-min": 0.17,
        "raster-brightness-max": 0.96,
      },
    },
  ],
};

const PORTAL_MAP_FILL_COLORS = {
  Meadow: "#e4ebde",
  Scrub: "#e1e9dc",
  Crop: "#ecefe3",
  Residential: "#eef0ef",
  Glacier: "#f5f7f6",
  Forest: "#d9e6d6",
  Sand: "#eee9dc",
  Wood: "#d6e4d4",
  Industrial: "#e7e9e9",
  Grass: "#dfe9da",
  "Airport zone": "#e9eaec",
  Pedestrian: "#f4f2ed",
  Cemetery: "#dde7da",
  Hospital: "#f1e6e6",
  Stadium: "#e0e9dc",
  School: "#eeeae1",
  "Water intermittent": "#d5e7e9",
  Water: "#bfdde5",
  Heliport: "#e6e8e9",
  Pier: "#f4f4f0",
  Bridge: "#f8f8f5",
  Building: "#dddfdc",
};

const PORTAL_MAP_LINE_COLORS = {
  "River tunnel": "#b8d5da",
  River: "#9dcbd5",
  Aeroway: "#cbd0d0",
  "Ferry line": "#8ebbc7",
  "Tunnel outline": "#d5d8d6",
  Tunnel: "#f7f7f3",
  "Footway tunnel outline": "#ddd8cf",
  "Footway tunnel": "#f5f0e8",
  "Pier road": "#fafaf7",
  "Bridge outline": "#d8dcda",
  "Minor road outline": "#daddda",
  "Major road outline": "#d5d9d7",
  "Highway outline": "#d6d7d3",
  "Road under construction": "#d9bfb5",
  "Minor road": "#fbfbf8",
  "Major road": "#ffffff",
  Highway: "#f7dfcf",
  "Path outline": "#dedad2",
  "Path minor": "#e8e1d6",
  Path: "#e2d9cc",
  "Major rail": "#adb5b8",
  "Major rail hatching": "#f4f5f3",
  "Minor rail": "#bbc1c2",
  "Minor rail hatching": "#f4f5f3",
  "Aqueduct outline": "#d7d9d7",
  Aqueduct: "#a8cbd2",
  Cablecar: "#aeb5b7",
  "Cablecar dash": "#f5f6f4",
  "Other border": "#c8cecb",
  "Disputed border": "#c0c6c3",
  "Country border": "#aeb6b3",
};

function safeSetPaint(map, layerId, property, value) {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // MapTiler styles can evolve without affecting the rest of the map.
  }
}

export function getPortalMapStyle(maptilerKey, mode = "mapa") {
  if (!maptilerKey) return OSM_FALLBACK_STYLE;
  const style = mode === "satelite" ? "hybrid" : "streets-v2";
  return `https://api.maptiler.com/maps/${style}/style.json?key=${encodeURIComponent(maptilerKey)}`;
}

export function applyPortalMapTheme(map) {
  safeSetPaint(map, "Background", "background-color", "#eef1ef");
  Object.entries(PORTAL_MAP_FILL_COLORS).forEach(([layerId, color]) => {
    safeSetPaint(map, layerId, "fill-color", color);
  });
  safeSetPaint(map, "Water intermittent", "fill-opacity", 0.62);
  safeSetPaint(map, "Building", "fill-opacity", 0.76);
  Object.entries(PORTAL_MAP_LINE_COLORS).forEach(([layerId, color]) => {
    safeSetPaint(map, layerId, "line-color", color);
  });
  if (map.getLayer("Building 3D")) {
    map.setLayoutProperty("Building 3D", "visibility", "none");
  }
  (map.getStyle().layers || []).forEach((layer) => {
    if (layer.type !== "symbol") return;
    const id = layer.id.toLocaleLowerCase("en-US");
    const isWaterLabel = /river|ocean|lake/.test(id);
    const isRoadLabel = /road|highway|junction|shield/.test(id);
    const isPlaceLabel = /place|state|town|city|capital|country|continent/.test(
      id,
    );
    const textColor = isWaterLabel
      ? "#557d88"
      : isRoadLabel
        ? "#687276"
        : isPlaceLabel
          ? "#344047"
          : "#596469";
    safeSetPaint(map, layer.id, "text-color", textColor);
    safeSetPaint(map, layer.id, "text-halo-color", "rgba(248,250,247,.92)");
    safeSetPaint(map, layer.id, "text-halo-width", isPlaceLabel ? 1.5 : 1);
    if (!isPlaceLabel && !isWaterLabel && !isRoadLabel) {
      safeSetPaint(map, layer.id, "text-opacity", 0.78);
      safeSetPaint(map, layer.id, "icon-opacity", 0.7);
    }
  });
}

export function createSitePinImage(type, color = SITE_TYPE_COLORS.Outras) {
  const canvas = document.createElement("canvas");
  const ratio = 2;
  canvas.width = 44 * ratio;
  canvas.height = 52 * ratio;
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.beginPath();
  context.ellipse(22, 47, 8.5, 2.8, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(16, 24, 40, .16)";
  context.filter = "blur(2px)";
  context.fill();
  context.filter = "none";
  context.save();
  context.shadowColor = "rgba(16, 24, 40, .22)";
  context.shadowBlur = 7;
  context.shadowOffsetY = 3;
  context.beginPath();
  context.moveTo(22, 3);
  context.bezierCurveTo(12.6, 3, 7, 9.6, 7, 18);
  context.bezierCurveTo(7, 29, 22, 45, 22, 45);
  context.bezierCurveTo(22, 45, 37, 29, 37, 18);
  context.bezierCurveTo(37, 9.6, 31.4, 3, 22, 3);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
  context.lineWidth = 2.4;
  context.strokeStyle = "#ffffff";
  context.stroke();
  drawSiteTypeSignalGlyph(context, type, {
    x: 22,
    y: 17.5,
    size: 17,
    color: "#ffffff",
    lineWidth: 2.65,
  });
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
