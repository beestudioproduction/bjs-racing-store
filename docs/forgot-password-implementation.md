# Implementasi Fitur Lupa Password (Forgot Password)

> Status: **Selesai (kode) + menunggu konfigurasi manual Supabase**
> Commit kode: `44c1354` — `feat: proper forgot-password flow with dedicated reset page`
> Tanggal: 23 Agustus 2026

---

## 1. Latar Belakang

Audit alur autentikasi menemukan bahwa fitur lupa password untuk customer
yang login dengan **email + password** (bukan Google) belum berfungsi optimal:

| Komponen | Sebelum | Sesudah |
|---|---|---|
| Link "Lupa Kata Sandi?" di form login | ✅ Ada (bawaan AuthUI) | ✅ Diganti form kustom |
| Pengiriman email reset | ⚠️ SMTP bawaan Supabase, limit ±2–4 email/jam | 🔧 Menunggu custom SMTP (panduan §4) |
| Halaman landing setelah klik link email | ❌ Tidak ada — pelanggan dilempar ke beranda tanpa diminta sandi baru | ✅ `/reset-password` |
| Kontrol redirect link email | ❌ Tidak dikontrol (tanpa `redirectTo`) | ✅ Eksplisit ke `/reset-password` |

### Akar Masalah Utama

1. `@supabase/auth-ui-react` memanggil `resetPasswordForEmail()` **tanpa**
   parameter `redirectTo`, sehingga link di email mendarat ke *Site URL*
   (beranda) dalam kondisi "sudah login" tanpa instruksi apa pun.
2. Tidak ada satu pun handler event `PASSWORD_RECOVERY` di seluruh codebase.
3. Halaman reset tidak boleh diletakkan di `/akun/*` karena middleware
   melindungi seluruh path tersebut — saat link email dibuka, sesi belum
   terbentuk di sisi server sehingga middleware akan melempar pengguna ke
   halaman login sebelum JavaScript sempat menukar token.

---

## 2. Implementasi Kode

### File Baru

#### `src/pages/reset-password.astro`
Halaman landing tautan reset. Sengaja ditempatkan di **root** (bukan
`/akun/`) agar tidak terkena proteksi middleware. Prerender statis,
komponen React di-mount dengan `client:only="react"`.

#### `src/components/ResetPasswordView.jsx`
Komponen utama halaman reset dengan tiga kondisi tampilan:

```
Klik link email
      │
      ▼
Supabase menukar token URL → sesi
      │
      ▼
Event onAuthStateChange: "PASSWORD_RECOVERY"
      │
      ├── Event diterima ──► Form "Atur Kata Sandi Baru"
      │                        • Kata sandi baru + konfirmasi
      │                        • Toggle lihat/sembunyikan (FiEye/FiEyeOff)
      │                        • Validasi min. 6 karakter & kecocokan
      │                        • Submit → supabase.auth.updateUser()
      │                        • Toast sukses → redirect /akun (login)
      │
      └── Tidak ada event ≤3 detik ──► "Tautan Tidak Valid"
                                        (kedaluwarsa / sudah dipakai)
                                        + tombol kembali ke /login
```

### File Diubah

#### `src/components/AuthForm.jsx`

1. **Link bawaan AuthUI dinonaktifkan** — `forgotten_password.link_text`
   diisi karakter zero-width (`"\u200b"`) sehingga tidak terlihat.
   Alasan: AuthUI tidak mendukung penyertaan `redirectTo` kustom.
2. **Form mini "Lupa Kata Sandi?" ditambahkan** di bawah `<Auth>`:
   - Tombol toggle membuka form input email.
   - Submit memanggil:
     ```js
     supabase.auth.resetPasswordForEmail(email.trim(), {
       redirectTo: `${window.location.origin}/reset-password`,
     });
     ```
   - Sukses → pesan hijau *"Instruksi reset telah dikirim ke \<email\>.
     Silakan periksa kotak masuk (dan folder spam)."*
   - Gagal → pesan merah berisi `error.message`.

### Konfigurasi Supabase yang Sudah Dilakukan

**Authentication → URL Configuration**

