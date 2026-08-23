# Template Email Supabase — Bahasa Indonesia

> Status: **Siap pakai** — copy-paste ke Supabase Dashboard
> Prasyarat: Custom SMTP Resend sudah aktif (lihat
> `docs/forgot-password-implementation.md` §4)
> Tanggal: 23 Agustus 2026

Semua template memakai warna brand oranye (`#f97316`) dan variabel
`{{ .ConfirmationURL }}` yang otomatis diganti Supabase dengan tautan
bermasa berlaku.

---

## 1. Confirm Signup (Verifikasi Email Pendaftar Baru)

**Fungsi:** dikirim otomatis saat pengguna baru mendaftar dengan
email+sandi, meminta mereka membuktikan bahwa alamat email benar miliknya.
Akun belum bisa dipakai penuh sebelum dikonfirmasi (jika setting
*Confirm email* aktif).

**Subject:**

```
Konfirmasi Email Akun BJS Racing Store
```

**Body (ganti seluruhnya):**

```html
<h2>Selamat Datang di BJS Racing Store! 🏁</h2>
<p>Terima kasih telah mendaftar. Tinggal satu langkah lagi:</p>
<p>Klik tombol di bawah untuk mengonfirmasi alamat email Anda:</p>
<p><a href="{{ .ConfirmationURL }}"
      style="background:#f97316;color:#ffffff;padding:12px 24px;
             border-radius:8px;text-decoration:none;font-weight:bold;">
   Konfirmasi Email Saya</a></p>
<p>atau salin tautan berikut ke browser:<br>{{ .ConfirmationURL }}</p>
<p style="color:#888;font-size:12px;">
  Jika Anda tidak merasa mendaftar di BJS Racing Store,
  abaikan email ini.
</p>
```

### Langkah Setting

1. Dashboard Supabase → **Authentication** → **Emails** → **Templates**
   → pilih **Confirm signup**
2. Paste **Subject** dan **Body** di atas → klik **Save**
3. Pastikan verifikasi wajib aktif: **Authentication** → **Sign In /
   Providers** → **Email** → toggle **"Confirm email" = ON**
4. Klik **Save changes**

> Efek samping ON: seluruh pendaftar baru lewat form Daftar akan menerima
> email ini. Pengguna Google tidak terdampak (email sudah diverifikasi
> Google).

---

## 2. Magic Link (Masuk Tanpa Kata Sandi)

### Apa Itu Magic Link?

Metode login tanpa password: pengguna cukup memasukkan alamat email →
menerima tautan → klik → langsung masuk ke akun. Manfaatnya:

- Menghilangkan keluhan "lupa kata sandi" sepenuhnya untuk yang memakainya
- Tidak ada sandi yang bisa bocor/ditebak dari sisi akun tersebut
- Cocok untuk pelanggan kasual yang malas membuat sandi

**Status di STORE:** fitur ini *belum* diekspos di halaman `/login` —
halaman itu baru menyediakan Google, email+sandi, dan form lupa kata
sandi. Template di bawah disiapkan agar tinggal pakai jika nanti tombol
"Masuk via Magic Link" ditambahkan (integrasi kode:
`supabase.auth.signInWithOtp({ email })`).

**Subject:**

```
Tautan Masuk ke BJS Racing Store
```

**Body (ganti seluruhnya):**

```html
<h2>Halo,</h2>
<p>Gunakan tautan di bawah ini untuk langsung masuk ke akun Anda
<strong>tanpa kata sandi</strong>:</p>
<p><a href="{{ .ConfirmationURL }}"
      style="background:#f97316;color:#ffffff;padding:12px 24px;
             border-radius:8px;text-decoration:none;font-weight:bold;">
   Masuk Sekarang</a></p>
<p>atau salin tautan berikut ke browser:<br>{{ .ConfirmationURL }}</p>
<p style="color:#888;font-size:12px;">
  Tautan berlaku 1 jam dan hanya dapat dipakai satu kali.
  Jika Anda tidak meminta tautan ini, abaikan email ini —
  akun Anda tetap aman.
</p>
```

### Langkah Setting

1. Dashboard Supabase → **Authentication** → **Emails** → **Templates**
   → pilih **Magic Link**
2. Paste **Subject** dan **Body** di atas → klik **Save**
3. Selesai — tidak ada toggle khusus. Magic link tersedia lewat API
   `signInWithOtp`; jika suatu saat diaktifkan di UI login, template ini
   langsung terpakai.

---

## 3. Catatan Umum

| Topik | Keterangan |
|---|---|
| Variabel | `{{ .ConfirmationURL }}` = tautan aksi; diganti server Supabase saat pengiriman |
| Redirect | Redirect URLs sudah mencakup `https://bjsracing.com/**` sehingga tautan aman mendarat di domain produksi |
| Jalur kirim | Semua email melewati SMTP Resend custom — bebas limit bawaan Supabase |
| Konsistensi | Template **Reset Password** juga sudah Bahasa Indonesia (lihat `docs/forgot-password-implementation.md` §A.3) |

## 4. Checklist Uji Coba

- [ ] **Confirm Signup**: daftar akun baru via form Daftar → email
      konfirmasi masuk ≤1 menit, tombol oranye rapi
- [ ] Klik tombol → kembali ke situs dalam kondisi ter-login / terverifikasi
- [ ] Coba daftar lagi dengan email sama → tidak crash (pesan error sopan)
- [ ] **Magic Link** (jika diaktifkan nanti): minta tautan → klik →
      langsung masuk tanpa sandi
- [ ] Tautan kedua kali (sudah dipakai) → pesan tautan tidak valid,
      bukan error kosong
- [ ] Cek folder spam pada Gmail & non-Gmail (Outlook/Yahoo) sekali saja
      untuk memastikan SPF/DKIM Resend bersih
