# Roadmap Implementasi: SEO + UI/UX ala Shorts untuk Halaman `/blog`

> Status: **RENCANA — menunggu eksekusi bertahap**
> Disusun: 23 Agustus 2026
> Tujuan halaman: **(1) SEO mesin pencari, (2) tips & trik otomotif**
> Referensi UX: YouTube Shorts / TikTok Shop / Shopee Video (feed vertikal 9:16)

---

## 1. Latar Belakang

Halaman `/blog` (dari tabel `feed_posts`) adalah mesin SEO utama BJS Racing
Store, namun kondisi saat ini memiliki cacat teknis yang menahan performa,
dan tampilannya belum mencerminkan konten video pendek yang dimilikinya.

### 1.1 Hasil Audit (temuan berdasarkan severity)

| # | Severity | Temuan | Lokasi |
|---|---|---|---|
| A1 | 🔴 Kritis | `robots.txt` baris 6 menjanjikan `Sitemap: https://bjsracing.com/sitemap.xml` tetapi **file tidak ada** (tidak ada integrasi `@astrojs/sitemap`, output `server`) | `public/robots.txt` |
| A2 | 🔴 Kritis | JSON-LD `BlogPosting` ditulis sebagai teks literal `"{post.title}"` di dalam `<script>` — konten script TIDAK di-interpolasi Astro sehingga Google menerima string mentah, bukan data artikel | `src/pages/blog/[slug].astro` |
| A3 | 🟠 Tinggi | Identitas halaman terpecah 3 nama: nav bawah "**Feed**", URL "`/blog`", H1 "**Tips, Info & Cerita BJS Racing**". Anchor text "Feed" = jargon medsos, nol nilai keyword | `BottomNav.jsx`, `blog/index.astro` |
| A4 | 🟠 Tinggi | Halaman index blog: tanpa meta description spesifik, tanpa canonical, tanpa OG tag | `blog/index.astro` |
| A5 | 🟡 Sedang | Post hilang/di-unpublish → `Astro.redirect('/blog')` = *soft-404* yang membingungkan crawler | `blog/[slug].astro:23` |
| A6 | 🟡 Sedang | Tidak ada default Open Graph/Twitter Card di seluruh situs — share ke WhatsApp/IG tampil polos | `MainLayout.astro` |
| A7 | 🟢 Roadmap | `og:image` dari Google Drive sering gagal render preview sosial; belum ada RSS; media layak dimigrasi ke Supabase Storage (jangka panjang) | `[slug].astro`, global |

Catatan positif (sudah benar): SSR mengirim HTML lengkap (crawlable),
canonical ada di halaman artikel, struktur konten wajar.

### 1.2 Keputusan Arsitektur Kunci

**Satu URL, dua pengalaman.** Feed vertikal dibangun sebagai komponen React
di `/blog` — komponen Astro `client:load` tetap **dirender server** sebelum
hydrasi, sehingga judul + link artikel tetap ada di HTML yang dibaca
Googlebot. Tidak ada route `/shorts` terpisah yang memecah equity SEO.

```
/blog (SSR)
 ├─ Mobile <640px   : vertical feed 9:16 penuh, scroll-snap, autoplay
 └─ Desktop ≥640px  : grid editorial 3 kolom (ala TikTok web)

/blog/[slug] (SSR)  : halaman artikel = pekerja SEO utama (BlogPosting JSON-LD)
```

---

## 2. Strategi Commit & Revert

Setiap fase = **1 commit terpisah** dengan pesan berpola
`feat(blog): fase N ...`. Push dilakukan per fase agar deploy Vercel bisa
direview bertahap oleh pemilik sebelum lanjut.

Revert satu fase tanpa menyentuh fase lain:

```bash
git revert <hash-commit-fase>   # buat commit pembalik
git push origin main            # Vercel deploy ulang otomatis
```

Karena fase saling independen (lihat matriks ketergantungan §8), revert
fase mana pun aman.

---

## 3. Fase 1 — Identitas, Metadata & Perbaikan Structured Data

**Commit**: `feat(blog): fase 1 - identitas Tips&Trik, metadata index, fix JSON-LD`
**File disentuh**: `src/components/BottomNav.jsx`, `src/pages/blog/index.astro`,
`src/pages/blog/[slug].astro`

### 3.1 Nav bawah (A3)

`BottomNav.jsx:47`: `label: "Feed"` → `label: "Tips & Trik"`
(alignment ikon tidak berubah; lebar label lebih panjang — cek tidak overflow
di layar 320px karena nav memakai `justify-around h-16`).

### 3.2 Halaman index `blog/index.astro` (A3, A4)

