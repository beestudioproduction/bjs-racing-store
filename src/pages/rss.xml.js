// File: /src/pages/rss.xml.js
import { supabaseAdmin } from "@/lib/supabaseServer";

export const prerender = false;

const escapeXml = (str = "") =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const stripHtml = (html = "") =>
  html.replace(/<[^>]*>/g, "").slice(0, 300);

export const GET = async () => {
  const { data: posts } = await supabaseAdmin
    .from("feed_posts")
    .select("title, slug, content, category, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(20);

  const baseUrl = "https://bjsracing.com";

  const items = (posts || [])
    .map((post) => {
      const link = `${baseUrl}/blog/${post.slug}`;
      const lines = [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(stripHtml(post.content))}</description>`,
      ];
      if (post.category) lines.push(`      <category>${escapeXml(post.category)}</category>`);
      lines.push("    </item>");
      return lines.join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tips &amp; Trik BJS Racing Store</title>
    <link>${baseUrl}/blog</link>
    <description>Tips &amp; trik cat semprot motor, pilok, dan onderdil dari praktisi BJS Racing Store.</description>
    <language>id-ID</language>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
};
