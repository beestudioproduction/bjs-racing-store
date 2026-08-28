// File: src/components/MapPicker.tsx
// Peta MapLibre GL JS dengan GPS auto-locate, marker toko, dan mode interaktif.
import React, { useEffect, useRef, useCallback } from "react";
import { loadMaplibre, getBasemapStyle, STORE_LAT, STORE_LNG, STORE_NAME } from "@/lib/mapBasemap";

const DEFAULT_CENTER: [number, number] = [110.7674915, -6.5244682];

export interface MapPickerResult {
  lat: number;
  lng: number;
}

interface MapPickerProps {
  latitude?: string | number | null;
  longitude?: string | number | null;
  onSelect?: (result: MapPickerResult) => void;
  onLocationFound?: (lat: number, lng: number) => void;
  onLocationError?: (message: string) => void;
  height?: number | string;
  interactive?: boolean;
  autoLocate?: boolean;
  showStore?: boolean;
  locateKey?: number;
}

const MapPicker = ({
  latitude,
  longitude,
  onSelect,
  onLocationFound,
  onLocationError,
  height = 200,
  interactive = true,
  autoLocate = false,
  showStore = true,
  locateKey,
}: MapPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mlRef = useRef<any>(null);

  const getLat = () => {
    const v = typeof latitude === "string" ? parseFloat(latitude) : latitude;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const getLng = () => {
    const v = typeof longitude === "string" ? parseFloat(longitude) : longitude;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const updateMarkerPosition = useCallback((lat: number | null, lng: number | null) => {
    if (lat == null || lng == null) return;
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    marker.setLngLat([lng, lat]);
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 16) });
  }, []);

  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const { default: ml } = await loadMaplibre();
      mlRef.current = ml;
      const style = await getBasemapStyle();

      const lat = getLat() ?? DEFAULT_CENTER[1];
      const lng = getLng() ?? DEFAULT_CENTER[0];

      const map = new ml.Map({
        container: containerRef.current!,
        style,
        center: [lng, lat],
        zoom: 15,
        dragRotate: interactive,
        touchZoomRotate: interactive,
      });
      mapRef.current = map;

      map.on("style.load", () => {
        if (showStore) {
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
          map.on("click", "store", (e: any) => {
            new ml.Popup({ offset: 20 })
              .setLngLat(e.lngLat)
              .setHTML(`<b>${STORE_NAME}</b><br/>Lokasi Toko`)
              .addTo(map);
          });
        }

        map.addSource("accuracy", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "accuracy",
          type: "fill",
          source: "accuracy",
          paint: { "fill-color": "#93c5fd", "fill-opacity": 0.15 },
        });
      });

      const customerMarker = new ml.Marker({
        draggable: interactive,
        color: "#3b82f6",
      })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current = customerMarker;

      customerMarker.on("dragend", () => {
        const pos = customerMarker.getLngLat();
        onSelect?.({ lat: pos.lat, lng: pos.lng });
      });

      map.on("click", (e: any) => {
        if (!interactive) return;
        customerMarker.setLngLat(e.lngLat);
        onSelect?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      setTimeout(() => map.resize(), 300);
    } catch (error) {
      console.error("Failed to initialize map:", error);
    }
  }, [showStore, getLat, getLng, interactive, onSelect]);

  const doLocate = useCallback(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    const marker = markerRef.current;
    if (!map || !ml || !marker) return;

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      marker.setLngLat([longitude, latitude]);
      map.easeTo({ center: [longitude, latitude], zoom: 16 });

      const radius = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 100;
      const circle = makeCircleShape(latitude, longitude, radius);
      const src = map.getSource("accuracy") as any;
      if (src) src.setData(circle);

      onLocationFound?.(latitude, longitude);
    };

    const onErr = (err: GeolocationPositionError) => {
      onLocationError?.(err.message || "GPS tidak tersedia.");
    };

    if (!("geolocation" in navigator)) {
      onLocationError?.("Geolocation tidak didukung di browser ini.");
      return;
    }
    navigator.geolocation.getCurrentPosition(onSuccess, onErr, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });
  }, [onLocationFound, onLocationError]);

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (autoLocate) {
      doLocate();
    }
    if (locateKey && locateKey > 0) {
      doLocate();
    }
  }, [autoLocate, locateKey, doLocate]);

  useEffect(() => {
    updateMarkerPosition(getLat(), getLng());
  }, [latitude, longitude, updateMarkerPosition]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          width: "100%",
          borderRadius: 12,
          position: "relative",
        }}
      />
    </div>
  );
};

function makeCircleShape(centerLat: number, centerLng: number, radiusMeters: number) {
  const coords: [number, number][] = [];
  const earth = 6378137;
  const dLat = (radiusMeters / earth) * (180 / Math.PI);
  const dLng =
    ((radiusMeters / earth) * (180 / Math.PI)) / Math.cos((centerLat * Math.PI) / 180);
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * 2 * Math.PI;
    coords.push([centerLng + dLng * Math.cos(theta), centerLat + dLat * Math.sin(theta)]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

export default MapPicker;
