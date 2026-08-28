// File: src/lib/mapBasemap.ts
// Helper bersama untuk komponen peta MapLibre GL JS.
// - Lazy load maplibre + css (mengikuti pola Leaflet yang sudah ada).
// - Sediakan style basemap Protomaps (OpenFreeMap) gratis, tanpa API key.

export const BASEMAP_URL = "https://tiles.openfreemap.org/styles/liberty";

export const MAP_ATTRIBUTION =
  '© <a href="https://openfreemap.org">OpenFreeMap</a> | © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const STORE_LAT = Number(import.meta.env.BITESHIP_ORIGIN_LAT || -6.5244682);
export const STORE_LNG = Number(import.meta.env.BITESHIP_ORIGIN_LNG || 110.7674915);
export const STORE_NAME = import.meta.env.BITESHIP_ORIGIN_NAME || "BJS Racing Store";
export const STORE_ADDRESS =
  import.meta.env.BITESHIP_ORIGIN_ADDRESS || "Jl. Wijaya Kusuma No.79, Bangsri, Jepara";

export interface MapLibreModule {
  default: typeof import("maplibre-gl");
}

/** Lazy-load maplibre-gl (client only). Resolusi berupa module maplibre-gl. */
export async function loadMaplibre(): Promise<MapLibreModule> {
  const mod = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");
  return mod as unknown as MapLibreModule;
}

/**
 * Memuat style basemap Protomaps. Gunakan hasilnya untuk `new maplibregl.Map({ style })`.
 * Diberikan `overrides` untuk menambah/ubah source & layer (mis. label bahasa Indonesia).
 */
export async function getBasemapStyle(
  overrides?: (style: any) => any,
): Promise<any> {
  const res = await fetch(BASEMAP_URL);
  if (!res.ok) throw new Error(`Basemap HTTP ${res.status}`);
  const style = await res.json();
  if (typeof overrides === "function") overrides(style);
  return style;
}

/** Buat style GeoJSON untuk source maplibre dari array koordinat [lng,lat]. */
export function lineString(coordinates: [number, number][]) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates },
      },
    ],
  };
}

/** Buat style GeoJSON titik tunggal. */
export function point(lng: number, lat: number, properties: Record<string, any> = {}) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties,
        geometry: { type: "Point" as const, coordinates: [lng, lat] },
      },
    ],
  };
}
