# Notifikasi Email Pesanan (Dual-Channel WhatsApp + Email)

> Status: **Diimplementasikan** — opsi A "email untuk momen penting saja"
> Prasyarat: env Vercel `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`,
> `RESEND_FROM_EMAIL` sudah terpasang ✅
> Tanggal: 23 Agustus 2026

## 1. Ringkasan

Sebelumnya **seluruh** notifikasi otomatis hanya lewat WhatsApp — jalur
email ada di `notifications.ts` tapi tidak pernah dipanggil. Kini momen-
momen penting pesanan mengirim **ganda**: WhatsApp (cepat, chat-style) +
Email (jejak tertulis formal).

| Momen | WhatsApp | Email |
|---|---|---|
| Pesanan dibuat (`order_created`) | ✅ | ➖ tidak (terlalu dini, belum ada nilai transaksi final) |
| **Pembayaran terkonfirmasi** | ✅ | ✅ **BARU** |
| Update perjalanan pengiriman (diambil, transit, dst.) | ✅ | ➖ sengaja tidak (spam inbox) |
| **Pesanan diterima / tiba di tujuan** | ✅ | ✅ **BARU** |
| **Pesanan selesai** (admin/kurir konfirmasi) | ✅ | ✅ **BARU** |
| Gagal booking Biteship → ke TOKO | ✅ | ➖ |

## 2. Peta Momen, Event & Pemicu (Detail)

### 2.1 Pembayaran Dikonfirmasi — event `payment_confirmed`

| Aspek | Nilai |
|---|---|
| Pemicu | Webhook pembayaran Midtrans `/api/payment/webhook` atau callback BRI QRIS memvalidasi bayaran → `confirmOrderPayment()` |
| Subjek email | `Pembayaran Dikonfirmasi - <nomor_pesanan>` |
| Isi | Salam, nomor pesanan, info "sedang diproses dan akan segera dikirim" |
| File | `src/lib/confirmOrderPayment.ts` |

### 2.2 Pesanan Diterima — event `shipping_delivered`

| Aspek | Nilai |
|---|---|
| Pemicu | Webhook Biteship `/api/shipping/biteship/webhook` melaporkan status `delivered` |
| Catatan | Hanya milestone delivered yang ber-email; status perantara (`picked`, `in_transit`, dll.) tetap WhatsApp-saja |
| Subjek email | `Pesanan <nomor_pesanan> Diterima - BJS Racing Store` |
| Isi | Salam, nomor pesanan, no. resi |
| File | `src/pages/api/shipping/biteship/webhook.ts` |

### 2.3 Pesanan Selesai — event `order_completed`

| Aspek | Nilai |
|---|---|
| Pemicu 1 | Admin menandai pesanan selesai: `/api/admin/orders/[id]/deliver` |
| Pemicu 2 | Kurir menyelesaikan penugasan: `/api/kurir/assignments/[id]/status` |
| Subjek email | `Pesanan <nomor_pesanan> Sampai - BJS Racing Store` |
| Isi | Salam, nomor pesanan, tautan halaman tracking |
| File | `deliver.ts`, `kurir/assignments/[id]/status.ts` |

## 3. Sumber Email Pelanggan

Tabel `public.customers` **tidak memiliki kolom email**. Sumber kebenarannya
adalah email akun auth:

```
customers.auth_user_id ──► auth.users.email
```

Helper baru `getCustomerEmail(authUserId)` di `notifications.ts` memanggil
Admin API Supabase (`auth.admin.getUserById`) dengan service role.
Mengembalikan string kosong bila tidak tersedia — pemanggil melewati
pengiriman email tanpa error.

## 4. Jaminan Keandalan

- Setiap kirim email dibungkus `try/catch` terpisah — **kegagalan email
  tidak pernah memutus alur utama** (pembayaran, webhook, update status)
- Semua kegagalan dicatat di Vercel Function Logs dengan prefiks:
  `[Payment]`, `[Admin]`, `[Kurir]`, `[Biteship]`
- Template email semua berbahasa Indonesia, konsisten dengan versi WhatsApp

## 5. Alur Testing

### Persiapan

1. Pastikan deploy terakhir Vercel berstatus **Ready**
   (commit implementasi ini)
2. Gunakan akun customer test dengan **email aktif yang Anda kuasai**

### Uji A — Pembayaran Dikonfirmasi (paling mudah)

| Langkah | Harapan |
|---|---|
| 1. Buat pesanan via storefront sampai halaman pembayaran (sandbox Midtrans) | — |
| 2. Selesaikan pembayaran sandbox | Webhook masuk |
| 3. Cek inbox customer test | Email *"Pembayaran Dikonfirmasi - ORD-..."* masuk ≤1 menit |
| 4. Cek juga WhatsApp | Kedua kanal terkirim; email TIDAK menggantikan WA |
| 5. Resend Dashboard → Logs | Kiriman tercatat *Delivered*, tanpa bounce |

Alternatif tanpa bayar: jika ada alur admin "konfirmasi manual" pembayaran
transfer, gunakan itu untuk memicu event yang sama.

### Uji B — Pesanan Selesai (oleh Admin)

| Langkah | Harapan |
|---|---|
| 1. Login admin → pilih pesanan yang sudah dikirim | — |
| 2. Klik aksi tandai selesai/deliver | — |
| 3. Inbox customer | Email *"Pesanan ... Sampai"* + tautan tracking ≤1 menit |

Uji B2 (jalur kurir): selesaikan penugasan dari aplikasi kurir → hasil sama.

### Uji C — Pesanan Diterima (webhook Biteship)

Sulit disimulasikan lokal karena butuh webhook asli Biteship. Dua cara:

1. **Nyata**: tunggu paket sungguhan tiba (webhook `delivered`)
2. **Cepat (dev)**: kirim POST simulasi ke endpoint webhook dengan payload
   status `delivered` + signature valid (lihat `verifyBiteshipWebhook`),
   lalu cek inbox

### Matriks Negatif

- [ ] Customer tanpa email auth (akun lama aneh) → proses lanjut mulus,
      hanya WA terkirim, tidak ada error 500
- [ ] API key Resend salah/dihapus → log `[Payment] Gagal kirim email...`
      muncul, status pesanan & WA tetap normal
- [ ] Status perantara Biteship (`in_transit` dsb.) → WA terkirim,
      **tanpa** email

## 6. Rollback

Fitur murni additive. Untuk mematikan email tanpa deploy ulang: hapus/
kosongkan env `EMAIL_PROVIDER` di Vercel → `sendEmail()` otomatis gagal
dengan pesan "provider tidak dikonfigurasi" dan tertelan `catch`.
