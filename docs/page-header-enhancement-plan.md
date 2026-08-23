# Rencana & Implementasi: Enhancement Judul Halaman (PageHeader)

> Status: **Fase 1 selesai** — komponen reusable dibuat, diterapkan di `/cart`
> Tanggal: 23 Agustus 2026
> Referensi desain: skill `ui-ux-pro-max` (gaya *minimal & direct*, WCAG AAA)

## 1. Latar Belakang

Judul halaman memakai pola lama:

```html
<h1 class="text-3xl font-bold mb-8">Keranjang Belanja</h1>
```

Masalah di mobile:
- `text-3xl` = **30px** memakan ~10% tinggi viewport HP
- Warna hitam polos tanpa hierarki — terlihat "jadul", tidak seperti marketplace modern
- Tidak ada navigasi kembali yang jelas (pengguna harus pakai tombol browser)
- Pola sama tersebar di **14 halaman**

## 2. Keputusan Desain (Opsi C — App Bar Native)

| Elemen | Keputusan | Alasan |
|---|---|---|
| Ukuran judul | `text-base font-semibold text-slate-900` (16px) | Standar large-title compact iOS/Android; hierarki jelas di bawah header situs |
| Tombol kembali | Lingkaran 36px ghost (`border-slate-200`, hover `bg-slate-100`), SVG panah 20px | Tap target mendekati standar 44px tanpa terlihat gemuk |
| Perilaku kembali | `history.back()` bila pengunjung datang dari situs ini, fallback `href="/"` | Kembali ke halaman produk asal (konversi-friendly), bukan selalu home |
| Latar bar | Transparan, tanpa border/kartu | Header situs sudah sticky (~50px); bar transparan menyatu rapi dan fokus visual tetap ke CTA |
| Sticky | **Tidak** untuk `/cart` | Dua bar sticky menumpuk = ~106px layar terkunci; Shopee/Tokopedia web-mobile pun tidak menumpuk. Efek native didapat dari proporsi, bukan stickiness. Prop `sticky` bisa ditambah nanti bila ada halaman yang benar-benar perlu (YAGNI) |
| Subteks | Didukung via prop `subtitle`, tidak dipakai di `/cart` | Ringkasan subtotal sudah berkomunikasi; subteks = kebisingan |

## 3. Komponen Reusable

File baru: **`src/components/PageHeader.astro`**

```astro
<PageHeader title="Keranjang Belanja" />

<!-- dengan subteks -->
<PageHeader title="Voucher & Promo" subtitle="Berlaku untuk semua produk" />

<!-- tanpa tombol kembali / fallback kustom -->
<PageHeader title="Kebijakan Privasi" hideBack={true} />
<PageHeader title="Checkout" backHref="/cart" />
```

API props:

| Prop | Tipe | Default | Keterangan |
|---|---|---|---|
| `title` | `string` | wajib | Teks judul (`h1`) |
| `subtitle` | `string?` | — | Teks kecil abu di bawah judul |
| `backHref` | `string` | `"/"` | Tujuan fallback bila tak ada riwayat |
| `hideBack` | `boolean` | `false` | Sembunyikan tombol kembali |

Detail teknis:
- Ikon SVG inline stroke 24x24 viewBox (tanpa emoji, konsisten ukuran)
- Script `history.back()` hanya aktif bila `document.referrer` berasal dari
  domain sendiri **dan** riwayat > 1 — mencegah perilaku aneh saat buka
  langsung dari link share/QR
- Aksesibilitas: `aria-label="Kembali"` pada tautan ikon

## 4. Fase 1 — Penerapan di `/cart`

Perubahan `src/pages/cart.astro`:

```diff
+import PageHeader from '../components/PageHeader.astro';

-    <div class="container mx-auto px-4 py-8">
-        <h1 class="text-3xl font-bold mb-8">Keranjang Belanja</h1>
+    <div class="container mx-auto px-4 py-5">
+        <PageHeader title="Keranjang Belanja" />
```

- Padding atas `py-8` → dihapus: ritme vertikal rapat. Jarak final
  **header situs → judul = 16px** (warisan `py-4` dari `<main>` MainLayout,
  padding ganda container dihilangkan), **judul → konten = 12px**
  (`mb-3` di PageHeader) — prinsip proximity: judul lebih dekat ke
  kontennya daripada ke header atas
- Heading empty-state di dalam `CartView.jsx`
  ("Keranjang Belanja Anda Kosong") sengaja **tidak diubah** — itu bagian
  React, bukan judul halaman

## 5. Rollout Fase 2 — Halaman Lain

> **Status: selesai** (Agustus 2026) — preferensi final pengguna: judul
> Indonesia ringkas **tanpa deskripsi halaman** (tampilan bersih).

| Halaman | Judul | Catatan |
|---|---|---|
| `checkout.astro` | Checkout | `backHref="/cart"` — kembali ke keranjang |
| `voucher.astro` | Voucher & Promo | deskripsi dihapus |
| `onderdil.astro` | Onderdil & Aksesoris | deskripsi dihapus |
| `katalog-warna.astro` | Katalog Warna Digital | deskripsi dihapus |
| `pilok.astro` | Produk Pilok / Cat Semprot | copy baru dari `common.json`; deskripsi dihapus |
| `lokasi-toko.astro` | Lokasi Toko | deskripsi dihapus |
| `jangkauan-pengiriman.astro` | Jangkauan Pengiriman | deskripsi dihapus |
| `syarat-ketentuan.astro` | Syarat & Ketentuan | tanggal pembaruan dipertahankan sebagai `subtitle` (metadata) |
| `kebijakan-privasi.astro` | Kebijakan Privasi | idem |
| `kebijakan-pengembalian.astro` | Kebijakan Pembatalan, Pengembalian & Refund | idem |

Sengaja tidak dimigrasi:
- `login.astro`, `reset-password.astro` — layar auth terpusat dengan hierarki sendiri
- `simulator.astro`, `scan-warna.astro` — alat imersif tanpa judul kontekstual
- `index.astro` — hero homepage

## 6. Checklist Testing (Fase 1)

Mobile (375px):
- [ ] Judul tampil 16px semibold, satu baris, tidak dobel dengan heading kosong CartView
- [ ] Tombol kembali lingkaran 36px, tap membalikkan ke halaman sebelumnya (mis. produk → cart → produk)
- [ ] Buka `/cart` langsung dari URL baru (tanpa referrer) → klik kembali menuju `/`
- [ ] Tidak ada layout shift saat CartView selesai hydrate
- [ ] Bar subtotal bawah tetap menempel dasar layar (perbaikan sebelumnya)
- [ ] Desktop: tampilan rapi, tombol kembali tetap ada (tidak mengganggu)

## 7. Rollback

Fitur murni presentasional. Revert commit komponen + `cart.astro`
(`git revert <hash>`) mengembalikan judul lama tanpa dampak data/fungsi.
