# Rencana Upgrade Filter Katalog — Searchable Combobox & UX Profesional

> **Status:** MENUNGGU PERSETUJUAN
> **Tanggal:** 2026-08-23
> **Scope:** Frontend STORE (`bjs-racing-store`) — tanpa perubahan database
> **Halaman terdampak:** `/onderdil`, `/pilok` (via `ProductCatalog`), `/katalog-warna`

---

## 1. Latar Belakang

Filter katalog saat ini memakai `<select>` HTML native. Dengan skala data aktual:

| Dropdown | Jumlah opsi | Masalah |
|---|---|---|
| Kategori (`/onderdil`) | **314** opsi aktif | Scroll sangat panjang |
| Merek Produk | **218** opsi | Scroll panjang |
| Tipe Motor | **159** tipe aktif | Scroll panjang |
| Total produk `/onderdil` | **2.199** produk | Hasil filter tak terhitung |

Masalah UX tambahan yang ditemukan:

1. Tidak ada indikator jumlah hasil ("N produk ditemukan"); hasil kosong hanya grid hening tanpa pesan.
2. Tombol Reset bersifat all-or-nothing — tidak bisa menghapus satu filter saja.
3. Pilihan filter tidak tersimpan di URL → tidak bisa dibagikan/bookmark.
4. Loading hanya teks "Memuat produk..." tanpa skeleton.
5. Pelanggan toko sparepart motor berbelanja berulang untuk motor yang sama, tapi harus memilih ulang tiap kunjungan.

## 2. Tujuan

- Dropdown dapat dicari (type-to-search) sehingga memilih dari ratusan opsi jadi cepat.
- UX filter setara marketplace profesional: chip filter aktif, counter hasil, empty state, skeleton loading.
- Link hasil filter dapat dibagikan (URL sync).
- Kendaraan terakhir pelanggan diingat ("Motor Saya") untuk pilihan ulang satu-klik.
- Konsistensi komponen di seluruh halaman katalog (`/onderdil`, `/pilok`, `/katalog-warna`).

### Non-Tujuan (Out of Scope)

- Tidak mengubah RPC/database (`search_onderdil_products` dsb. sudah benar).
- Tidak menambah dependensi baru (keputusan: custom combobox).
- Tidak menyentuh `ProductFilter.jsx` (legacy, tidak dipakai — kandidat hapus terpisah).

---

## 3. Keputusan Desain

| # | Keputusan | Alasan |
|---|---|---|
| 1 | **Custom `SearchableCombobox`, bukan library** | Nol dependensi baru; bundle PWA tetap ringan; kontrol penuh styling sesuai tema slate/orange; pola existing codebase memang hand-rolled |
| 2 | URL sync pakai `history.replaceState`, bukan `pushState` | Tidak membanjiri riwayat back-button saat user berganti-ganti filter cepat; back-button tetap keluar halaman secara wajar |
| 3 | Nilai sentinel `"semua"` dipertahankan | Konvensi existing di semua state filter; menghindari refactor besar |
| 4 | URL param divalidasi lunak | Param tidak dikenal/tidak valid diabaikan → fallback "semua"; tidak pernah error |
| 5 | "Motor Saya" via `localStorage` + try/catch | Private-mode/iPhone lockdown aman (silent fail); data kecil `{brandId, brandName, modelId, modelName, savedAt}` |
| 6 | Skeleton = grid kartu pulse statis | Tanpa dependensi skeleton; cukup Tailwind `animate-pulse` |

## 4. Fase 1 — Inti

### 4.1 Komponen Baru: `src/components/SearchableCombobox.jsx`

Komponen generik reusable, API:

```jsx
<SearchableCombobox
  id="tipe_motor"                       // untuk a11y/label htmlFor
  options={[{ value: "140", label: "Karisma 125 X / D" }, ...]}
  value={filters.tipe_motor}            // string; "semua" = belum dipilih
  onChange={(val) => handleSet("tipe_motor", val)}
  placeholder="Semua Tipe Motor"        // teks trigger saat "semua"
  searchPlaceholder="Cari tipe motor..."
  emptyMessage="Tipe motor tidak ditemukan"
  onClear={() => handleSet("tipe_motor", "semua")}  // jika ada → tampil tombol ×
/>
```

Perilaku:

