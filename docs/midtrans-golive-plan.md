# Rencana: Hardening Integrasi Midtrans & Kelengkapan Website (Go-Live Prep)

> **Status:** EKSEKUSI
> **Tanggal:** 2026-08-23
> **Konteks:** Verifikasi merchant Midtrans sedang direview (hari ke-10).
> Mode Sandbox berjalan; domain produksi: **https://bjsracing.com**

## 1. Latar Belakang

Audit integrasi Midtrans Snap di STORE dibandingkan dengan dokumentasi resmi
(docs.midtrans.com). Integrasi inti sudah benar — backend token creation,
webhook signature SHA512, idempoten, item_details/customer_details lengkap,
enabled_payments valid. Ditemukan 3 gap teknis dan beberapa gap non-teknis
yang berisiko membuat review verifikasi ditolak/revisi.

## 2. Hasil Audit

### 2.1 Sudah Sesuai ✅

| Aspek | Lokasi |
|---|---|
| Basic Auth Base64(serverKey:) dari backend | create-transaction.ts |
| order_id unik `BJS-YYYYMMDD-{uuid8}` | create-transaction.ts:23 |
| gross_amount = Σ(item_details) | create-transaction.ts:466 |
| Harga override dari DB (anti-manipulasi) | create-transaction.ts:122 |
| item_details: produk + ongkir + fee + diskon negatif | :432-462 |
| customer_details lengkap + alamat IDN | :483-495 |
| Webhook verifikasi signature_key | webhook.ts:21-30 |
| Webhook idempotent (RPC guard + UNIQUE invoice) | confirmOrderPayment.ts |
| Handle settlement/challenge/cancel/expire/deny | webhook.ts:32-125 |
| JS callbacks onSuccess/onPending/onError/onClose | CheckoutView.tsx:759 |
| enabled_payments mapping benar (other_qris/other_va/dll) | paymentFee.ts:62 |

### 2.2 Gap Teknis 🔴 (Fase 1)

1. snap.js dimuat **TANPA atribut `data-client-key`** (wajib per docs)
   → CheckoutView.tsx:134-139
2. URL sandbox hardcoded di backend (:503) & frontend (:9) → rawan salah saat go-live
3. callbacks.finish/unfinish/error tidak dikirim di payload token (handal MAP saja)

### 2.3 Gap Non-Teknis ⚠️ (Fase 2)

- Tidak ada halaman Syarat & Ketentuan / Kebijakan Privasi / Pengembalian
  → penyebab revisi paling umum oleh tim review merchant Indonesia
- eruda debug console termuat di production (MainLayout.astro ~L233)
- Halaman /simulator perlu dicek; disembunyikan bila artefak testing

### 2.4 Konfigurasi MAP Sandbox (sudah dilakukan user) ✅

- Notification URL: `https://bjsracing.com/api/payment/webhook` ✓ cocok endpoint
- Finish: `/akun/pesanan` ; Unfinish/Error: `/checkout` ✓ aman (cart belum terhapus)
- Catatan: setting Production MAP **terpisah** — ulangi saat akun approved.

## 3. Perubahan File

| File | Aksi | Isi |
|---|---|---|
| src/lib/midtrans.ts | BARU | Helper env-driven: API base & snap.js URL dari `PUBLIC_MIDTRANS_IS_PRODUCTION` |
| src/pages/api/payment/create-transaction.ts | EDIT | Pakai helper URL; tambah callbacks{finish,unfinish,error} → /akun/pesanan/{order_id} |
| src/components/CheckoutView.tsx | EDIT | URL snap.js dari helper; tambah `data-client-key` pada script tag |
| .env.example | EDIT | Tambah `PUBLIC_MIDTRANS_IS_PRODUCTION=false` |
| src/pages/syarat-ketentuan.astro | BARU | Konten legal ID |
| src/pages/kebijakan-privasi.astro | BARU | Konten legal ID |
| src/pages/kebijakan-pengembalian.astro | BARU | Konten legal ID |
| src/components/Footer.astro | EDIT | Link 3 halaman legal |
| src/layouts/MainLayout.astro | EDIT | eruda hanya saat dev (`import.meta.env.DEV`) |
| src/pages/simulator.astro | INSPEKSI→EDIT | Gate admin / sembunyikan bila artefak testing |
| sitemap.xml.ts | CEK | Sertakan halaman baru bila relevan |

Tanpa perubahan DB / RPC / flow bisnis lain.

## 4. Detail Teknis Kunci

- Env switch: `PUBLIC_MIDTRANS_IS_PRODUCTION=true/false` (default `false` = sandbox)
- `data-client-key` = `PUBLIC_MIDTRANS_CLIENT_KEY` (sudah ada di env)
- Callbacks payload Snap: `{finish_url, unfinish_url, error_url}` absolut ke domain
- Popup mode + JS callbacks tetap prioritas; dashboard URLs sebagai fallback Redirect mode

## 5. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Popup gagal bila client key salah | Error handling existing sudah toast + guard snapLoaded |
| Konten halaman legal generik | Disesuaikan bisnis (spray paint & onderdil); owner review final sebelum push |
| eruda hilang di production | Debug tetap via dev mode lokal |

## 6. Urutan Eksekusi

1. Tulis dokumen ini
2. Fase 1: midtrans.ts + edit create-transaction.ts, CheckoutView.tsx, .env.example
3. Fase 2: 3 halaman legal + Footer + MainLayout eruda + inspeksi simulator + sitemap
4. npm run build → commit → push (Vercel deploy otomatis)

## 7. Checklist Pasca-Deploy (manual user)

1. Test transaksi sandbox end-to-end dari https://bjsracing.com
2. Pastikan webhook masuk (log Vercel / status order berubah settlement)
3. Follow-up verifikasi ke support@midtrans.com bila >14 hari kerja
   (lampirkan Merchant ID)
4. Setelah APPROVED:
   - Isi Production Server/Client Key di Vercel env
   - Set `PUBLIC_MIDTRANS_IS_PRODUCTION=true`
   - Ulangi Notification + Finish/Unfinish/Error URLs di tab **Production** MAP
