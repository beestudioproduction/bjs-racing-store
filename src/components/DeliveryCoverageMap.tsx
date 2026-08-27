// File: src/components/DeliveryCoverageMap.tsx
// Peta zona pengiriman internal (radius ~8km) menggunakan MapLibre GL JS + Protomaps.
import React, { useEffect, useRef } from "react";
import { loadMaplibre, getBasemapStyle, STORE_LAT, STORE_LNG, STORE_NAME } from "@/lib/mapBasemap";

interface DeliveryCoverageMapProps {
  height?: number | string;
}

const RADIUS_METERS = 8000;
const EDGE_POINTS = 64;

function circlePolygon(centerLat: number, centerLng: number, radiusMeters: number) {
  const coords: [number, number][] = [];
  const earth = 6378137;
  const dLat = (radiusMeters / earth) * (180 / Math.PI);
  const dLng =
    ((radiusMeters / earth) * (180 / Math.PI)) /
    Math.cos((centerLat * Math.PI) / 180);
  for (let i = 0; i < EDGE_POINTS; i++) {
    const theta = (i / EDGE_POINTS) * 2 * Math.PI;
    const lat = centerLat + dLat * Math.sin(theta);
    const lng = centerLng + dLng * Math.cos(theta);
    coords.push([lng, lat]);
  }
  return coords;
}

const DeliveryCoverageMap = ({ height = 420 }: DeliveryCoverageMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (typeof window === "undefined") return;

    let map: any = null;
    let destroyed = false;

    const init = async () => {
      const { default: ml } = await loadMaplibre();
      const style = await getBasemapStyle((s: any) => {
        s.glyphs = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";
      });

      map = new ml.Map({
        container: containerRef.current!,
        style,
        center: [STORE_LNG, STORE_LAT],
        zoom: 12,
      });

      map.on("style.load", () => {
        if (destroyed || !map) return;
        map.addSource("coverage", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [circlePolygon(STORE_LAT, STORE_LNG, RADIUS_METERS)],
            },
          },
        });
        map.addLayer({
          id: "coverage-fill",
          type: "fill",
          source: "coverage",
          paint: {
            "fill-color": "#fdba74",
            "fill-opacity": 0.22,
          },
        });
        map.addLayer({
          id: "coverage-border",
          type: "line",
          source: "coverage",
          paint: {
            "line-color": "#ea580c",
            "line-width": 2,
            "line-dasharray": [4, 3],
          },
        });
        map.addSource("store", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { name: STORE_NAME },
                geometry: { type: "Point", coordinates: [STORE_LNG, STORE_LAT] },
              },
            ],
          },
        });
        map.addLayer({
          id: "store",
          type: "circle",
          source: "store",
          paint: {
            "circle-radius": 10,
            "circle-color": "#ea580c",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.on("click", "coverage-fill", (e: any) => {
          new ml.Popup({ offset: 20 })
            .setLngLat(e.lngLat)
            .setHTML("<b>Zona Pengiriman Internal</b><br/>Radius ~8 km")
            .addTo(map);
        });
      });

      mapRef.current = map;
    };

    init().catch((err) => console.error("Gagal inisialisasi MapLibre:", err));

    return () => {
      destroyed = true;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        style={{ height: typeof height === "number" ? `${height}px` : height, width: "100%", borderRadius: 12 }}
      />
      <div className="mt-3 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Zona Pengiriman Internal</p>
        <p>
          Area persebaran kurir internal BJS Racing Store sekitar toko (radius ~8 km).
          Jika alamat Anda berada dalam zona ini, Anda bisa memilih layanan pengiriman internal.
        </p>
      </div>
    </div>
  );
};

export default DeliveryCoverageMap;
