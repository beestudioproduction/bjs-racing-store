// File: /src/pages/sitemap.xml.ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data: posts } = await supabaseAdmin
    .from("feed_posts")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  const baseUrl = "https://bjsracing.com";

  // Halaman publik prioritas tinggi (tanpa lastmod karena jarang berubah;
  // /blog diberi lastmod karena isinya dinamis).
  const staticPaths = [
    "/",
    "/pilok",
    "/onderdil",
    "/katalog-warna",
    "/simulator",
    "/scan-warna",
    "/blog",
    "/voucher",
    "/lokasi-toko",
    "/jangkauan-pengiriman",
    "/syarat-ketentuan",
    "/kebijakan-privasi",
    "/kebijakan-pengembalian",
  ];

  const urls = [
    ...staticPaths.map((path) => ({
      loc: `${baseUrl}${path}`,
      lastmod: path === "/blog" ? new Date().toISOString() : null,
    })),
    ...(posts || []).map((post) => ({
      loc: `${baseUrl}/blog/${post.slug}`,
      lastmod: post.updated_at || new Date().toISOString(),
    })),
  ];

  const xmlEntries = urls.map((u) =>
    [
      "  <url>",
      `    <loc>${u.loc}</loc>`,
      u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
};