| Elemen | Nilai baru |
|---|---|
| `<title>` | `Tips & Trik Cat Semprot & Onderdil Motor \| BJS Racing Store` |
| meta description | `Kumpulan tips & trik cat semprot motor, pilok, dan onderdil dari praktisi BJS Racing Store — tutorial lengkap dengan video.` |
| canonical | `<link rel="canonical" href="https://bjsracing.com/blog/" slot="head-scripts">` |
| H1 | `Tips & Trik Cat Semprot & Onderdil Motor` — gaya bersih konsisten situs (judul saja, tanpa deskripsi, sesuai preferensi pemilik) |
| JSON-LD `Blog` | diganti ke pola aman: `<script type="application/ld+json" set:html={JSON.stringify(schema)} />` |

### 3.3 Halaman artikel `blog/[slug].astro` (A2)

JSON-LD `BlogPosting` dibangun sebagai objek JS lalu diserialisasi:

```astro
<script type="application/ld+json" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  image: ogImage ? [ogImage] : undefined,
  datePublished: post.published_at,
  dateModified: post.updated_at ?? post.published_at,
  author: { "@type": "Organization", name: "BJS Racing Store", url: "https://bjsracing.com" },
  publisher: { /* idem + logo */ },
  mainEntityOfPage: { "@type": "WebPage", "@id": `https://bjsracing.com/blog/${post.slug}` },
})} />
```

Bonus di file yang sama: perbaiki type error pre-existing pada
`<YouTubeEmbed client:load>` (hasil `npx astro check`).

### 3.4 Checklist Review Fase 1

- [ ] Nav bawah tampil "**Tips & Trik**", tidak overflow di 320px
- [ ] View-source `view-source:bjsracing.com/blog` → ada title/desc/canonical baru
- [ ] Rich Results Test Google terhadap URL artikel → JSON-LD **terbaca valid**
      (headline berisi judul asli, bukan `{post.title}`)
- [ ] `npx astro check` → error YouTubeEmbed hilang, tidak ada error baru
- [ ] Halaman artikel & index tampil normal di mobile

---

## 4. Fase 2 — Sitemap Dinamis & 404 Sungguhan

**Commit**: `feat(blog): fase 2 - sitemap.xml dinamis, 404 untuk post hilang`
**File**: `src/pages/sitemap.xml.ts` (BARU), `src/pages/blog/[slug].astro`

### 4.1 Endpoint `/sitemap.xml.ts`

- `export const prerender = false;` + `export const GET: APIRoute`
- Isi: halaman statis prioritas tinggi (`/`, `/pilok`, `/onderdil`,
  `/katalog-warna`, `/simulator`, `/scan-warna`, `/blog`, `/voucher`,
  `/lokasi-toko`, `/jangkauan-pengiriman`, 3 halaman legal) + **seluruh**
  `feed_posts` berstatus `is_published` (loc + lastmod dari `updated_at`)
- Header `Content-Type: application/xml`,
  `Cache-Control: public, max-age=0, s-maxage=3600`
- robots.txt **tidak diubah** (janjinya sudah benar, kini tertunai)

### 4.2 404 sungguhan (A5)

Ganti `return Astro.redirect('/blog')` menjadi:

```ts
return new Response(null, { status: 404, statusText: "Not Found" });
```

(pilihan sederhana & pasti; `Astro.rewrite("/404")` dipertimbangkan bila
ingin halaman 404 berstyling — dicatat sebagai opsi saat implementasi)

### 4.3 Checklist Review Fase 2

- [ ] `curl -sI https://bjsracing.com/sitemap.xml` → HTTP 200, `application/xml`
- [ ] Isi XML memuat URL statis + semua slug post; lastmod valid ISO
- [ ] Validasi XML lolos (browser/Screaming Frog)
- [ ] `curl -s -o /dev/null -w "%{http_code}" .../blog/slug-palsu` → **404**
- [ ] Search Console → Submit sitemap (langkah manual pemilik)

---

## 5. Fase 3A — Default Open Graph Situs-Lebar

**Commit**: `feat(blog): fase 3a - default OG/Twitter card situs-lebar`
**File**: `src/layouts/MainLayout.astro`, `src/pages/blog/[slug].astro`

- MainLayout menerima props opsional baru: `description?`, `ogImage?`,
  `canonicalPath?`, `ogType?`
- Emit default: `og:site_name`, `og:type` (default `website`),
  `og:title` = title, `og:description` = deskripsi default toko,
  `og:url`, `og:image` (banner/logo hosted di domain), `twitter:card =
  summary_large_image`
- Refactor `[slug].astro`: **berhenti** meng-emit tag OG sendiri, kirim
  nilai spesifik via props → mencegah duplikasi og:title ganda
- Meta description default MainLayout diperhalus memuat keyword utama
  ("spray paint", "onderdil motor")

Checklist: share URL blog & produk ke WhatsApp → preview muncul rapi;
`view-source` tidak ada og:title duplikat di halaman artikel.

---

## 6. Fase 3B — Vertical Feed ala Shorts (UI/UX Baru)

