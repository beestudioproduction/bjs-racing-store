// File: src/components/CourierAssignmentDetail.tsx
// Detail penugasan kurir BJS Express — info order, peta rute, update status, foto bukti.
// Menggunakan MapLibre GL JS dengan live tracking smooth (rotasi heading + interpolasi).
import React, { useEffect, useRef, useState } from "react";
import { getOsrmRoute, formatDistance, formatDuration } from "@/lib/osrm";
import { supabase } from "@/lib/supabaseBrowserClient";
import { loadMaplibre, getBasemapStyle, STORE_LAT, STORE_LNG } from "@/lib/mapBasemap";
import OptimizedImage from "./OptimizedImage.jsx";

const STATUS_META: Record<string, { label: string; color: string }> = {
  assigned: { label: "Ditunggu ambil di toko", color: "bg-blue-100 text-blue-800" },
  picked: { label: "Barang sudah diambil", color: "bg-indigo-100 text-indigo-800" },
  in_transit: { label: "Dalam perjalanan", color: "bg-purple-100 text-purple-800" },
  dropping_off: { label: "Sampai di lokasi", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Selesai", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Dibatalkan", color: "bg-red-100 text-red-800" },
};

const NEXT_STEPS: Record<string, { status: string; label: string } | null> = {
  assigned: { status: "picked", label: "Ambil Barang" },
  picked: { status: "in_transit", label: "Mulai Antar" },
  in_transit: { status: "dropping_off", label: "Tiba di Lokasi" },
  dropping_off: { status: "completed", label: "Tandai Selesai" },
  completed: null,
  cancelled: null,
};

const formatRupiah = (n?: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const formatWaktu = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

const normalizeTel = (phone?: string) =>
  (phone || "").replace(/[^\d+]/g, "").replace(/^0/, "62");

const STATUS_LABEL: Record<string, string> = {
  assigned: "Ditunggu ambil di toko",
  picked: "Barang sudah diambil",
  in_transit: "Dalam perjalanan",
  dropping_off: "Sampai di lokasi",
  completed: "Pesanan selesai",
  cancelled: "Dibatalkan",
};

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
  assignmentId: string;
}

