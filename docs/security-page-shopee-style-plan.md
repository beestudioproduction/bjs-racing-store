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

## 4. Roadmap Fase Berikutnya (di luar scope ini)

| Fitur | Catatan Implementasi |
|---|---|
| **Verifikasi OTP sebelum ganti sandi** (gaya Shopee) | Kirim kode 6 digit via **email Resend** (gratis, resmi — infrastruktur SMTP sudah terpasang untuk reset password); hindari gateway WA unofficial (risiko banned nomor). Simpan kode dengan TTL 5 menit, maksimal 3 percobaan |
| Logout perangkat lain setelah ganti sandi | `supabase.auth.signOut({ scope: 'others' })` |
| Notifikasi WA via Fonnte free tier | Untuk notifikasi pesanan (bukan OTP) — kuota 1.000 pesan/bulan gratis |

## 5. Checklist Uji Coba

- [ ] Login Gmail → `/akun/keamanan` judul "Keamanan Akun", kartu info +
      badge Google + status "Belum diatur", **tanpa form**
- [ ] Klik "Atur Kata Sandi" → form pasang muncul
- [ ] Validasi <6 karakter & konfirmasi tak cocok → toast error
- [ ] Pasang sukses → toast sukses, status berubah "Sudah diatur",
      **tetap login**
- [ ] Logout → login Google lagi → halaman menampilkan form Ubah
- [ ] Logout → login pakai email+sandi baru → berhasil
- [ ] Akun lama (daftar email) → langsung form Ubah, perilaku tetap
- [ ] Regresi: login Google biasa & alur reset password baru tidak terganggu