| Aspek | Spesifikasi |
|---|---|
| Trigger tertutup | Tampilan identik `<select>` lama: `w-full p-2 border rounded-lg bg-white text-sm`; ada ikon chevron `FiChevronDown` kanan; tombol × (clear) menggantikan chevron saat bernilai |
| Panel terbuka | Absolute di bawah trigger, lebar 100% trigger, `max-h-64 overflow-y-auto`, `z-30`, shadow-lg, border; input cari di atas panel dengan auto-focus |
| Pencarian | Filter client-side case-insensitive contains pada label; langsung responsif (tanpa debounce — data lokal) |
| Keyboard | `↑/↓` navigasi highlight · `Enter` pilih (atau buka panel jika tertutup) · `Esc` tutup · `Tab` tutup · `Home/End` lompat |
| Mouse/sentuh | Klik-luar menutup (`mousedown` listener + ref); baris opsi `py-2.5 px-3` (target sentuh ≥40px) |
| Opsi terpilih | Background `orange-50` + ikon centang `FiCheck` orange |
| Empty hasil | Baris teks abu-abu `emptyMessage` |
| A11y dasar | `role="combobox"` `aria-expanded` `aria-controls` pada trigger; panel `role="listbox"`, opsi `role="option"` `aria-selected` |

### 4.2 Integrasi ke `CatalogFilter.jsx`

Ganti **semua** `<select>` dengan `SearchableCombobox`:

- `kategori` (314 opsi), `merek` (218), `merek_motor` (brand id), `tipe_motor` (model id, difilter cascade oleh `merek_motor` via `options.vehicle_models`), serta `lini_produk` / `color_variant` / `ukuran` bila config mengaktifkannya (halaman /pilok).
- Logika cascade existing (`handleInputChange`: ganti parent → reset anak ke `"semua"`) **tidak diubah**, hanya dibungkus adapter `(value) => handleInputChange({ target: { name, value } })`.
- Opsi dropdown kendaraan tetap dari `options.vehicle_brands` / `options.vehicle_models` (data master yang sudah di-fetch).

### 4.3 Bar Chip Filter Aktif (di `CatalogFilter.jsx`)

- Derivasi otomatis dari state `filters`; chip hanya muncul untuk nilai ≠ `"semua"` / ≠ `""`.
- Contoh: `[Kategori: Aki ×] [Merek: Federal ×] [🏍️ HONDA ×] [Karisma 125 X/D ×]`
- Klik `×` pada chip = reset field itu **termasuk reset anak-cascade** (pakai logika yang sama dengan `handleInputChange`).
- Bar disembunyikan bila tidak ada filter aktif. Label ringkas: label field + nilai (nilai kendaraan pakai nama brand/model, bukan id).

### 4.4 Counter Hasil & Empty State (di `ProductCatalog.jsx`)

- Di atas grid: **"{n} produk ditemukan"** (`n = allProducts.length`, akurat karena RPC return seluruh hasil).
- Saat `!loading && allProducts.length === 0`: blok ramah — ikon `FiSearchX`, teks *"Tidak ada produk yang cocok dengan filter ini."*, tombol **"Hapus semua filter"** → `resetFilters()`.

## 5. Fase 2 — Nilai Tambahan

### 5.A Sync Filter ke URL

Berlaku otomatis untuk semua halaman host `ProductCatalog` (`/onderdil`, `/pilok`):

| Item | Spesifikasi |
|---|---|
| Mapping param | `q` (searchTerm), `sort`, `price`, `kategori`, `merek`, `lini`, `varian`, `ukuran`, `merek_motor`, `tipe_motor` |
| Baca awal | `useState` initializer membaca `URLSearchParams(window.location.search)`; guard `typeof window !== "undefined"` (aman Astro SSR/hydrate) |
| Tulis perubahan | `useEffect` pada `filters`: serialisasi hanya nilai non-default; `history.replaceState(null, "", path?query)` — tanpa reload, tanpa entry history baru |
| Validasi lunak | Key tak dikenal dibuang; `merek_motor`/`tipe_motor` harus integer positif; nilai kosong/"semua" tidak ditulis |
| Efek samping nol | Tidak ada fetch tambahan — URL hanya cermin state; hydration `client:only="react"` aman |

Contoh hasil: `/onderdil?merek_motor=6&tipe_motor=140&q=cdi` → bisa dibagikan via WhatsApp.

### 5.B 🏍️ "Motor Saya" (Garage)