| Setting | Nilai |
|---|---|
| Site URL | `https://bjsracing.com` |
| Redirect URLs | `https://bjsracing.com/**` |
| Redirect URLs | `http://localhost:4321/**` (testing lokal) |

> Catatan: domain mentah Vercel (`bjs-racing-store.vercel.app/**`) dan POS
> dihapus dari allowlist. Jika suatu saat perlu uji auth di URL preview
> Vercel, tambahkan sementara kembali.

---

## 3. Cara Kerja Alur Lengkap

```
1. Customer klik "Lupa Kata Sandi?" di /login
2. Isi email → resetPasswordForEmail(email, { redirectTo: .../reset-password })
3. Supabase kirim email (via SMTP yang dikonfigurasi) berisi {{ .ConfirmationURL }}
4. Customer klik tombol/link di email
5. Browser buka /reset-password?code=...
6. supabase-js menukar code menjadi sesi (PKCE) → event PASSWORD_RECOVERY
7. Form sandi baru tampil → submit → updateUser({ password })
8. Toast sukses → redirect ke /akun (sudah ter-login)
9. (Opsional) customer logout → login dengan sandi baru
```

---

## 4. Panduan Manual: Custom SMTP via Resend

SMTP bawaan Supabase dibatasi ±2–4 email/jam dan rawan masuk spam.
Wajib diganti untuk produksi. Disarankan **Resend** (gratis 3.000
email/bulan).

### A.1 — Setup Resend

