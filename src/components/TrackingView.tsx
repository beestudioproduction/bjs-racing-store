// File: src/components/TrackingView.tsx
// Tracking pesanan publik untuk pelanggan (khusus BJS Express internal).
// Menggunakan MapLibre GL JS dengan live tracking smooth (rotasi heading + interpolasi).
import React, { useEffect, useRef, useState } from "react";
import { getOsrmRoute } from "@/lib/osrm";
import { supabase } from "@/lib/supabaseBrowserClient";
import { loadMaplibre, getBasemapStyle } from "@/lib/mapBasemap";
import OptimizedImage from "./OptimizedImage.jsx";

const STORE_LAT = Number(import.meta.env.BITESHIP_ORIGIN_LAT || -6.5244682);
const STORE_LNG = Number(import.meta.env.BITESHIP_ORIGIN_LNG || 110.7674915);
const STORE_PHONE = String(import.meta.env.PUBLIC_STORE_PHONE || "62881011669213").replace(/[^0-9]/g, "");

const ORDER_STATUS_META: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "Menunggu Pembayaran", color: "bg-slate-100 text-slate-700" },
  paid: { label: "Pembayaran Diterima", color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Dalam Pengiriman", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Pesanan Selesai", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Dibatalkan", color: "bg-red-100 text-red-800" },
};

const ASSIGNMENT_STATUS_META: Record<string, { label: string; desc: string }> = {
  assigned: { label: "Menunggu Kurir Ambil", desc: "Pesanan sudah disiapkan toko dan menunggu kurir mengambil di toko." },
  picked: { label: "Barang Sudah Diambil", desc: "Kurir sudah mengambil pesanan dari toko." },
  in_transit: { label: "Dalam Perjalanan", desc: "Kurir sedang mengantarkan pesanan ke alamat kamu." },
  dropping_off: { label: "Sampai di Lokasi", desc: "Kurir sudah tiba di lokasi, pesanan sedang diserahkan." },
  completed: { label: "Pesanan Selesai", desc: "Pesanan sudah diterima. Terima kasih sudah berbelanja di BJS Racing Store!" },
  cancelled: { label: "Dibatalkan", desc: "Pengiriman dibatalkan." },
};

const formatRupiah = (n?: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const formatWaktu = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

const WA_META: Record<string, string> = {
  assigned: "Menunggu kurir mengambil pesanan di toko",
  picked: "Barang sudah diambil kurir dari toko",
  in_transit: "Sedang dalam perjalanan menuju alamat kamu",
  dropping_off: "Kurir sudah tiba di lokasi",
  completed: "Pesanan sudah diterima",
  cancelled: "Pengiriman dibatalkan",
};

// Konversi km/jam ke satuan kecepatan animasi marker (degree/detik pada zoom ~16).
function bearing(from: { lng: number; lat: number }, to: { lng: number; lat: number }) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const toDeg = (x: number) => (x * 180) / Math.PI;
  const dLon = toRad(to.lng - from.lng);
  const y = Math.sin(dLon) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLon);
  return ((toDeg(Math.atan2(y, x)) + 360) % 360);
}

interface Props {
  orderNumber: string;
  compact?: boolean;
}