const CourierAssignmentDetail = ({ assignmentId }: Props) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [live, setLive] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [lastSent, setLastSent] = useState("");
  const mapContainer = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const watchId = useRef<number | null>(null);
  const lastPos = useRef<{ lat: number; lng: number; t: number } | null>(null);

  const mapRef = useRef<any>(null);
  const courierMarkerRef = useRef<any>(null);
  const courierMarkerElRef = useRef<HTMLDivElement | null>(null);
  const courierLineRef = useRef<any>(null);
  const animRef = useRef<number | null>(null);
  const curPosRef = useRef<{ lng: number; lat: number } | null>(null);
  const routeTimerRef = useRef<number | null>(null);

  const haversine = (a: [number, number], b: [number, number]) => {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const stopLive = () => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setLive(false);
  };

  const startLive = () => {
    if (!("geolocation" in navigator)) {
      setLiveError("Geolocation tidak didukung di browser ini.");
      return;
    }
    setLiveError("");
    lastPos.current = null;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const now = Date.now();
        const last = lastPos.current;
        if (last) {
          if (now - last.t < 5000) return;
          if (haversine([last.lat, last.lng], [latitude, longitude]) < 15) return;
        }
        lastPos.current = { lat: latitude, lng: longitude, t: now };
        fetch(`/api/kurir/assignments/${assignmentId}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: latitude, lng: longitude, accuracy, heading, speed }),
        }).catch((err) => console.error("Kirim lokasi gagal:", err));
        setLastSent(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        // Update marker lokal smooth (preview kurir sendiri)
        updateCourierPreview(latitude, longitude, heading != null ? heading : undefined);
      },
      (err) => {
        setLiveError(`Gagal mengambil lokasi (${err.message}). Periksa izin lokasi.`);
        stopLive();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    setLive(true);
  };

  const load = async () => {
    try {
      const res = await fetch(`/api/kurir/assignments/${assignmentId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal memuat detail");
      setData(json);
      setPhotoUrl(json.photo_url || "");
      setError("");
    } catch (err: any) {
      setError(err.message || "Gagal memuat detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [assignmentId]);

  useEffect(() => {
    if (data?.status === "completed" || data?.status === "cancelled") {
      stopLive();
    }
    return () => stopLive();
  }, [data?.status]);

  const destLat = Number(data?.order?.address?.latitude);
  const destLng = Number(data?.order?.address?.longitude);

  // Inisialisasi peta MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return;
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

      const el = document.createElement("div");
      el.className = "bjs-courier-marker";
      el.style.cssText =
        "width:24px;height:24px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 0 0 6px rgba(22,163,74,.25);position:relative;transition:transform .25s ease-out;";
      courierMarkerElRef.current = el;
      courierMarkerRef.current = new ml.Marker({ element: el }).setLngLat([0, 0]).addTo(map);

      map.on("style.load", () => {
        if (destroyed || !map) return;

        map.addSource("courier-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "courier-line",
          type: "line",
          source: "courier-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#16a34a", "line-width": 4, "line-opacity": 0.9 },
        });
        courierLineRef.current = map.getSource("courier-line");

        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
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
            "circle-radius": ["case", ["==", ["get", "k"], "store"], 8, 8],
            "circle-color": ["case", ["==", ["get", "k"], "store"], "#ea580c", "#2563eb"],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
        });

        getOsrmRoute([STORE_LNG, STORE_LAT], [destLng, destLat]).then((route) => {
          if (destroyed || !map) return;
          const coords = route.geometry as [number, number][];
          const id = "route";
          if (route.fallback) {
            map.setPaintProperty(id, "line-color", "#f97316");
            map.setPaintProperty(id, "line-dasharray", [4, 3]);
          }
          (map.getSource("route") as any).setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }],
          });
          if (coords.length > 0) {
            const bounds = new ml.LngLatBounds();
            coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
            if (!destroyed) map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
          }
          const el = document.getElementById("kurir-route-info");
          if (el) el.textContent = `Jarak: ${formatDistance(route.distanceMeters)} • Estimasi: ${formatDuration(route.durationSeconds)}`;
        });
      });

      map.on("click", "points", (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const html = f.properties.k === "store" ? "<b>Toko BJS Racing</b>" : "<b>Alamat Pelanggan</b>";
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
        courierLineRef.current = null;
        curPosRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destLat, destLng]);

  const updateCourierPreview = (lat: number, lng: number, heading?: number) => {
    const map = mapRef.current;
    const marker = courierMarkerRef.current;
    if (!map || !marker) return;
    const target = { lng, lat };
    const start = curPosRef.current || target;
    const duration = 500;
    const t0 = performance.now();
    const step = (t: number) => {
      if (!courierMarkerRef.current) return;
      const k = Math.min(1, (t - t0) / duration);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const clng = start.lng + (target.lng - start.lng) * ease;
      const clat = start.lat + (target.lat - start.lat) * ease;
      courierMarkerRef.current.setLngLat([clng, clat]);
      curPosRef.current = { lng: clng, lat: clat };
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);

    const el = courierMarkerElRef.current;
    if (typeof heading === "number") {
      el?.style.setProperty("transform", `rotate(${heading}deg)`);
    } else if (start.lng !== target.lng || start.lat !== target.lat) {
      const b = bearing(start, target);
      el?.style.setProperty("transform", `rotate(${b}deg)`);
    }

    if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current);
    routeTimerRef.current = window.setTimeout(() => {
      getOsrmRoute([lng, lat], [destLng, destLat])
        .then((route) => {
          const src = courierLineRef.current;
          if (!src || !map) return;
          src.setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.geometry } }],
          });
        })
        .catch(() => {});
    }, 3000);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${assignmentId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("bukti-pengiriman")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("bukti-pengiriman").getPublicUrl(path);
      setPhotoUrl(pub.publicUrl);
    } catch (err: any) {
      alert("Gagal upload foto: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleStatus = async (status: string) => {
    if (status === "completed" && !photoUrl) {
      alert("Upload foto bukti pengiriman terlebih dahulu.");
      return;
    }
    if (!window.confirm(`Konfirmasi: ${STATUS_LABEL[status] || status}?`)) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/kurir/assignments/${assignmentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || undefined, photo_url: photoUrl || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal memperbarui status");
      setNote("");
      await load();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <p className="text-center text-slate-500 py-12">Memuat detail penugasan...</p>;
  }
  if (error || !data) {
    return <p className="text-center text-red-600 py-12">{error || "Data tidak ditemukan."}</p>;
  }

  const order = data.order || {};
  const customer = order.customer;
  const addr = order.address || {};
  const meta = STATUS_META[data.status] || STATUS_META.assigned;
  const next = NEXT_STEPS[data.status] || null;
  const items = order.items || [];

  return (
    <div className="max-w-3xl mx-auto">
      <a href="/kurir" className="text-sm text-blue-600 hover:underline">&larr; Kembali ke daftar</a>

      <div className="flex items-center justify-between gap-2 mt-3 mb-4">
        <h1 className="text-2xl font-bold">{order.order_number}</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${meta.color}`}>{meta.label}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="font-bold mb-2">Informasi Pesanan</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-slate-500">Subtotal</p>
          <p className="text-right">{formatRupiah(order.subtotal_products)}</p>
          <p className="text-slate-500">Ongkir</p>
          <p className="text-right">{formatRupiah(order.shipping_cost)}</p>
          <p className="text-slate-500 font-semibold">Total</p>
          <p className="text-right font-bold">{formatRupiah(order.total_amount)}</p>
          <p className="text-slate-500">Dibuat</p>
          <p className="text-right">{formatWaktu(order.created_at)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="font-bold mb-2">Pelanggan & Alamat</h2>
        <p className="font-medium">{addr.recipient_name || customer?.nama_pelanggan || "-"}</p>
        <p className="text-sm text-slate-600">
          {addr.recipient_phone || customer?.telepon || "-"}
        </p>
        <p className="text-sm text-slate-600 mt-2">{addr.full_address || "-"}</p>
        {(addr.recipient_phone || customer?.telepon) ? (
          <div className="flex items-center gap-2 mt-3">
            <a
              href={`https://wa.me/${normalizeTel(addr.recipient_phone || customer?.telepon)}?text=${encodeURIComponent(`Halo ${addr.recipient_name || customer?.nama_pelanggan || "Bapak/Ibu"}, ini kurir BJS Express untuk pesanan ${order.order_number}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              WhatsApp
            </a>
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="font-bold mb-2">Rute Pengiriman</h2>
        {Number.isFinite(destLat) && Number.isFinite(destLng) ? (
          <>
            <div ref={mapContainer} style={{ height: "340px", borderRadius: "12px" }} />
            <p id="kurir-route-info" className="text-sm text-slate-600 mt-2"></p>
          </>
        ) : (
          <div>
            <div ref={mapContainer} style={{ height: "200px", borderRadius: "12px" }} />
            <p className="text-sm text-slate-500 mt-2">
              Alamat pelanggan belum memiliki koordinat. Gunakan Google Maps / Waze untuk navigasi.
            </p>
          </div>
        )}
        {destLat !== 0 && destLng !== 0 && Number.isFinite(destLat) && Number.isFinite(destLng) && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Buka di Google Maps
          </a>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="font-bold mb-2">
          Daftar Barang
          {items.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold align-middle">
              {items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0)} item
            </span>
          )}
        </h2>
        <ul className="divide-y divide-slate-100">
          {items.map((it: any) => (
            <li key={it.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{it.products?.nama || "Produk"}</p>
                <p className="text-xs text-slate-500">
                  {it.quantity} x {formatRupiah(it.price)}
                </p>
              </div>
              <p className="text-sm font-semibold">{formatRupiah(it.price * it.quantity)}</p>
            </li>
          ))}
        </ul>
      </div>

      {photoUrl ? (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="font-bold mb-2">Foto Bukti</h2>
          <OptimizedImage src={photoUrl} alt="Bukti pengiriman" width={400} className="rounded-lg max-h-64" />
        </div>
      ) : null}

      {data.status !== "completed" && data.status !== "cancelled" ? (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="font-bold mb-3">Live Tracking</h2>
          <div className="flex items-center gap-3">
            {live ? (
              <>
                <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-sm font-semibold px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                  Live aktif
                </span>
                <button
                  type="button"
                  onClick={stopLive}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  Hentikan
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startLive}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                📍 Mulai Live Tracking
              </button>
            )}
          </div>
          {live && (
            <p className="text-xs text-slate-500 mt-2">
              {lastSent ? `Lokasi terakhir dikirim: ${lastSent}` : "Menunggu sinyal lokasi..."}
            </p>
          )}
          {liveError && <p className="text-xs text-red-600 mt-2">{liveError}</p>}
        </div>
      ) : null}

      {data.status !== "completed" && data.status !== "cancelled" ? (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="font-bold mb-3">Update Pengiriman</h2>
          <div className="mb-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {uploading ? "Mengunggah..." : photoUrl ? "Ganti Foto Bukti" : "📷 Upload Foto Bukti"}
            </button>
            {!photoUrl && data.status === "dropping_off" && (
              <p className="text-xs text-orange-600 mt-1">Foto bukti wajib sebelum menandai selesai.</p>
            )}
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className="w-full p-2 border rounded-lg mb-3 text-sm"
          />
          {next && (
            <button
              type="button"
              disabled={updating}
              onClick={() => handleStatus(next.status)}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-bold py-3 rounded-lg"
            >
              {updating ? "Menyimpan..." : next.label}
            </button>
          )}
        </div>
      ) : null}

      {data.events?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold mb-3">Riwayat Status</h2>
          <ol className="relative border-l border-slate-200 ml-3 space-y-4">
            {data.events.map((ev: any, i: number) => (
              <li key={ev.id || i} className="ml-6">
                <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full bg-orange-500 border-4 border-white" />
                <p className="font-medium text-sm">{STATUS_LABEL[ev.status] || ev.status}</p>
                <p className="text-xs text-slate-500">{formatWaktu(ev.created_at)}</p>
                {ev.note ? <p className="text-xs text-slate-600 mt-1">"{ev.note}"</p> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default CourierAssignmentDetail;