1. Daftar/login di [https://resend.com](https://resend.com)
2. Menu **API Keys** → **Create API Key** → salin (format `re_...`)
   dan simpan aman.
3. Menu **Domains** → **Add Domain** → isi `bjsracing.com`
4. Pasang catatan DNS yang diberikan Resend (SPF + DKIM) pada pengelola
   domain Anda.
5. Tunggu hingga status domain menjadi **Verified** ← *wajib, tanpa ini
   email akan gagal kirim.*

### A.2 — Aktifkan Custom SMTP di Supabase

Dashboard Supabase → **Authentication** → **SMTP Settings** → toggle
**Enable Custom SMTP**:

| Kolom | Nilai |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | API key Resend (`re_...`) |
| Sender email | `no-reply@bjsracing.com` |
| Minimum interval | `60` |

Klik **Save changes**.

### A.3 — Ganti Template Email ke Bahasa Indonesia

Dashboard → **Authentication** → **Emails** → **Templates** → pilih
**Reset Password**:

- **Subject:**
  ```
  Reset Kata Sandi Akun BJS Racing Store
  ```
- **Body (ganti seluruhnya):**
  ```html
  <h2>Halo,</h2>
  <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda.</p>
  <p>Klik tombol di bawah ini untuk membuat kata sandi baru:</p>
  <p><a href="{{ .ConfirmationURL }}"
        style="background:#f97316;color:#ffffff;padding:12px 24px;
               border-radius:8px;text-decoration:none;font-weight:bold;">
     Atur Kata Sandi Baru</a></p>
  <p>atau salin tautan berikut ke browser:<br>{{ .ConfirmationURL }}</p>
  <p style="color:#888;font-size:12px;">
    Jika Anda tidak meminta reset kata sandi, abaikan email ini.
    Tautan berlaku 1 jam.
  </p>
  ```

- Klik **Save**.

> Disarankan sekalian menyesuaikan template **Confirm Signup** dan
> **Magic Link** agar konsisten berbahasa Indonesia.

---

## 5. Checklist Uji Coba Lengkap

Lakukan **setelah** domain Resend verified & SMTP tersimpan.

### Fase 1 — Pengiriman Email Reset

- [ ] 1.1 Buka `https://bjsracing.com/login` dalam mode incognito
- [ ] 1.2 Klik **"Lupa Kata Sandi?"** → form mini muncul
- [ ] 1.3 Klik **Batal** → form tertutup; klik lagi → terbuka kembali
- [ ] 1.4 Submit dengan format email tidak valid → browser memblokir (validasi HTML)
- [ ] 1.5 Submit dengan email valid → pesan hijau
      *"Instruksi reset telah dikirim ke \<email\>"* muncul
- [ ] 1.6 Email masuk dalam ≤ 1 menit; periksa juga folder spam
- [ ] 1.7 Subjek & isi email berbahasa Indonesia, tombol oranye terlihat rapi
- [ ] 1.8 Ulangi 3× berturut-turut dengan email yang sama (interval ≥60 detik,
      sesuai minimum interval) — semua terkirim, **tidak ada limit**

### Fase 2 — Halaman Reset

- [ ] 2.1 Klik tombol **Atur Kata Sandi Baru** di email → mendarat di
      `https://bjsracing.com/reset-password`, **tidak dilempar ke beranda**
- [ ] 2.2 Form **Atur Kata Sandi Baru** tampil (bukan pesan tautan invalid)
- [ ] 2.3 Toggle ikon mata berfungsi di kedua kolom
- [ ] 2.4 Isi sandi < 6 karakter → toast error minimal 6 karakter
- [ ] 2.5 Konfirmasi tidak cocok → toast error tidak cocok
- [ ] 2.6 Isi valid → toast sukses → otomatis diarahkan ke `/akun` dalam ±1,5 detik
- [ ] 2.7 Di `/akun` status sudah login (sesi recovery aktif)

### Fase 3 — Verifikasi Sandi Baru

- [ ] 3.1 Logout dari akun
- [ ] 3.2 Login pakai **email + sandi BARU** → berhasil masuk
- [ ] 3.3 Login pakai **sandi LAMA** → gagal (pesan kredensial salah)

### Fase 4 — Ketahanan & Edge Case

- [ ] 4.1 Buka link email yang **sudah dipakai** sekali → halaman menampilkan
      *"Tautan Tidak Valid"* + tombol kembali ke halaman masuk
- [ ] 4.2 Buka `/reset-password` langsung (tanpa token) → pesan tautan
      tidak valid, **bukan error kosong/crash**
- [ ] 4.3 Minta reset untuk **email yang belum terdaftar** → email tetap
      "terkirim" (perilaku normal Supabase demi keamanan, mencegah
      email enumeration); pastikan tidak crash
- [ ] 4.4 Login Google tetap berfungsi normal (regresi OAuth)
- [ ] 4.5 Ubah password dari `/akun/keamanan` (saat sudah login) tetap berfungsi
- [ ] 4.6 Cek mobile/PWA: semua langkah di atas nyaman dilakukan di layar kecil

### Fase 5 — Monitoring Pasca-Rilis

- [ ] 5.1 Dashboard Resend → **Logs**: email reset terkirim tanpa bounce
- [ ] 5.2 Supabase → **Authentication → Logs**: tidak ada error auth
- [ ] 5.3 Pantau keluhan customer via WhatsApp selama beberapa hari pertama

---

## 6. Troubleshooting

| Gejala | Penyebab Umum | Solusi |
|---|---|---|
| Email tidak kunjung datang | DNS Resend belum verified / salah API key | Cek **Domains** di Resend & log **Emails** |
| Email masuk spam | SPF/DKIM belum lengkap | Pastikan semua record DNS terpasang |
| Link email membuka beranda, bukan form reset | `redirectTo` tidak match allowlist | Cek Redirect URLs berisi `https://bjsracing.com/**` |
| Halaman reset selalu bilang "Tautan Tidak Valid" | Link kedaluwarsa (>1 jam) / sudah dipakai / token gagal ditukar | Minta link baru; cek konsol browser saat menukar token |
| Error `429 rate limit` saat minta reset | Minimum interval SMTP terlalu kecil / masih SMTP bawaan | Set minimum interval ≥60 detik; pastikan custom SMTP aktif |
| Reset sukses tapi tak bisa login | Cache aplikasi menyimpan sesi lama | Hard refresh / clear storage PWA |

---

## 7. Ringkasan Perubahan

| # | File | Jenis |
|---|---|---|
| 1 | `src/pages/reset-password.astro` | Baru |
| 2 | `src/components/ResetPasswordView.jsx` | Baru |
| 3 | `src/components/AuthForm.jsx` | Diubah |
| 4 | Supabase URL Configuration (dashboard) | Manual — ✅ selesai |
| 5 | Custom SMTP Resend (dashboard) | Manual — ⬜ pending |
| 6 | Template email Bahasa Indonesia (dashboard) | Manual — ⬜ pending |