const TrackingView = ({ orderNumber, compact = false }: Props) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courierLoc, setCourierLoc] = useState<{ lat: number; lng: number; t: string; heading?: number; speed?: number } | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const courierMarkerRef = useRef<any>(null);
  const courierMarkerElRef = useRef<HTMLDivElement | null>(null);
  const courierAccRef = useRef<any>(null);
  const courierLineRef = useRef<any>(null);
  const animRef = useRef<number | null>(null);
  const curPosRef = useRef<{ lng: number; lat: number } | null>(null);
  const routeTimerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/tracking/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Pesanan tidak ditemukan.");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Gagal memuat tracking.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [orderNumber]);

  // Live tracking: subscribe ke Supabase Realtime untuk lokasi kurir
  useEffect(() => {
    const asgId = data?.assignment?.id;
    const done = data?.assignment?.status === "completed" || data?.assignment?.status === "cancelled";
    if (!data?.is_internal || !asgId || done) {
      setCourierLoc(null);
      return;
    }
    const channel = supabase
      .channel(`courier-location-${asgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "courier_locations",
          filter: `assignment_id=eq.${asgId}`,
        },
        (payload: any) => {
          const r = payload.new;
          if (!r) return;
          setCourierLoc({
            lat: Number(r.lat),
            lng: Number(r.lng),
            t: r.recorded_at || new Date().toISOString(),
            heading: r.heading != null ? Number(r.heading) : undefined,
            speed: r.speed != null ? Number(r.speed) : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.is_internal, data?.assignment?.id, data?.assignment?.status]);

  const destLat = Number(data?.address?.latitude);
  const destLng = Number(data?.address?.longitude);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return;
    if (!data?.is_internal) return;
    if (typeof window === "undefined") return;

    let map: any = null;
    let destroyed = false;

    const init = async () => {
      const { default: ml } = await loadMaplibre();
      const style = await getBasemapStyle((s: any) => {
        s.glyphs = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";
      });

      map = new ml.Map({
        container: mapContainer.current!,
        style,
        center: [(STORE_LNG + destLng) / 2, (STORE_LAT + destLat) / 2],
        zoom: 13,
      });
      mapRef.current = map;

      // Marker HTML untuk kurir agar bisa di-rotate + di-animasi smooth
      const el = document.createElement("div");
      el.className = "bjs-courier-marker";
      el.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 0 0 6px rgba(22,163,74,.2);position:relative;transition:transform .25s ease-out;";
      el.setAttribute("data-heading", "0");
      courierMarkerElRef.current = el;
      courierMarkerRef.current = new ml.Marker({ element: el }).setLngLat([0, 0]).addTo(map);

      map.on("style.load", () => {
        if (destroyed || !map) return;

        map.addSource("acc", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "acc",
          type: "fill",
          source: "acc",
          paint: { "fill-color": "#16a34a", "fill-opacity": 0.08 },
        });
        courierAccRef.current = map.getSource("acc");

        map.addSource("courier-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "courier-line",
          type: "line",
          source: "courier-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#16a34a", "line-width": 4, "line-opacity": 0.9 },
        });
        courierLineRef.current = map.getSource("courier-line");

        map.addSource("dest-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "dest-line",
          type: "line",
          source: "dest-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#f97316", "line-width": 4, "line-opacity": 0.8, "line-dasharray": [4, 3] },
        });

        map.addSource("points", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { k: "store" }, geometry: { type: "Point", coordinates: [STORE_LNG, STORE_LAT] } },
              { type: "Feature", properties: { k: "dest" }, geometry: { type: "Point", coordinates: [destLng, destLat] } },
            ],
          },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: "points",
          paint: {
            "circle-radius": ["case", ["==", ["get", "k"], "store"], 7, 7],
            "circle-color": ["case", ["==", ["get", "k"], "store"], "#ea580c", "#2563eb"],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
        });

        getOsrmRoute([STORE_LNG, STORE_LAT], [destLng, destLat]).then((route) => {
          if (destroyed || !map) return;
          const coords = route.geometry as [number, number][];
          (map.getSource("dest-line") as any).setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }],
          });
          if (!courierLoc) {
            const bounds = new ml.LngLatBounds();
            coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
            if (!destroyed) map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
          }
        });
      });

      map.on("click", "points", (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const html = f.properties.k === "store" ? "<b>Toko BJS Racing</b>" : "<b>Alamat Kamu</b>";
        new ml.Popup({ offset: 20 }).setLngLat(e.lngLat).setHTML(html).addTo(map);
      });
    };

    init().catch((err) => console.error("Gagal inisialisasi MapLibre:", err));

    return () => {
      destroyed = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current);
      if (map) {
        map.remove();
        mapRef.current = null;
        courierMarkerRef.current = null;
        courierMarkerElRef.current = null;
        courierAccRef.current = null;
        courierLineRef.current = null;
        curPosRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destLat, destLng, data?.is_internal]);

  // Update marker kurir smooth + rute kurir -> tujuan (debounce)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !courierLoc) return;
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return;

    const target = { lng: courierLoc.lng, lat: courierLoc.lat };
    const start = curPosRef.current || target;

    // Animasikan marker dari posisi lama ke posisi baru
    const duration = 900;
    const t0 = performance.now();
    const step = (t: number) => {
      if (!courierMarkerElRef.current) return;
      const k = Math.min(1, (t - t0) / duration);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const lng = start.lng + (target.lng - start.lng) * ease;
      const lat = start.lat + (target.lat - start.lat) * ease;
      courierMarkerRef.current?.setLngLat([lng, lat]);
      curPosRef.current = { lng, lat };
      if (k < 1) {
        animRef.current = requestAnimationFrame(step);
      }
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);

    // Update heading (rotasi)
    if (start.lng !== target.lng || start.lat !== target.lat) {
      const b = bearing(start, target);
      const el = courierMarkerElRef.current;
      if (el) {
        el.style.transform = `rotate(${b}deg)`;
        el.setAttribute("data-heading", String(b));
      }
    } else if (courierLoc.heading != null) {
      const el = courierMarkerElRef.current;
      if (el) el.style.transform = `rotate(${courierLoc.heading}deg)`;
    }

    // Update circle akurasi bila ada
    const acc = courierAccRef.current;
    if (acc && courierLoc.speed == null) {
      acc.setData(circleAt(courierLoc.lat, courierLoc.lng, 25));
    }

    // Rute kurir -> tujuan, dengan debounce
    if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current);
    routeTimerRef.current = window.setTimeout(() => {
      getOsrmRoute([courierLoc.lng, courierLoc.lat], [destLng, destLat])
        .then((route) => {
          const src = courierLineRef.current;
          if (!src || !map) return;
          const coords = route.geometry as [number, number][];
          src.setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }],
          });
        })
        .catch(() => {});
    }, 3000);
  }, [courierLoc, destLat, destLng]);

  if (loading) {
    return <p className="text-center text-slate-500 py-16">Mencari pesanan...</p>;
  }
  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center">
        <p className="text-red-600 font-semibold mb-2">{error || "Pesanan tidak ditemukan."}</p>
        <a href="/tracking" className="text-blue-600 hover:underline text-sm">
          &larr; Coba nomor lain
        </a>
      </div>
    );
  }

  const orderMeta = ORDER_STATUS_META[data.status] || { label: data.status, color: "bg-slate-100 text-slate-700" };
  const cd = data.courier_details || {};
  const asg = data.assignment;
  const status = asg?.status || (data.status === "completed" ? "completed" : cd.shipping_status || "assigned");
  const asgMeta = ASSIGNMENT_STATUS_META[status] || ASSIGNMENT_STATUS_META.assigned;

  return (
    <div className={compact ? "space-y-4" : "container mx-auto px-4 py-8 max-w-2xl"}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h1 className={`font-bold ${compact ? "text-lg" : "text-2xl"}`}>
          {compact ? "Lacak Pengiriman BJS Express" : "Lacak Pesanan"}
        </h1>
        {!compact && <a href="/tracking" className="text-blue-600 hover:underline text-sm">Lacak lainnya</a>}
      </div>

      {!compact && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">Nomor Pesanan</p>
              <p className="font-mono font-bold">{data.order_number}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${orderMeta.color}`}>
              {orderMeta.label}
            </span>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            <p>Dibuat: {formatWaktu(data.created_at)}</p>
            {data.delivered_at ? <p>Selesai: {formatWaktu(data.delivered_at)}</p> : null}
          </div>
        </div>
      )}

      {data.is_internal && asg && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="font-bold">{asgMeta.label}</h2>
            {courierLoc && (
              <span className="ml-auto inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                Live
              </span>
            )}
          </div>
          {courierLoc && (
            <p className="text-xs text-slate-500 mb-2">
              Lokasi kurir diperbarui: {formatWaktu(courierLoc.t)}
            </p>
          )}
          <p className="text-sm text-slate-600">{asgMeta.desc}</p>
          {asg.courier && (
            <p className="text-sm text-slate-600 mt-2">
              Kurir: <span className="font-medium">{asg.courier.name}</span>
              {asg.courier.phone ? ` (${asg.courier.phone})` : ""}
            </p>
          )}

          <div className="mt-4 space-y-0">
            {asg.events?.length > 0 ? (
              <ol className="relative border-l border-slate-200 ml-3 space-y-4">
                {asg.events.map((ev: any, i: number) => (
                  <li key={ev.id || i} className="ml-6">
                    <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full bg-orange-500 border-4 border-white" />
                    <p className="font-medium text-sm">
                      {ASSIGNMENT_STATUS_META[ev.status]?.label || ev.status}
                    </p>
                    <p className="text-xs text-slate-500">{formatWaktu(ev.created_at)}</p>
                    {ev.note ? <p className="text-xs text-slate-600 mt-1">"{ev.note}"</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">
                Status pengiriman akan diperbarui saat kurir mulai mengantarkan.
              </p>
            )}
          </div>
        </div>
      )}

      {asg?.photo_url ? (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
          <h2 className="font-bold mb-2">Bukti Pengiriman</h2>
          <OptimizedImage src={asg.photo_url} alt="Bukti pengiriman" width={600} className="rounded-lg w-full max-h-72 object-cover" />
        </div>
      ) : null}

      {data.notes && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
          <h2 className="font-bold mb-2">Catatan Pesanan</h2>
          <p className="text-sm text-slate-600">{data.notes}</p>
        </div>
      )}

      {data.is_internal && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
          <h2 className="font-bold mb-2">Butuh Bantuan?</h2>
          <a
            href={`https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(
              `Halo BJS Racing, saya ingin bertanya tentang pesanan ${data.order_number} (${WA_META[status] || "sedang diproses"}).`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Chat via WhatsApp
          </a>
        </div>
      )}

      {!compact && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
          <h2 className="font-bold mb-2">Daftar Barang</h2>
          <ul className="divide-y divide-slate-100">
            {data.items.map((it: any, i: number) => (
              <li key={i} className="py-2 flex items-center gap-3">
                {it.image_url ? (
                  <OptimizedImage src={it.image_url} alt={it.nama} width={100} className="w-12 h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded-lg" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">{it.nama}</p>
                  <p className="text-xs text-slate-500">{it.quantity} x {formatRupiah(it.price)}</p>
                </div>
                <p className="text-sm font-semibold">{formatRupiah(it.price * it.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-3 border-t border-slate-100 text-sm">
            <p className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatRupiah(data.subtotal_products)}</span></p>
            <p className="flex justify-between"><span className="text-slate-500">Ongkir</span><span>{formatRupiah(data.shipping_cost)}</span></p>
            <p className="flex justify-between font-bold mt-1"><span>Total</span><span>{formatRupiah(data.total_amount)}</span></p>
          </div>
        </div>
      )}

      {data.is_internal && Number.isFinite(destLat) && Number.isFinite(destLng) && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
          <h2 className="font-bold mb-2">Rute Pengiriman</h2>
          <div ref={mapContainer} style={{ height: "300px", borderRadius: "12px" }} />
        </div>
      )}

      {!compact && (
        <div className="text-center text-xs text-slate-400 mt-6">
          BJS Express • bjs-racing-store
        </div>
      )}
    </div>
  );
};

// Posisi & polyline lingkaran akurasi
function circleAt(centerLat: number, centerLng: number, radiusMeters: number) {
  const coords: [number, number][] = [];
  const earth = 6378137;
  const dLat = (radiusMeters / earth) * (180 / Math.PI);
  const dLng = ((radiusMeters / earth) * (180 / Math.PI)) / Math.cos((centerLat * Math.PI) / 180);
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

export default TrackingView;