**Commit**: `feat(blog): fase 3b - vertical feed 9:16 ala Shorts di mobile`
**File**: `src/components/feed/VerticalFeed.jsx` (BARU),
`src/pages/blog/index.astro` (ganti `FeedGrid` → `VerticalFeed`)
**Dependensi**: tidak wajib, tapi ideal setelah 3A (OG rapi saat dibagikan)

### 6.1 Spesifikasi Mobile (<640px)

| Aspek | Spesifikasi |
|---|---|
| Kontainer | `h-[100dvh] overflow-y-scroll snap-y snap-mandatory scrollbar-hide` |
| Kartu | `h-[100dvh] w-full snap-start relative bg-black` |
| Video YouTube | iframe `youtubeId` (ekstraksi server-side, reuse logika `getYouTubeId`), param `enablejsapi=1&autoplay=1&mute=1&controls=0&loop=1&playlist=<ID>&modestbranding=1&playsinline=1&rel=0` |
| Autoplay cerdas | IntersectionObserver `threshold: 0.8` → postMessage `playVideo`/`pauseVideo` ke iframe aktif; kartu lain idle |
| Unmute | tombol speaker kanan-bawah; state lokal per kartu |
| Post image-only | `media_url` `object-cover` penuh 9:16, overlay identik |
| Overlay bawah | gradien `from-black/85 via-black/40 to-transparent`: chip kategori (orange), judul `line-clamp-2` putih bold, snippet konten 1–2 baris, produk terkait (nama + harga, link `/products/{id}`) |
| Rail kanan | ikon komentar (count, link `/blog/{slug}#komentar`), ikon bagikan (`navigator.share`, fallback copy URL), ikon artikel (→ `/blog/{slug}`) |
| Header feed | tipis transparan: "Tips & Trik" + logo mini; menghilang saat scroll? (tetap statis — sederhana dulu) |
| Aksesibilitas | setiap kartu punya `<a href="/blog/{slug}">` nyata di DOM; `aria-label` semua tombol ikon; `prefers-reduced-motion` → autoplay nonaktif |
| SEO guardrail | markup server-rendered (client:load tetap SSR); fallback `<noscript>` daftar link artikel |

### 6.2 Spesifikasi Desktop (≥640px)

Grid editorial 3 kolom (markup `FeedCard` eksisting dirapikan):
thumbnail 16:9, durasi/kategori chip, judul 2 baris, meta tanggal+komentar.
Klik kartu → navigasi ke `/blog/{slug}` (tanpa modal — sederhana dulu).

### 6.3 Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Autoplay iframe iOS quirk | WAJIB `mute=1` + `playsinline=1`; QA di iPhone sungguhan |
| Scroll-snap bentrok gesture browser | uji Chrome Android + Safari iOS; fallback `snap-y proximity` bila keras |
| Berat (banyak iframe) | iframe hanya dimount saat kartu ±1 posisi dari viewport |
| UX membingungkan pengguna lama | header feed jelas; grid desktop tetap familiar |

Checklist QA wajib di perangkat nyata (bukan hanya DevTools):
swipe antar kartu terkunci 1 layar; video pause saat pindah; tap unmute;
share berfungsi; link produk/artikel akurat; Lighthouse mobile ≥ 85.

---

## 7. Fase 3C — RSS Feed

**Commit**: `feat(blog): fase 3c - rss feed`
**File**: `src/pages/rss.xml.js` (BARU)

- Endpoint `/rss.xml`: 20 post terakhir (title, link, pubDate, description
  strip-HTML, category), `Content-Type: application/rss+xml`
- `<link rel="alternate" type="application/rss+xml">` di head blog index
- Distribusi: submit ke Feedly/Golden RSS untuk indeks cepat

---

## 8. Matriks Ketergantungan & Urutan Eksekusi

```
Fase 1 ──► Fase 2 ──► Fase 3A ──► Fase 3B ──► Fase 3C
metadata     teknis     OG situs    UI shorts    distribusi
```

Setiap fase dapat direvert independen; 3B adalah satu-satunya yang
menyentuh tampilan besar (revisi UI termudah dikembalikan karena cukup
mengganti kembali impor `VerticalFeed` → `FeedGrid` di `index.astro`).

## 9. Langkah Pasca-Deploy (Manual Pemilik)

1. Google Search Console → property `bjsracing.com` → Sitemaps → submit
   `https://bjsracing.com/sitemap.xml`
2. Request indexing untuk `/blog` dan 3–5 artikel unggulan
3. Share 1 URL artikel ke WhatsApp pribadi → verifikasi preview OG (Fase 3A)
4. Pantau Coverage & Performance GSC mingguan; target awal: semua URL
   post berstatus "Indexed"

## 10. Roadmap Lanjutan (di luar scope saat ini)

- Migrasi media Google Drive → Supabase Storage (kecepatan + OG image stabil)
- Pagination/infinite scroll index saat post > 20
- Bagian "Artikel Terkait" di halaman artikel (internal linking)
- Halaman kategori blog (`/blog/kategori/{x}`) untuk cluster topikal
