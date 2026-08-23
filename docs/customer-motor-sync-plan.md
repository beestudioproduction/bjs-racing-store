# Rencana: Sinkronisasi "Motor Saya" ke Database (`customer_vehicle_preferences`)

> **Status:** DRAFT — MENUNGGU PERSETUJUAN & EKSEKUSI
> **Tanggal:** 2026-08-23
> **Prasyarat:** Fitur "Motor Saya" berbasis localStorage sudah live (commit `879722a`)
> **Scope:** STORE (`bjs-racing-store`) + 1 tabel baru di Supabase

---

## 1. Latar Belakang

Fitur **Motor Saya** saat ini menyimpan kendaraan terakhir pelanggan di `localStorage`
browser (key `bjstore_motor_saya`). Konsekuensinya preferensi hilang saat ganti
device/browser dan tidak terhubung dengan akun pelanggan.

Upgrade ini memindahkan penyimpanan ke tabel DB `customer_vehicle_preferences`
agar preferensi **lintas-device** untuk pelanggan yang login, dengan localStorage
tetap dipertahankan sebagai lapisan instan & fallback tamu.

## 2. Temuan Investigasi

| Aspek | Fakta |
|---|---|
| Identitas pelanggan | Supabase Auth session di browser; pola existing: `supabase.auth.getSession()` (lihat `AuthMenu.jsx`) |
| Relasi ID | **`customers.id` = `auth.uid()`** — dasar semua policy RLS milik pelanggan |
| Konvensi tabel pelanggan | `wishlists` dkk.: PK uuid default `gen_random_uuid()`, FK `customers(id) ON DELETE CASCADE`, RLS per operasi `auth.uid() = customer_id` |
| Tipe kolom referensi | `vehicle_brands.id` = `bigint`, `vehicle_models.id` = `bigint` (produksi) |
| Eksekusi migrasi | Manual via Management API / SQL Editor (konvensi repo) |

## 3. Desain Tabel Baru

```sql
-- Migration: customer_vehicle_preferences (Motor Saya lintas-device)
CREATE TABLE IF NOT EXISTS public.customer_vehicle_preferences (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_brand_id bigint NOT NULL REFERENCES public.vehicle_brands(id)  ON DELETE CASCADE,
  vehicle_model_id bigint NOT NULL REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_vehicle_preferences_customer_unique UNIQUE (customer_id)
);

ALTER TABLE public.customer_vehicle_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motor_saya_select_own" ON public.customer_vehicle_preferences
  FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "motor_saya_insert_own" ON public.customer_vehicle_preferences
  FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "motor_saya_update_own" ON public.customer_vehicle_preferences
  FOR UPDATE USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "motor_saya_delete_own" ON public.customer_vehicle_preferences
  FOR DELETE USING (auth.uid() = customer_id);

CREATE INDEX IF NOT EXISTS idx_cvp_model
  ON public.customer_vehicle_preferences(vehicle_model_id);
```

**Keputusan desain:**

| # | Keputusan | Alasan |
|---|---|---|
| 1 | `UNIQUE (customer_id)` — satu slot motor aktif | UI tetap sederhana (satu chip); pilih motor lain = timpa. Garasi multi-motor disepakati sebagai fase lanjutan bila dibutuhkan |
| 2 | FK `ON DELETE CASCADE` ke brand/model | Motor dinonaktifkan/dihapus admin → preferensi ikut bersih otomatis |
| 3 | Tanpa kolom snapshot nama | Nama selalu di-join dari master saat render → tak ada data basi |
| 4 | localStorage TIDAK dihapus | Tetap sumber instan + fallback tamu |

## 4. Desain Flow Integrasi (`CatalogFilter.jsx` — satu-satunya file yang diedit)

### 4.1 Saat Halaman Katalog Dibuka

