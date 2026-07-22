import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  CircleAlert,
  Layers3,
  Map as MapIcon,
  MapPinned,
  Maximize2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "../lib/supabase";
import {
  getCachedSitesMapCatalog,
  loadSitesMapCatalog,
} from "../lib/sitesMapCatalogCache";
import {
  SITE_TYPE_COLORS as TYPE_COLORS,
  SiteTypeIcon,
  drawSiteTypeSignalGlyph,
} from "./SiteTypeIcon";
import {
  applyPortalMapTheme as applySharedPortalMapTheme,
  createSitePinImage,
  getPortalMapStyle,
} from "./siteMapPresentation";

const numberFormat = new Intl.NumberFormat("pt-BR");
const DEFAULT_VIEW = { longitude: -44.45, latitude: -18.72, zoom: 5.25 };
const OSM_FALLBACK_STYLE = {
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

const TYPE_IMAGE_NAMES = Object.fromEntries(
  Object.keys(TYPE_COLORS).map((type, index) => [type, `site-pin-${index}`]),
);

const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  PENDENTE: "Pendente",
  "EM TRATATIVA": "Em tratativa",
  "LEVANTAMENTO DE DOCUMENTOS": "Levantamento de documentos",
  LIBERADO: "Liberado",
  CANCELADO: "Cancelado",
};

function valueOrMissing(value) {
  return value || "Não informado";
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

function numericParam(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createPinImage(type, color) {
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
    // MapTiler styles can evolve; unsupported properties should not stop the map.
  }
}

function applyPortalMapTheme(map) {
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

function toFeatureCollection(sites) {
  return {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(site.longitude), Number(site.latitude)],
      },
      properties: {
        id: site.id,
        station: site.station,
        municipality: site.municipality || "",
        type: site.station_type_normalized || "Não informada",
        caseCount: Number(site.case_count || 0),
      },
    })),
  };
}

function uniqueOptions(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))].sort(
    (a, b) => String(a).localeCompare(String(b), "pt-BR"),
  );
}

function normalizedOptions(items, field) {
  const grouped = new Map();
  items.forEach((item) => {
    const label = item[field];
    const key = normalizedText(label);
    if (key && !grouped.has(key)) grouped.set(key, label);
  });
  return [...grouped.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "pt-BR"));
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="site-map-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

function MapSkeleton() {
  return (
    <div className="site-map-loading" aria-label="Carregando mapa de sites">
      <div className="site-map-loading-top" />
      <div className="site-map-loading-kpis">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="site-map-loading-note">Preparando os sites no mapa…</div>
    </div>
  );
}

