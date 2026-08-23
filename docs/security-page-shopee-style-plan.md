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

### ⚠️ Gotcha GoTrue: `identities` Tidak Andal (Diperbaiki)

Uji lapangan membuktikan perilaku Supabase berikut: saat
`updateUser({ password })` dipanggil untuk **akun OAuth-only**, GoTrue
mengisi kolom `encrypted_password` — sehingga **login email+sandi berhasil**
— tetapi **tidak membuat baris** `auth.identities` provider `'email'`.
Akibatnya pemeriksaan `identities` menyimpulkan "belum ada sandi" padahal
sandi sudah aktif.

Verifikasi langsung ke DB (23 Agustus 2026): 7 pengguna OAuth, 6 punya
sandi, **2 di antaranya tanpa baris identitas email** — termasuk akun uji
pemilik toko.

**Solusi:** fungsi database sebagai sumber kebenaran
(`supabase/migrations/2026_08_23_has_auth_password.sql`, dijalankan manual
via SQL Editor sesuai konvensi project):

```sql
CREATE OR REPLACE FUNCTION public.has_auth_password()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND encrypted_password IS NOT NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_auth_password() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_auth_password() TO authenticated;
```

Deteksi kini berlapis: **RPC dulu, fallback `identities`** bila RPC gagal —

```js
let hasPassword =
  Array.isArray(user.identities) &&
  user.identities.some((i) => i.provider === "email");
try {
  const { data: hasPw } = await supabase.rpc("has_auth_password");
  if (typeof hasPw === "boolean") hasPassword = hasPw;
} catch {
  // RPC belum tersedia — pakai fallback identities.
}
```

Pola sama dipakai server-side di `keamanan.astro` via `Astro.locals.supabase`.

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

## 5. Verifikasi OTP via Email (Implementasi)

Sebelumnya tercantum sebagai roadmap — kini **aktif**. Pola gaya Shopee:
kata sandi tidak boleh disimpan sebelum pemilik akun membuktikan
identitas lewat kode 6 digit yang dikirim ke email terdaftar.

| Aspek | Nilai |
|---|---|
| Masa berlaku kode | **60 detik** |
| Percobaan maksimal | 3 per kode, lalu terkunci (minta kode baru) |
| Jeda kirim ulang | 30 detik (diberlakukan server) |
| Penyimpanan | Tabel `password_change_otps` — hanya hash SHA-256, RLS tanpa policy (akses client ditolak; hanya service role via API) |
| Berlaku untuk | Mode **Atur** maupun **Ubah** kata sandi di `/akun/keamanan` |

Alur: submit form valid → API `/api/auth/password-otp/send` mengirim email
(via Resend) + menyimpan hash berjangka → UI menampilkan input OTP dengan
hitung mundur → `/api/auth/password-otp/verify` memvalidasi → baru
`updateUser()` dieksekusi.

Migrasi terkait:
`supabase/migrations/2026_08_23_password_change_otps.sql`.

Sisa item roadmap:

| Fitur | Catatan Implementasi |
|---|---|
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
- [ ] **Bug identitas hilang**: akun yang pernah "Atur Kata Sandi" lalu
      login ulang via email+sandi → halaman menampilkan form **Ubah**
      (bukan meminta Atur lagi)
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

### Verifikasi OTP via Email

- [ ] Submit form ubah/pasang sandi valid → email kode 6 digit masuk ≤30 detik
- [ ] Hitung mundur tampil; pada detik ke-0 muncul pesan kedaluwarsa
- [ ] Kode benar dalam 60 detik → kata sandi tersimpan sesuai mode
      (Atur: tetap login; Ubah: logout)
- [ ] Kode salah → pesan sisa percobaan (3→2→1→habis terkunci)
- [ ] Kode kedaluwarsa → ditolak dengan pesan minta kode baru
- [ ] "Kirim Ulang" <30 detik → ditolak server dengan pesan tunggu;
      ≥30 detik → kode baru terkirim dan kode lama tidak berlaku
- [ ] Tombol "Kembali" kembali ke form tanpa error

### Terjemahan Error Supabase

- [ ] Ganti sandi dengan nilai sama seperti lama → toast:
      "Kata sandi baru harus berbeda dari kata sandi lama."
      (bukan bahasa Inggris)