| Item | Spesifikasi |
|---|---|
| Storage | `localStorage["bjstore_motor_saya"]` = `{brandId, brandName, modelId, modelName, savedAt}`; akses dibungkus try/catch |
| Simpan | Setiap kali `merek_motor` DAN `tipe_motor` sama-sama terisi (non-"semua") → simpan silent (tanpa toast) |
| Tampilkan | Bila ada data tersimpan **dan** pilihan kendaraan saat ini berbeda → chip ajakan di atas baris dropdown: `🏍️ Motor saya: Karisma 125 X/D — HONDA [Terapkan] [×]` |
| Terapkan | Satu klik set `merek_motor` + `tipe_motor` sekaligus (satu setState) |
| Dismiss | `×` menyembunyikan chip untuk sesi browser itu saja (state lokal, tidak menghapus storage) |

### 5.C Skeleton Loading

- Di `ProductCatalog.jsx`: saat `loading`, render grid 8 kartu placeholder (`animate-pulse`: kotak gambar 1:1, 2 garis teks, bar harga) meniru bentuk `ProductCard` — menggantikan teks "Memuat produk...".

### 5.D Terapkan Combobox di `/katalog-warna`

- Edit `ColorCatalogFilter.jsx`: ganti 3 `<select>` (Merek, Lini Produk, Varian Warna) dengan `SearchableCombobox` yang sama.
- Cascade & reset anak tetap dari `handleInputChange` existing.
- URL sync **tidak** ditambahkan di sini (state milik `ColorCatalog.jsx`, scope D hanya konsistensi combobox).

---

## 6. Ringkasan Perubahan File

| File | Aksi | Isi Perubahan |
|---|---|---|
| `src/components/SearchableCombobox.jsx` | **BARU** (~200 baris) | Komponen combobox searchable + keyboard nav + a11y |
| `src/components/CatalogFilter.jsx` | EDIT | Ganti 7 `<select>` → combobox; tambah chips bar; tambah chip Motor Saya |
| `src/components/ProductCatalog.jsx` | EDIT | URL sync (init + write); counter hasil; empty state; skeleton grid |
| `src/components/ColorCatalogFilter.jsx` | EDIT | Ganti 3 `<select>` → combobox (reuse) |

Tidak ada file lain; tidak ada perubahan DB/env/dependensi.

## 7. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Panel combobox terpotong container overflow | Trigger wrapper `relative`; panel absolute z-30; area filter adalah blok normal (bukan overflow-hidden) — diverifikasi visual |
| React 19 compat | Hanya hooks standar (`useState/useRef/useEffect/useMemo`) — aman |
| User localStorage diblokir | try/catch semua akses; fitur Motor Saya diam-diam nonaktif |
| URL param usang (produk/kategori dinonaktifkan) | RPC memfilter sendiri → hasil kosong + empty state baru menjelaskan |
| Regresi cascade/reset perilaku lama | Logika `handleInputChange`/`resetFilters` tidak disentuh; combobox hanya pengganti shell input |

## 8. Checklist QA Manual (setelah deploy)

1. `/onderdil` — ketik "kar" di Tipe Motor → muncul Karisma dkk.; pilih via keyboard Enter.
2. Cascade: ganti Merek Motor → Tipe Motor otomatis "Semua"; opsi tipe hanya merek tsb.
3. Chips: aktifkan 3 filter → chip masing-masing bisa dihapus satuan; "Reset" menghapus semua.
4. Counter: "1 produk ditemukan" saat filter Karisma + CDI0001; kombinasi tak ada → empty state + tombol hapus filter berfungsi.
5. URL: salin address bar berfilter → buka di tab incognito → filter terpasang; param sampah (`?tipe_motor=abc`) diabaikan tanpa error.
6. Motor Saya: set kendaraan → refresh → chip "Motor saya" muncul; ubah kendaraan → chip hilang; klik Terapkan → dua filter terpasang.
7. Mobile (viewport 375px): dropdown & panel nyaman disentuh; keyboard HP memfilter realtime.
8. `/pilok` & `/katalog-warna`: combobox bekerja; cascade lini→varian utuh; halaman lain tidak terdampak.

## 9. Urutan Eksekusi

1. Buat `SearchableCombobox.jsx` → verifikasi build store (`npm run build`).
2. Integrasi `CatalogFilter.jsx` (combobox + chips + Motor Saya).
3. Update `ProductCatalog.jsx` (URL sync + counter + empty state + skeleton).
4. Update `ColorCatalogFilter.jsx` (reuse combobox).
5. Build verifikasi + commit + push (Vercel deploy otomatis).
