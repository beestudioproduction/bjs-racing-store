// File: src/components/OrderTrackingMap.tsx
// Peta rute toko -> tujuan (mengikuti jalan via OSRM) menggunakan MapLibre GL JS.
import React, { useEffect, useRef, useState } from "react";
import { loadMaplibre, getBasemapStyle, STORE_LAT, STORE_LNG, STORE_NAME, STORE_ADDRESS } from "@/lib/mapBasemap";
import { getOsrmRoute, formatDistance, formatDuration } from "@/lib/osrm";

interface OrderTrackingMapProps {
  customerLat?: string | number | null;
  customerLng?: string | number | null;
  customerAddress?: string | null;
}

const OrderTrackingMap = ({
  customerLat,
  customerLng,
  customerAddress,
}: OrderTrackingMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    fallback: boolean;
  } | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (typeof window === "undefined") return;

    let map: any = null;
    let destroyed = false;

    const originLat = Number.isFinite(STORE_LAT) ? STORE_LAT : -6.5244682;
    const originLng = Number.isFinite(STORE_LNG) ? STORE_LNG : 110.7674915;
    const destLat =
      typeof customerLat === "number" && Number.isFinite(customerLat)
        ? customerLat
        : Number.isFinite(STORE_LAT)
          ? STORE_LAT + 0.02
          : -6.5044682;
    const destLng =
      typeof customerLng === "number" && Number.isFinite(customerLng)
        ? customerLng
        : Number.isFinite(STORE_LNG)
          ? STORE_LNG + 0.02
          : 110.7874915;

    const init = async () => {
      const { default: ml } = await loadMaplibre();
      const style = await getBasemapStyle();

      map = new ml.Map({
        container: mapContainer.current!,
        style,
        center: [(originLng + destLng) / 2, (originLat + destLat) / 2],
        zoom: 12,
      });

      map.on("style.load", () => {
        if (destroyed || !map) return;

        map.addSource("route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.85 },
        });

        map.addSource("points", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { kind: "store" },
                geometry: { type: "Point", coordinates: [originLng, originLat] },
              },
              {
                type: "Feature",
                properties: { kind: "customer" },
                geometry: { type: "Point", coordinates: [destLng, destLat] },
              },
            ],
          },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: "points",
          paint: {
            "circle-radius": ["case", ["==", ["get", "kind"], "store"], 8, 8],
            "circle-color": ["case", ["==", ["get", "kind"], "store"], "#ea580c", "#2563eb"],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
        });

        getOsrmRoute([originLng, originLat], [destLng, destLat]).then((route) => {
          if (destroyed || !map) return;

          const coords = route.geometry as [number, number][];
          (map.getSource("route") as any).setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { fallback: route.fallback },
                geometry: { type: "LineString", coordinates: coords },
              },
            ],
          });

          const src = map.getSource("route") as any;
          if (route.fallback) {
            const id = "route";
            map.setPaintProperty(id, "line-color", "#f97316");
            map.setPaintProperty(id, "line-dasharray", [0.5, 0.7]);
            map.setPaintProperty(id, "line-opacity", 1);
          } else {
            const id = "route";
            if (src) {
              map.setPaintProperty(id, "line-color", "#2563eb");
              map.setPaintProperty(id, "line-dasharray", [1, 0]);
            }
          }

          if (coords.length > 0) {
            const bounds = new ml.LngLatBounds();
            coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
            if (!destroyed) map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
          }

          setRouteInfo({
            distance: formatDistance(route.distanceMeters),
            duration: formatDuration(route.durationSeconds),
            fallback: route.fallback,
          });
        });
      });

      map.on("click", "points", (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const html =
          f.properties.kind === "store"
            ? `<b>${STORE_NAME}</b><br/>${STORE_ADDRESS}`
            : `<b>Alamat Tujuan</b><br/>${customerAddress || "Customer"}`;
        new ml.Popup({ offset: 20 }).setLngLat(e.lngLat).setHTML(html).addTo(map);
      });
    };

    init().catch((err) => console.error("Gagal inisialisasi MapLibre:", err));

    return () => {
      destroyed = true;
      if (map) {
        map.remove();
      }
    };
  }, [customerLat, customerLng, customerAddress]);

  return (
    <div className="w-full">
      <div
        ref={mapContainer}
        style={{ height: "420px", width: "100%", borderRadius: "12px" }}
      />
      {routeInfo && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <p>
            Jarak: <span className="font-semibold text-slate-800">{routeInfo.distance}</span>
          </p>
          <p>
            Estimasi: <span className="font-semibold text-slate-800">{routeInfo.duration}</span>
          </p>
          {routeInfo.fallback && (
            <p className="text-xs text-orange-600">Menampilkan rute garis lurus</p>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderTrackingMap;
