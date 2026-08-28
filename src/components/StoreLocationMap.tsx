// File: src/components/StoreLocationMap.tsx
// Peta lokasi toko menggunakan MapLibre GL JS + basemap Protomaps.
import React, { useEffect, useRef } from "react";
import { loadMaplibre, getBasemapStyle, STORE_LAT, STORE_LNG, STORE_NAME, STORE_ADDRESS } from "@/lib/mapBasemap";

interface StoreLocationMapProps {
  height?: number | string;
}

const StoreLocationMap = ({ height = 420 }: StoreLocationMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (typeof window === "undefined") return;

    let map: any = null;
    let destroyed = false;

    const init = async () => {
      const { default: ml } = await loadMaplibre();
      const style = await getBasemapStyle();

      map = new ml.Map({
        container: containerRef.current!,
        style,
        center: [STORE_LNG, STORE_LAT],
        zoom: 16,
      });

      map.on("style.load", () => {
        if (destroyed || !map) return;
        map.addSource("store", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { name: STORE_NAME, address: STORE_ADDRESS },
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
            "circle-radius": 12,
            "circle-color": "#ea580c",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 1,
          },
        });
        map.on("click", "store", (e: any) => {
          const f = e.features?.[0];
          if (!f) return;
          new ml.Popup({ offset: 20 })
            .setLngLat((e.lngLat as any).toArray())
            .setHTML(`<b>${f.properties.name}</b><br/>${f.properties.address}`)
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
    </div>
  );
};

export default StoreLocationMap;
