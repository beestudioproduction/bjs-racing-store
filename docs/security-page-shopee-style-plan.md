# Halaman Keamanan Akun Gaya Shopee

> Status: **Diimplementasikan**
> Terkait: audit halaman `/akun/keamanan` yang sebelumnya menampilkan
> "Ubah Password" ke semua pengguna, termasuk yang login via Google.

## 1. Latar Belakang

`ChangePasswordView.jsx` dirender tanpa syarat di `keamanan.astro`,
sehingga pengguna Google OAuth melihat form "Ubah Password" padahal akunnya
tidak memiliki kata sandi. Memanggil `updateUser({ password })` pada akun
semacam itu justru *menambahkan* kredensial email+sandi secara diam-diam —
membingungkan dan tidak transparan.

Pola marketplace profesional (Shopee): satu item keamanan dengan **dua state**:

| State | Label Status | Aksi |
|---|---|---|
| Akun Google tanpa sandi | `Belum diatur` | Tombol **"Atur Kata Sandi"** |
| Sudah punya sandi | `Sudah diatur` | Form **"Ubah Password"** |

## 2. Deteksi Metode Login

Entri `'email'` di `user.identities` hanya ada jika akun memiliki kredensial
kata sandi:

```js
// client-side
const { data } = await supabase.auth.getUser();
const hasPassword = data.user.identities?.some((i) => i.provider === "email");

// server-side (keamanan.astro) — tersedia via Astro.locals.session
const hasPasswordServer = session?.user?.identities?.some(
  (i) => i.provider === "email",
);
```

Setelah pengguna Google memasang sandi pertama kali, entri `'email'`
otomatis bertambah → UI berubah sendiri menjadi mode Ubah pada kunjungan
berikutnya.

## 3. Perubahan File

### 3.1 `src/components/ChangePasswordView.jsx` (refactor)

```
┌─ Kartu Keamanan ────────────────────────────────┐
│ Email: budi@gmail.com            ✓ Terverifikasi│
│ Masuk via: [Google] / [Email]                    │
│ Kata Sandi: Belum diatur / Sudah diatur          │
└──────────────────────────────────────────────────┘

State A — tanpa identitas 'email':
  • Kartu info + catatan manfaat login ganda
  • Tombol [Atur Kata Sandi] → buka form pasang
    - Judul "Atur Kata Sandi", submit → updateUser({ password })
    - Sukses: toast + refresh state, TETAP login (tidak sign-out)

State B — punya identitas 'email':
  • Form Ubah Password (perilaku existing dipertahankan:
    validasi min 6 karakter, toggle mata, sign-out setelah sukses)
```

### 3.2 `src/pages/akun/keamanan.astro`

Judul halaman dinamis server-side (mencegah flash konten):

```astro
const hasPassword = session?.user?.identities?.some(
  (i) => i.provider === "email",
);
<h1>{hasPassword ? "Ubah Password" : "Keamanan Akun"}</h1>
```

## 4. Penguatan Kebijakan Kata Sandi (Tambahan)

Sebelumnya validasi hanya **minimal 6 karakter** — `123456` atau `budi123`
lolos. Kini diperkuat di dua lapis:

### 4.1 Kebijakan Minimum (diberlakukan saat submit)

| Aturan | Pesan Error |
|---|---|
| Minimal **8 karakter** | "Kata sandi minimal 8 karakter." |
| Wajib **kombinasi huruf dan angka** | "Kata sandi harus mengandung kombinasi huruf dan angka." |
| Tolak sandi umum (`12345678`, `password`, `qwerty`, dst.) | Dibatasi skor "Lemah" oleh meter |

> Catatan standar NIST: panjang > kompleksitas simbol. Karena itu tidak
> mewajibkan simbol/kapital, hanya kombinasi huruf+angka.

### 4.2 Indikator Kekuatan Kata Sandi (UI Baru)

Komponen `PasswordStrengthMeter.jsx` gaya profesional (Dropbox/GitHub):

```
Kata Sandi Baru
┌──────────────────────────────────────┐
│ kopi-garasi-2026              👁     │
└──────────────────────────────────────┘
▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ░░░░          Bagus
✓ Minimal 8 karakter
✓ Mengandung huruf dan angka
```

