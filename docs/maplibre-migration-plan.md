# PLAN: Migrasi Leaflet → MapLibre GL JS + Live Tracking Kurir BJS Express

> Dokumen rencana implementasi penggantian seluruh komponen peta Leaflet menjadi **MapLibre GL JS**
> di aplikasi STORE (`bjs-racing-store`) dan penambahan fitur peta di aplikasi POS (`bjs-racing-pos`).
> Target tampilan: **live tracking mengikuti jalan gaya GoSend / Gojek** untuk kurir internal **BJS Express**.

---

## 1. Penjelasan (Ringkasan)

Saat ini aplikasi STORE memakai **Leaflet** (vanilla, lazy-load) di 6 komponen peta, dengan:
- Basemap raster **OSM** (`tiles.openstreetmap.org`).
- Routing **OSRM publik** (`router.project-osrm.org`) + fallback garis lurus.
- Live tracking kurir via **Supabase Realtime** (`courier_locations`).

Aplikasi **POS** sama sekali **belum memiliki library peta** (hanya input lat/lng teks dan proxy area Biteship).

Rencana ini:
1. **Migrasi penuh** seluruh komponen peta STORE dari Leaflet → **MapLibre GL JS**.
2. Ganti basemap raster OSM → **Protomaps PMTiles** (vector, gratis, komersial-safe, optimal untuk MapLibre).
3. Tambahkan fitur **live tracking smooth (gosend-like)**.
4. Tambahkan peta baru di **POS**: peta semua kurir + peta rute per penugasan.

---

## 2. Tujuan

- **Meningkatkan visual & UX peta**: vector, zoom halus, rotasi peta mengikuti heading kurir.
- **Live tracking gaya GoSend**: marker kurir bergerak halus (interpolasi `requestAnimationFrame`), rotasi mengikuti arah, circle akurasi GPS, chip kecepatan.
- **Mapping mengikuti jalan** (bukan garis lurus) via OSRM yang andal dengan debounce + fallback.
- **Standarisasi** satu API peta (MapLibre) di STORE & POS sehingga mudah dipelihara.
- **Hemat kuota Vercel Hobby**: rendering peta 100% di browser, gunakan Supabase Realtime & debounce routing.

---

## 3. Keputusan Arsitektur (hasil diskusi)

| Aspek | Keputusan |
|---|---|
| Library peta | **MapLibre GL JS** (menggantikan Leaflet di semua fitur) |
| Basemap | **Protomaps PMTiles** (vector, gratis, komersial-safe, tanpa API key) |
| Routing / ETA | **OSRM publik** + debounce + fallback lurus (dulu); **self-host OSRM/Valhalla** di roadmap berikutnya |
| Live position | **Supabase Realtime** `courier_locations` (bukan polling REST) |
| Loading | Lazy `import("maplibre-gl")` + CSS (mengikuti pola Leaflet yang ada di STORE) |
| Scope | **Fase A**: STORE migrasi penuh. **Fase B**: POS tambah peta. |

### Catatan biaya/infrastruktur (untuk roadmap)
- **OSRM publik** gratis tetapi tanpa SLA; kadang gagal/rate-limit → fallback garis lurus.
- **Self-host** OSRM/Valhalla TIDAK bisa di Vercel Hobby (serverless, stateless); butuh VPS pembayar (Hetzner ~€5/bln) atau free plan terbatas (Railway $1/bln & 0.5GB RAM — hanya cukup extract regional kecil).
- **Protomaps PMTiles**: gratis, satu file tile, bisa disajikan dari CDN/storage sendiri, komersial-boleh.

---

## 4. Roadmap

### Fase A — STORE (migrasi penuh Leaflet → MapLibre) ✅ SELESAI
1. ✅ Pasang `maplibre-gl`; buat helper basemap bersama (`src/lib/mapBasemap.ts` + CSS import).
2. ✅ Migrasi 6 komponen:
   - `MapPicker.tsx` — marker drag + GPS + circle akurasi + reverse-geocode.
   - `StoreLocationMap.tsx` — peta lokasi toko.
   - `DeliveryCoverageMap.tsx` — poligon/radius zona 8 km.
   - `OrderTrackingMap.tsx` — rute toko → tujuan mengikuti jalan.
   - `TrackingView.tsx` — live tracking smooth gosend-like.
   - `CourierAssignmentDetail.tsx` — live tracking kurir + rotasi heading + rute.
3. ✅ Hapus dependensi Leaflet (`leaflet`, `@types/leaflet`).
4. ✅ Verifikasi build: `npx astro check` (2 error `FeedCard` = **pre-existing**, di luar scope migrasi peta) & `npm run build` sukses.

