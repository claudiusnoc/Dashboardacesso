import { useEffect, useMemo, useRef } from "react";
import { MapPinned } from "lucide-react";
import { Link } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getSiteTypeColor, normalizeSiteType } from "./SiteTypeIcon";
import {
  applyPortalMapTheme,
  createSitePinImage,
  getPortalMapStyle,
} from "./siteMapPresentation";

function validCoordinates(site) {
  const latitude = Number(site?.latitude);
  const longitude = Number(site?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export default function SiteLocationPreview({ site }) {
  const mapContainerRef = useRef(null);
  const coordinates = useMemo(() => validCoordinates(site), [site]);
  const siteType = normalizeSiteType(site?.station_type);
  const maptilerKey = String(import.meta.env.VITE_MAPTILER_KEY || "").trim();

  useEffect(() => {
    if (!coordinates || !mapContainerRef.current) return undefined;
    let map;
    let disposed = false;
    let usingFallback = !maptilerKey;
    let resizeObserver;

    const renderCurrentSite = () => {
      if (disposed || !map?.isStyleLoaded()) return;
      if (!usingFallback) applyPortalMapTheme(map);

      const sourceId = "current-site-location";
      const imageId = "current-site-location-pin";
      if (map.getSource(sourceId)) return;
      if (!map.hasImage(imageId)) {
        map.addImage(
          imageId,
          createSitePinImage(siteType, getSiteTypeColor(siteType)),
          { pixelRatio: 2 },
        );
      }
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: [coordinates.longitude, coordinates.latitude],
              },
            },
          ],
        },
      });
      map.addLayer({
        id: "current-site-location-pulse",
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 23,
          "circle-color": getSiteTypeColor(siteType),
          "circle-opacity": 0.16,
          "circle-stroke-width": 1,
          "circle-stroke-color": getSiteTypeColor(siteType),
          "circle-stroke-opacity": 0.45,
        },
      });
      map.addLayer({
        id: "current-site-location-marker",
        type: "symbol",
        source: sourceId,
        layout: {
          "icon-image": imageId,
          "icon-size": 0.82,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        },
      });
      requestAnimationFrame(() => {
        map.resize();
        requestAnimationFrame(() => map.resize());
      });
    };

    const fallbackToOpenStreetMap = () => {
      if (disposed || usingFallback || !map) return;
      usingFallback = true;
      map.setStyle(getPortalMapStyle(""));
      map.once("style.load", renderCurrentSite);
    };

    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getPortalMapStyle(maptilerKey),
        center: [coordinates.longitude, coordinates.latitude],
        zoom: 16,
        minZoom: 16,
        maxZoom: 16,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );
      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(mapContainerRef.current);
      map.on("load", renderCurrentSite);
      map.on("error", fallbackToOpenStreetMap);
    } catch {
      // The link remains available even when MapLibre cannot initialize.
    }

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, [coordinates, maptilerKey, siteType]);

  if (!coordinates) {
    return (
      <section
        className="case-site-map-preview is-unavailable"
        aria-label="Localizacao do site"
      >
        <div className="case-site-map-unavailable-copy">
          <MapPinned size={20} aria-hidden="true" />
          <strong>Coordenadas indisponiveis</strong>
          <span>Este site ainda nao possui uma referencia no mapa.</span>
        </div>
      </section>
    );
  }

  const search = new URLSearchParams({
    site: String(site.id),
    foco: "site",
    lat: coordinates.latitude.toFixed(6),
    lng: coordinates.longitude.toFixed(6),
    zoom: "16",
  });

  return (
    <Link
      className="case-site-map-preview is-ready"
      to={`/mapa-sites?${search.toString()}`}
      aria-label={`Abrir ${site?.station || "site"} no Mapa de Sites`}
    >
      <div
        ref={mapContainerRef}
        className="case-site-map-canvas"
        aria-hidden="true"
      />
    </Link>
  );
}
