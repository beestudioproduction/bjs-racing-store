# Google Search Console — Panduan Pemilik Toko

Panduan langkah manual untuk mendaftarkan situs ke Google Search Console (GSC)
dan memantau indeksasi. Dilakukan sekali di awal + rutinitas mingguan ringan.

---

## 1. Setup Awal (sekali saja)

1. Buka <https://search.google.com/search-console> dan login dengan akun Google pemilik toko.
2. Klik **Add property** → pilih tipe **Domain**.
3. Masukkan: `bjsracing.com`
4. Google memberi satu **record TXT** — tambahkan di pengaturan DNS domain Anda
   (Cloudflare / registrar tempat membeli domain).
5. Klik **Verify**. Selesai — properti Domain otomatis mencakup `www`,
   subdomain, dan protokol http/https.

> Alternatif lebih cepat: properti **URL prefix** `https://bjsracing.com`
> diverifikasi lewat HTML file/tag. Kelemahannya hanya mencakup persis URL itu.
> Rekomendasi: tetap gunakan **Domain**.

## 2. Submit Sitemap

> Prasyarat: deploy Fase 2 sudah live (endpoint `/sitemap.xml` aktif).

1. Menu **Sitemaps** → ketik `sitemap.xml` → **Submit**.
2. Status "Couldn't fetch" pada menit pertama adalah **normal** — cek ulang
   24 jam kemudian hingga terbaca **Success**.

## 3. Percepat Indexing (opsional, sangat disarankan)

1. Menu **URL Inspection** (kolom pencarian atas) → tempel URL → Enter.
2. Jika status "URL is not on Google" → klik **Request Indexing**.
3. Lakukan untuk:
   - `https://bjsracing.com/blog`
   - 3–5 artikel unggulan (paling banyak dilihat pembeli)

## 4. Uji Preview WhatsApp (verifikasi OG)

1. Share salah satu URL artikel ke chat WhatsApp pribadi/sendi.
2. Pastikan muncul kartu preview: judul + deskripsi + gambar, tidak polos.
3. Kalau gambar tidak muncul → kemungkinan media Google Drive belum
   publik; dicatat di roadmap migrasi ke Supabase Storage.

## 5. Rutinitas Mingguan (±5 menit)

| Menu | Yang dicek | Target |
|------|-----------|--------|
| **Coverage / Pages** | Status URL artikel | Semua "Indexed". "Soft 404" = masih ada redirect tua (harusnya hilang sejak Fase 2) |
| **Performance → Queries** | Keyword penyumbang klik | Bahan ide artikel berikutnya |
| **Sitemaps** | Post-discovered / indexed ratio | Naik stabil tiap minggu |

## 6. Distribusi RSS (sekali saja)

1. Buka URL feed: `https://bjsracing.com/rss.xml` — pastikan tampil XML rapi.
2. Submit ke agregator pembaca feed:
   - **Feedly** → ikuti URL blog
   - **Golden RSS** / pembaca feed lainnya
3. Ini mempercepat penemuan artikel baru oleh mesin pencari & pembaca setia.

---

## Checklist Cepat

- [ ] Properti Domain terverifikasi (TXT DNS)
- [ ] Sitemap `sitemap.xml` status Success
- [ ] Request indexing: `/blog` + 3–5 artikel unggulan
- [ ] Preview WhatsApp artikel rapi (judul + gambar)
- [ ] Feed `rss.xml` disubmit ke Feedly/Golden RSS
- [ ] Jadwal cek mingguan masuk kalender