export default function SitesMapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  const lastWrittenParamsRef = useRef(searchParams.toString());
  const [catalog, setCatalog] = useState(
    () => getCachedSitesMapCatalog() || [],
  );
  const [loading, setLoading] = useState(() => !getCachedSitesMapCatalog());
  const [catalogError, setCatalogError] = useState("");
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const geojsonRef = useRef(toFeatureCollection([]));
  const selectedIdRef = useRef("");
  const selectSiteRef = useRef(() => {});

  const query = searchParams.get("q") || "";
  const typeFilter = searchParams.get("tipo") || "";
  const municipalityFilter = searchParams.get("municipio") || "";
  const holderFilter = searchParams.get("detentora") || "";
  const clusterFilter = searchParams.get("cluster") || "";
  const priorityFilter = searchParams.get("prioridade") || "";
  const caseFilter = searchParams.get("casos") || "";
  const selectedId = searchParams.get("site") || "";
  const isSiteFocus =
    searchParams.get("foco") === "site" && Boolean(selectedId);
  const mapMode = searchParams.get("mapa") === "satelite" ? "satelite" : "mapa";

  useEffect(() => {
    const current = searchParams.toString();
    if (current !== lastWrittenParamsRef.current) {
      searchParamsRef.current = new URLSearchParams(searchParams);
      lastWrittenParamsRef.current = current;
    }
  }, [searchParams]);

  const updateParams = useCallback(
    (updates, replace = true) => {
      const next = new URLSearchParams(searchParamsRef.current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      searchParamsRef.current = next;
      lastWrittenParamsRef.current = next.toString();
      setSearchParams(next, { replace });
    },
    [setSearchParams],
  );

  const loadCatalog = useCallback(async (force = false) => {
    const cachedCatalog = force ? null : getCachedSitesMapCatalog();

    if (cachedCatalog) {
      setCatalog(cachedCatalog);
      setCatalogError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setCatalogError("");
    let data;
    let error;
    try {
      data = await loadSitesMapCatalog({ force });
    } catch (requestError) {
      error = requestError;
    }
    if (error) {
      setCatalog([]);
      setCatalogError(
        error.message || "Não foi possível carregar o catálogo do mapa.",
      );
    } else {
      setCatalog(Array.isArray(data) ? data : data?.sites || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const options = useMemo(
    () => ({
      types: uniqueOptions(catalog, "station_type_normalized"),
      municipalities: normalizedOptions(catalog, "municipality"),
      holders: normalizedOptions(catalog, "holder"),
      clusters: normalizedOptions(catalog, "eqs_cluster"),
      priorities: normalizedOptions(catalog, "priority_level"),
    }),
    [catalog],
  );

  const filteredSites = useMemo(() => {
    const normalizedQuery = normalizedText(query.trim());
    const matchingSites = catalog.filter((site) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          site.station,
          site.full_station,
          site.smart_plan_name,
          site.address,
          site.municipality,
        ].some((value) => normalizedText(value).includes(normalizedQuery));
      const matchesCases =
        !caseFilter ||
        (caseFilter === "com" && Number(site.case_count || 0) > 0) ||
        (caseFilter === "sem" && Number(site.case_count || 0) === 0);
      return (
        matchesQuery &&
        (!typeFilter || site.station_type_normalized === typeFilter) &&
        (!municipalityFilter ||
          normalizedText(site.municipality) ===
            normalizedText(municipalityFilter)) &&
        (!holderFilter || normalizedText(site.holder) === holderFilter) &&
        (!clusterFilter ||
          normalizedText(site.eqs_cluster) === clusterFilter) &&
        (!priorityFilter ||
          normalizedText(site.priority_level) === priorityFilter) &&
        matchesCases
      );
    });
    return isSiteFocus
      ? matchingSites.filter((site) => site.id === selectedId)
      : matchingSites;
  }, [
    catalog,
    caseFilter,
    clusterFilter,
    holderFilter,
    municipalityFilter,
    priorityFilter,
    query,
    isSiteFocus,
    selectedId,
    typeFilter,
  ]);

  const metrics = useMemo(
    () => ({
      sites: filteredSites.length,
      municipalities: new Set(
        filteredSites
          .map((site) => normalizedText(site.municipality))
          .filter(Boolean),
      ).size,
      types: new Set(
        filteredSites
          .map((site) => site.station_type_normalized)
          .filter(Boolean),
      ).size,
      cases: filteredSites.reduce(
        (total, site) => total + Number(site.case_count || 0),
        0,
      ),
    }),
    [filteredSites],
  );

  const maptilerKey = String(import.meta.env.VITE_MAPTILER_KEY || "").trim();
  const usingDemoStyle = !maptilerKey;
  const mapStyle = useMemo(
    () => getPortalMapStyle(maptilerKey, mapMode),
    [mapMode, maptilerKey],
  );

  const selectSite = useCallback(
    (siteId) => {
      updateParams({ site: siteId }, false);
    },
    [updateParams],
  );

  selectSiteRef.current = selectSite;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      return undefined;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError("");
    supabase
      .rpc("get_site_map_detail", { p_site_id: selectedId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setDetail(null);
          setDetailError(
            error.message || "Não foi possível carregar os detalhes do site.",
          );
        } else {
          setDetail(data);
        }
        setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!mapContainerRef.current || loading) return undefined;
    setMapReady(false);
    setMapError("");
    const initialCenter = [
      numericParam(searchParams.get("lng"), DEFAULT_VIEW.longitude),
      numericParam(searchParams.get("lat"), DEFAULT_VIEW.latitude),
    ];
    const initialZoom = numericParam(
      searchParams.get("zoom"),
      DEFAULT_VIEW.zoom,
    );
    let map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 3.5,
        maxZoom: 17,
        attributionControl: false,
      });
      mapRef.current = map;
      map.on("styleimagemissing", (event) => {
        if (event.id.trim() || map.hasImage(event.id)) return;
        map.addImage(event.id, {
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        });
      });
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      map.on("load", () => {
        if (mapMode === "mapa" && !usingDemoStyle) {
          applySharedPortalMapTheme(map);
        }

        Object.entries(TYPE_COLORS).forEach(([type, color]) => {
          const imageName = TYPE_IMAGE_NAMES[type];
          if (!map.hasImage(imageName)) {
            map.addImage(imageName, createSitePinImage(type, color), {
              pixelRatio: 2,
            });
          }
        });

        map.addSource("sites", {
          type: "geojson",
          data: geojsonRef.current,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 52,
        });
        map.addLayer({
          id: "selected-site-halo",
          type: "circle",
          source: "sites",
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "id"], selectedIdRef.current || ""],
          ],
          paint: {
            "circle-radius": 24,
            "circle-color": "rgba(213, 43, 30, .18)",
            "circle-stroke-color": "rgba(213, 43, 30, .34)",
            "circle-stroke-width": 8,
          },
        });
        map.addLayer({
          id: "site-cluster-ambient",
          type: "circle",
          source: "sites",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#4a7d9e",
              50,
              "#315b79",
              200,
              "#d52b1e",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              27,
              50,
              34,
              200,
              43,
            ],
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              0.2,
              10,
              0.1,
            ],
            "circle-blur": 0.55,
          },
        });
        map.addLayer({
          id: "site-clusters",
          type: "circle",
          source: "sites",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#315f7f",
              50,
              "#244866",
              200,
              "#172b46",
              500,
              "#101828",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,
              50,
              22,
              200,
              27,
            ],
            "circle-stroke-color": "rgba(255,255,255,.96)",
            "circle-stroke-width": 2.5,
          },
        });
        map.addLayer({
          id: "site-cluster-count",
          type: "symbol",
          source: "sites",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
            "text-font": ["Noto Sans Regular"],
          },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "site-markers",
          type: "symbol",
          source: "sites",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": [
              "match",
              ["get", "type"],
              ...Object.entries(TYPE_IMAGE_NAMES).flat(),
              TYPE_IMAGE_NAMES.Outras,
            ],
            "icon-size": 0.68,
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
          },
        });

        map.on("click", "site-clusters", async (event) => {
          const feature = map.queryRenderedFeatures(event.point, {
            layers: ["site-clusters"],
          })[0];
          if (!feature) return;
          const source = map.getSource("sites");
          const zoom = await source.getClusterExpansionZoom(
            feature.properties.cluster_id,
          );
          map.easeTo({ center: feature.geometry.coordinates, zoom });
        });
        map.on("click", "site-markers", (event) => {
          const siteId = event.features?.[0]?.properties?.id;
          if (siteId) selectSiteRef.current(siteId);
        });
        ["site-clusters", "site-markers"].forEach((layer) => {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        });
        setMapReady(true);
      });

      map.on("moveend", () => {
        const center = map.getCenter();
        updateParams({
          lng: center.lng.toFixed(5),
          lat: center.lat.toFixed(5),
          zoom: map.getZoom().toFixed(2),
        });
      });
      map.on("error", (event) => {
        if (!map.loaded() && event?.error?.message) {
          setMapError(
            "O mapa-base não respondeu. Recarregue a página para tentar novamente.",
          );
        }
      });
    } catch (error) {
      setMapError(
        error?.message || "Este navegador não conseguiu iniciar o mapa.",
      );
    }

    return () => {
      mapRef.current = null;
      map?.remove();
    };
    // The map is intentionally rebuilt only when its visual style changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mapStyle]);

  const geojson = useMemo(
    () => toFeatureCollection(filteredSites),
    [filteredSites],
  );
  geojsonRef.current = geojson;

  useEffect(() => {
    const source = mapRef.current?.getSource("sites");
    if (source) source.setData(geojson);
  }, [geojson, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("selected-site-halo")) return;
    map.setFilter("selected-site-halo", [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "id"], selectedId || ""],
    ]);
  }, [selectedId, mapReady]);

  const fitResults = useCallback(() => {
    const map = mapRef.current;
    if (!map || !filteredSites.length) return;
    if (filteredSites.length === 1) {
      map.easeTo({
        center: [
          Number(filteredSites[0].longitude),
          Number(filteredSites[0].latitude),
        ],
        zoom: isSiteFocus ? 16 : 13,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 500,
      });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    filteredSites.forEach((site) =>
      bounds.extend([Number(site.longitude), Number(site.latitude)]),
    );
    map.fitBounds(bounds, {
      padding: {
        top: 210,
        right: selectedId ? 390 : 70,
        bottom: 70,
        left: 70,
      },
      maxZoom: 12,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 650,
    });
  }, [filteredSites, isSiteFocus, selectedId]);

  const filterSignature = [
    query,
    typeFilter,
    municipalityFilter,
    holderFilter,
    clusterFilter,
    priorityFilter,
    caseFilter,
  ].join("|");
  const lastFilterSignature = useRef("");
  useEffect(() => {
    if (!mapReady || lastFilterSignature.current === filterSignature) return;
    const timer = window.setTimeout(() => {
      lastFilterSignature.current = filterSignature;
      fitResults();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [filterSignature, fitResults, mapReady]);

  useEffect(() => {
    if (
      selectedId &&
      catalog.length &&
      !filteredSites.some((site) => site.id === selectedId)
    ) {
      updateParams({ site: "", foco: "" });
    }
  }, [catalog.length, filteredSites, selectedId, updateParams]);

  const clearFilters = () => {
    updateParams({
      q: "",
      tipo: "",
      municipio: "",
      detentora: "",
      cluster: "",
      prioridade: "",
      casos: "",
      site: "",
      foco: "",
    });
    setFiltersOpen(false);
  };

  const activeFilterCount = [
    typeFilter,
    municipalityFilter,
    holderFilter,
    clusterFilter,
    priorityFilter,
    caseFilter,
  ].filter(Boolean).length;

  return (
    <section className="site-map-page" aria-labelledby="site-map-title">
      <div
        ref={mapContainerRef}
        className="site-map-canvas"
        aria-hidden="true"
      />
      {loading && <MapSkeleton />}

      <div className="site-map-command-deck">
        <div className="site-map-command-heading">
          <span className="site-map-title-icon" aria-hidden="true">
            <MapPinned size={20} />
          </span>
          <div>
            <h1 id="site-map-title">Mapa de Sites</h1>
            <p>Inventário técnico · Minas Gerais</p>
          </div>
          <label className="site-map-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar site ou endereço</span>
            <input
              value={query}
              onChange={(event) => updateParams({ q: event.target.value })}
              placeholder="Estação, endereço ou município"
            />
            {query && (
              <button
                type="button"
                onClick={() => updateParams({ q: "" })}
                aria-label="Limpar pesquisa"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            className="site-map-filter-toggle"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={17} />
            Filtros
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
        </div>

        <div className={`site-map-filter-grid ${filtersOpen ? "is-open" : ""}`}>
          <div className="site-map-filter-heading">
            <div>
              <span>Refinar visualização</span>
              <small>Combine critérios para isolar os sites no mapa</small>
            </div>
            {activeFilterCount > 0 && (
              <strong>{activeFilterCount} ativos</strong>
            )}
          </div>
          <FilterSelect
            label="Tipologia"
            value={typeFilter}
            onChange={(value) => updateParams({ tipo: value })}
          >
            {options.types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
          <label className="site-map-filter site-map-filter-datalist">
            <span>Município</span>
            <input
              list="site-map-municipalities"
              value={municipalityFilter}
              onChange={(event) =>
                updateParams({ municipio: event.target.value })
              }
              placeholder="Todos"
            />
            <datalist id="site-map-municipalities">
              {options.municipalities.map((option) => (
                <option value={option.label} key={option.value} />
              ))}
            </datalist>
          </label>
          <FilterSelect
            label="Detentora"
            value={holderFilter}
            onChange={(value) => updateParams({ detentora: value })}
          >
            {options.holders.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Cluster"
            value={clusterFilter}
            onChange={(value) => updateParams({ cluster: value })}
          >
            {options.clusters.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Prioridade"
            value={priorityFilter}
            onChange={(value) => updateParams({ prioridade: value })}
          >
            {options.priorities.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Casos"
            value={caseFilter}
            onChange={(value) => updateParams({ casos: value })}
          >
            <option value="com">Com caso vinculado</option>
            <option value="sem">Sem caso vinculado</option>
          </FilterSelect>
          <button
            type="button"
            className="site-map-clear-filters"
            onClick={clearFilters}
            disabled={!activeFilterCount && !query}
          >
            <RotateCcw size={15} />
            Limpar
          </button>
        </div>
      </div>

      <div className="site-map-kpis" aria-live="polite">
        <span className="site-map-kpis-heading">Recorte atual</span>
        <div>
          <strong>{numberFormat.format(metrics.sites)}</strong>
          <span>sites</span>
        </div>
        <div>
          <strong>{numberFormat.format(metrics.municipalities)}</strong>
          <span>municípios</span>
        </div>
        <div>
          <strong>{numberFormat.format(metrics.types)}</strong>
          <span>tipologias</span>
        </div>
        <div>
          <strong>{numberFormat.format(metrics.cases)}</strong>
          <span>casos vinculados</span>
        </div>
      </div>

      {usingDemoStyle && !loading && (
        <div className="site-map-provider-note">
          Mapa de demonstração · configure a chave MapTiler para produção
        </div>
      )}

      {(catalogError || mapError) && (
        <aside className="site-map-error" role="alert">
          <CircleAlert size={20} />
          <div>
            <strong>
              {catalogError ? "Dados indisponíveis" : "Mapa indisponível"}
            </strong>
            <p>{catalogError || mapError}</p>
          </div>
          {catalogError && (
            <button type="button" onClick={() => loadCatalog(true)}>
              Tentar novamente
            </button>
          )}
        </aside>
      )}

      <div className="site-map-controls" aria-label="Controles do mapa">
        <button
          type="button"
          className={mapMode === "mapa" ? "active" : ""}
          onClick={() => updateParams({ mapa: "mapa" })}
        >
          <MapIcon size={17} />
          Mapa
        </button>
        <button
          type="button"
          className={mapMode === "satelite" ? "active" : ""}
          onClick={() => updateParams({ mapa: "satelite" })}
          disabled={usingDemoStyle}
          title={usingDemoStyle ? "Disponível com a chave MapTiler" : undefined}
        >
          <Layers3 size={17} />
          Satélite
        </button>
        <span className="site-map-control-divider" />
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Aproximar"
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Afastar"
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          onClick={fitResults}
          aria-label="Enquadrar resultados"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      <aside className={`site-map-legend ${legendOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="site-map-legend-heading"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
        >
          <span>
            <Layers3 size={15} />
            <strong>Tipologias</strong>
          </span>
          <ChevronDown size={16} />
        </button>
        {legendOpen && (
          <div className="site-map-legend-content">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type}>
                <i style={{ background: color }} />
                {type}
              </div>
            ))}
          </div>
        )}
      </aside>

      {selectedId && (
        <aside
          className="site-map-detail"
          aria-label="Detalhes do site selecionado"
        >
          <header>
            <div>
              <span>Site selecionado</span>
              <strong>{detail?.station || "Carregando…"}</strong>
            </div>
            <button
              type="button"
              onClick={() => updateParams({ site: "", foco: "" }, false)}
              aria-label="Fechar detalhes"
            >
              <X size={19} />
            </button>
          </header>
          {detailLoading && (
            <div className="site-map-detail-loading">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          {detailError && (
            <div className="site-map-detail-error">
              <CircleAlert size={20} />
              <p>{detailError}</p>
            </div>
          )}
          {detail && !detailLoading && (
            <div className="site-map-detail-body">
              <div className="site-map-detail-identity">
                <span
                  style={{
                    background:
                      TYPE_COLORS[detail.station_type_normalized] ||
                      TYPE_COLORS.Outras,
                  }}
                >
                  <SiteTypeIcon
                    type={detail.station_type_normalized}
                    family="signal"
                    size={20}
                  />
                </span>
                <div>
                  <h2>{detail.station}</h2>
                  <p>{valueOrMissing(detail.municipality)}</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Nome completo</dt>
                  <dd>
                    {valueOrMissing(
                      detail.full_station || detail.smart_plan_name,
                    )}
                  </dd>
                </div>
                <div className="wide">
                  <dt>Endereço</dt>
                  <dd>
                    {valueOrMissing(detail.address)}
                    {detail.postal_code ? ` · CEP ${detail.postal_code}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Tipologia</dt>
                  <dd>{valueOrMissing(detail.station_type_normalized)}</dd>
                </div>
                <div>
                  <dt>Tipologia original</dt>
                  <dd>{valueOrMissing(detail.station_type)}</dd>
                </div>
                <div>
                  <dt>Detentora</dt>
                  <dd>{valueOrMissing(detail.holder)}</dd>
                </div>
                <div>
                  <dt>Cluster EQS</dt>
                  <dd>{valueOrMissing(detail.eqs_cluster)}</dd>
                </div>
                <div>
                  <dt>Prioridade</dt>
                  <dd>{valueOrMissing(detail.priority_level)}</dd>
                </div>
                <div>
                  <dt>Coordenadas</dt>
                  <dd>
                    {Number(detail.latitude).toFixed(6)},{" "}
                    {Number(detail.longitude).toFixed(6)}
                  </dd>
                </div>
              </dl>
              <section className="site-map-related-cases">
                <div>
                  <Building2 size={17} />
                  <strong>Casos vinculados</strong>
                  <span>{detail.cases?.length || 0}</span>
                </div>
                {detail.cases?.length ? (
                  <ul>
                    {detail.cases.map((caseItem) => (
                      <li key={caseItem.id}>
                        <span>
                          <strong>{caseItem.display_name}</strong>
                          <small>
                            {STATUS_LABELS[caseItem.status] || caseItem.status}
                          </small>
                        </span>
                        <Link to={`/casos/${caseItem.id}`}>Ver caso</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhum caso de acesso está vinculado a este site.</p>
                )}
              </section>
            </div>
          )}
        </aside>
      )}
    </section>
  );
}