- **Bar 4 segmen** dengan gradasi: 🔴 Merah *Lemah* → 🟠 Oranye *Cukup* →
  🟡 Lime *Bagus* → 🟢 Hijau *Sangat Kuat* (oranye menyatu dengan warna brand)
- **Checklist syarat live** dengan ikon ✅/❌ — pengguna tahu persis apa yang
  kurang tanpa harus submit dulu
- **Skoring lokal** (tanpa dependensi; `zxcvbn` ±300KB terlalu berat untuk
  PWA): +1 panjang ≥8, +1 huruf&angka, +1 kapital/simbol, +1 panjang ≥12;
  sandi umum & numerik murni dibatasi maksimal "Lemah"
- Transisi warna 300ms, `aria-live="polite"` untuk aksesibilitas

### 4.3 File Terkait

| File | Jenis | Isi |
|---|---|---|
| `src/lib/passwordStrength.ts` | Baru | Kebijakan, skoring, blacklist sandi umum, meta warna |
| `src/components/PasswordStrengthMeter.jsx` | Baru | Bar segmen + label + checklist live |
| `src/components/ChangePasswordView.jsx` | Diubah | Meter dipasang + validasi kebijakan baru |
| `src/components/ResetPasswordView.jsx` | Diubah | Meter dipasang + validasi kebijakan baru |

### 4.4 Setting Supabase Dashboard (Manual)

Dashboard → **Authentication** → **Policies**:

1. *Minimum password length*: ubah `6` → `8`
2. Aktifkan **Leaked password protection** (menolak sandi yang ada di basis
   data kebocoran HaveIBeenPwned) → Save

## 5. Roadmap Fase Berikutnya (di luar scope ini)

| Fitur | Catatan Implementasi |
|---|---|
| **Verifikasi OTP sebelum ganti sandi** (gaya Shopee) | Kirim kode 6 digit via **email Resend** (gratis, resmi — infrastruktur SMTP sudah terpasang untuk reset password); hindari gateway WA unofficial (risiko banned nomor). Simpan kode dengan TTL 5 menit, maksimal 3 percobaan |
| Logout perangkat lain setelah ganti sandi | `supabase.auth.signOut({ scope: 'others' })` |
| Notifikasi WA via Fonnte free tier | Untuk notifikasi pesanan (bukan OTP) — kuota 1.000 pesan/bulan gratis |

## 6. Checklist Uji Coba

### Halaman Keamanan

- [ ] Login Gmail → `/akun/keamanan` judul "Keamanan Akun", kartu info +
      badge Google + status "Belum diatur", **tanpa form**
- [ ] Klik "Atur Kata Sandi" → form pasang muncul
- [ ] Validasi <8 karakter & konfirmasi tak cocok → toast error
- [ ] Pasang sukses → toast sukses, status berubah "Sudah diatur",
      **tetap login**
- [ ] Logout → login Google lagi → halaman menampilkan form Ubah
- [ ] Logout → login pakai email+sandi baru → berhasil
- [ ] Akun lama (daftar email) → langsung form Ubah, perilaku tetap
- [ ] Regresi: login Google biasa & alur reset password baru tidak terganggu

### Indikator Kekuatan Kata Sandi

- [ ] Ketik `abc` → bar merah 1 segmen "Lemah", checklist ❌❌
- [ ] Ketik `12345678` → tetap **"Lemah"** (sandi umum & numerik murni)
      meski panjang cukup
- [ ] Ketik `kopi2026` → 2 segmen oranye "Cukup", checklist ✓✓
- [ ] Ketik `Kopi2026` → 3 segmen lime "Bagus"
- [ ] Ketik `kopi-garasi-2026` → 4 segmen hijau "Sangat Kuat"
- [ ] Kolom dikosongkan → meter & checklist menghilang
- [ ] Submit dengan sandi lemah → toast error kebijakan, tidak tersimpan
- [ ] Meter juga tampil & berfungsi di halaman `/reset-password`
      (alur lupa kata sandi)
- [ ] Setelah setting dashboard: sandi 7 karakter ditolak Supabase
      (lapisan kedua), pesan error tampil rapi