### Fase B — POS (`bjs-racing-pos`) ✅ SELESAI
1. ✅ Pasang `maplibre-gl` + buat helper basemap bersama `src/lib/mapBasemap.js` (termasuk OSRM routing & util GeoJSON).
2. ✅ `LiveCouriersMap.jsx` — halaman peta semua kurir aktif (marker kurir + tujuan, rute, Realtime `courier_locations`, popup detail).
3. ✅ `AssignmentRouteMap.jsx` — peta rute per penugasan (kurir → tujuan) + posisi live + rotasi heading.
4. ✅ Ganti input lat/lng teks → `AreaMapPicker.jsx` (marker drag) di modal `BjsExpressAreas.jsx`.
5. ✅ `vercel.json`: hapus `geolocation=()`; tambah CSP `connect-src` untuk tiles/glyphs/OSRM + `img/font/style-src`.
6. ✅ Integrasi: rute `/bjs-express/peta-live` di `App.jsx` + link Navbar; tombol "Peta Rute" per penugasan di `BjsExpressModule.jsx`; API baru `api/bjs-express/live.js`.
7. ✅ Verifikasi build POS: `npm run build` sukses (maplibre-gl kode-split ke chunk terpisah ~996KB).

### Fase C — Roadmap berikutnya (menyusul)
- Self-host **OSRM** (atau **Valhalla**) dengan extract Indonesia / regional (Geofabrik) di VPS kecil → rute mengikuti jalan andal tanpa rate-limit.
- Opsional: isochrone, clustering lanjutan, ETA multi-kurir, optimasi rute.

---

## 5. Detail Teknis

### Basemap Protomaps PMTiles
- PID / URL tile: `https://tiles.openfreemap.org/styles/positron` (gratis, tanpa API key, vector stylesheet MapLibre).
- Contoh style JSON (MapLibre style spec) disuntikkan ke `new maplibregl.Map({ style })`.
- Attribution wajib: `© OpenFreeMap | © OpenStreetMap`.

### Routing OSRM (tetap, dengan debounce)
- Base: `https://router.project-osrm.org/route/v1/driving` (tetap dipakai di `src/lib/osrm.ts`).
- **Debounce**: panggil ulang ETA/rute tiap ~15–30 detik per kurir, bukan tiap update posisi.
- Fallback garis lurus tetap ada (`fallback: true`) bila OSRM gagal.

### Live tracking smooth (gosend-like)
- Source GeoJSON dari Realtime `courier_locations`.
- Interpolasi antar-koordinat dengan `requestAnimationFrame` + easing.
- Rotasi marker mengikuti `heading` (field yang sudah ada di tabel).
- Circle akurasi dari `accuracy`.
- Chip kecepatan dari `speed`.

---

## 6. Testing

### Verifikasi build/type
STORE:
```bash
npx astro check     # TS diagnostics
npm run build       # astro build
```

### Uji manual (STORE)
1. **MapPicker** (`/akun/alamat` → tambah alamat): pilih lokasi di peta, GPS, reverse-geocode isi kota/kodepos.
2. **StoreLocationMap** (`/lokasi-toko`): marker toko tampil, popup.
3. **DeliveryCoverageMap** (`/jangkauan-pengiriman`): zona 8km tampil.
4. **OrderTrackingMap** (detail pesanan dengan koordinat): rute mengikuti jalan (bukan lurus).
5. **TrackingView** (`/tracking/[orderNumber]` untuk order BJS Express):
   - Marke kurir bergerak halus saat posisi baru masuk (Realtime).
   - Rotasi sesuai arah, circle akurasi, ETA update dengan debounce.
   - Fallback lurus bila OSRM down (tidak crash).
6. **CourierAssignmentDetail** (`/kurir/[assignmentId]`): live tracking + rotasi heading + rute per penugasan.

### Uji manual (POS — Fase B)
1. Peta semua kurir: kurir aktif tampil, klik marker → popup info.
2. Rute per penugasan: rute kurir → tujuan + posisi live.
3. Map picker area di `BjsExpressAreas`: pilih area peta, isi koordinat otomatis.
4. Geolocation aktif (setelah buka blokir `geolocation=()` di `vercel.json`).

---

## 7. Catatan / Informasi Tambahan

- **Bundle size**: MapLibre (~230KB) lebih besar dari Leaflet (~42KB) → hanya menambah download di browser klien, **tidak** menambah CPU Vercel.
- **Vercel Hobby (4 jam Active Fluid CPU)**: rendering peta 100% di browser; yang memakan kuota adalah invocations serverless & build minutes. Hindari proxy OSRM lewat `/api/*`; panggil OSRM dari browser. Gunakan **Supabase Realtime** bukan polling.
- **TOS OSM**: `tiles.openstreetmap.org` tidak cocok untuk beban produksi → diganti Protomaps.
- **Gunakan alias** `@/` untuk import di STORE.
- **Tidak ada komentar** tambahan di kode kecuali diperlukan.