```
Baca localStorage                    → chip tampil INSTAN (tanpa menunggu network)
        +
Cek session: supabase.auth.getSession()
  ├─ LOGIN + row DB ada             → ganti sumber chip ke nilai DB ✅ (lintas-device)
  ├─ LOGIN + DB kosong,
  │  localStorage terisi            → INSERT sekali ke DB (migrasi motor lama),
  │                                   chip tetap pakai nilai lokal
  └─ TAMU                           → localStorage saja (perilaku sekarang)
```

- Query DB: `.from("customer_vehicle_preferences").select("vehicle_brand_id, vehicle_model_id").eq("customer_id", user.id).maybeSingle()`
- Guard tambahan: brand/model dari DB sudah tidak aktif? → abaikan baris (chip tak muncul), biarkan user memilih ulang.

### 4.2 Saat Pelanggan Memilih Kendaraan Baru (brand + model terisi)

1. **Selalu** tulis localStorage (instan, aman tamu) — perilaku existing.
2. Jika login → upsert DB:
   ```js
   supabase.from("customer_vehicle_preferences")
     .upsert(
       { customer_id: user.id, vehicle_brand_id, vehicle_model_id, updated_at: new Date().toISOString() },
       { onConflict: "customer_id" }
     );
   ```
   - Fire-and-forget (`.then` log error saja) — jangan blok/mengganggu UI bila gagal network.
   - Debounce implisit: hanya terpanggil setelah kedua dropdown terisi (bukan tiap keystroke).

### 4.3 Chip "Terapkan"

Perilaku render **tidak berubah** — hanya sumber data `motorSaya` yang kini bisa
berasal dari DB atau localStorage (state tunggal, prioritas DB saat login).

## 5. Ringkasan Perubahan File

| File | Aksi | Isi |
|---|---|---|
| `supabase/migrations/2026_08_23_customer_vehicle_preferences.sql` | **BARU** | DDL tabel + RLS + index (SQL pada §3) |
| `src/components/CatalogFilter.jsx` | EDIT | Session check saat mount; baca/upsert DB; merge rule §4 |

Tidak ada perubahan RPC, POS, halaman lain, atau dependensi.

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Tamu banyak → tabel kecil tapi tumbuh | Hanya pelanggan login yang menulis; 1 baris/pelanggan; cascade bersihkan sendiri |
| Brand/model referensi dinonaktifkan admin | FK CASCADE menghapus baris; guard is_active saat baca |
| Race: user ganti motor cepat saat offline | Upsert fire-and-forget; sinkron final terjadi pada pilihan berikutnya; localStorage selalu benar secara lokal |
| Privacy mode / localStorage diblokir | try/catch existing; fitur diam nonaktif, tidak error |
| Login di device B menimpa motor device A | Memang perilaku single-slot yang disepakati — pilihan terakhir menang |

## 7. Checklist QA Manual

1. **Login → pilih motor → buka HP/browser lain, login akun sama** → chip "Motor saya" muncul dengan motor yang sama.
2. **Pilih motor sebagai tamu → login** → motor lokal termigrasi ke DB (cek tabel).
3. **Ganti motor saat login** → baris DB ter-update (bukan duplikat) — cek `updated_at`.
4. **Logout → pilih motor** → tersimpan lokal saja (tabel tidak bertambah untuk user itu).
5. **Admin nonaktifkan sebuah tipe motor** → chip preferensi terkait tidak muncul salah.
6. **Hapus akun pelanggan** → baris preferensi ikut terhapus (CASCADE).
7. Regresi: fitur filter combobox/chips/URL sync tetap normal; mode tamu identik sebelumnya.

## 8. Urutan Eksekusi (saat disetujui)

1. Buat file migrasi → eksekusi via Management API → verifikasi tabel+policy.
2. Edit `CatalogFilter.jsx` sesuai §4.
3. Build verifikasi store.
4. Commit + push → Vercel deploy otomatis.
5. QA sesuai §7.

---

## 9. Catatan Terbuka (perlu konfirmasi saat eksekusi)

1. ~~Satu slot vs garasi multi-motor~~ → disepakati **satu slot** dulu (§3 keputusan #1).
2. Migrasi lokal→DB saat login disepakati berjalan otomatis sekali (§4.1).
