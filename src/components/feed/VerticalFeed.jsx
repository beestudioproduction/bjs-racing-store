// src/components/feed/VerticalFeed.jsx
import React, { useEffect, useRef, useState } from "react";
import FeedCard, { getYouTubeId, stripHtml } from "./FeedCard.jsx";

const SITE_URL = "https://bjsracing.com";

// Deteksi desktop secara reaktif. Nilai awal false agar SSR & hidrasi
// konsisten (markup vertikal ikut ter-SRR = aman untuk SEO), lalu ditukar
// ke grid setelah mount bila layar lebar.
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
};

const formatPrice = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const getRelatedProduct = (post) => {
  if (post.products && post.products.id) return post.products;
  const rel = post.feed_post_products?.find((r) => r.products)?.products;
  return rel || null;
};

// ─────────────────────────────────────────────────────────────
// Kartu vertikal ala Shorts (khusus mobile)
// ─────────────────────────────────────────────────────────────
const ShortCard = ({ post, index, isActive, shouldMount }) => {
  const ytId = getYouTubeId(post.youtube_url);
  const mediaUrl = post.media_url;
  const iframeRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [copied, setCopied] = useState(false);
  const slug = `/blog/${post.slug || post.id}`;
  const product = getRelatedProduct(post);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sendCommand = (func, args = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  };

  // Autoplay cerdas: hanya kartu aktif yang diputar.
  useEffect(() => {
    if (!ytId || !shouldMount || reducedMotion) return;
    sendCommand(isActive ? "playVideo" : "pauseVideo");
  }, [isActive, shouldMount, ytId, reducedMotion]);

  const toggleMute = () => {
    if (!ytId) return;
    sendCommand(muted ? "unMute" : "mute");
    setMuted(!muted);
  };

  const handleShare = async () => {
    const url = `${SITE_URL}${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* dibatalkan pengguna */
    }
  };

  return (
    <article
      data-index={index}
      className="relative w-full shrink-0 snap-start overflow-hidden bg-black h-[calc(100dvh-8rem)]"
    >
      {/* Lapisan media */}
      {ytId ? (
        <>
          {!shouldMount && (
            <img
              src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          )}
          {shouldMount && (
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1&autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&modestbranding=1&playsinline=1&rel=0`}
              title={post.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )}
        </>
      ) : mediaUrl ? (
        <img
          src={mediaUrl}
          alt={post.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900 to-slate-900 flex items-center justify-center">
          <span className="text-6xl opacity-70">📝</span>
        </div>
      )}

      {/* Overlay gradien + info artikel (anchor nyata untuk SEO) */}
      <a
        href={slug}
        className="absolute inset-x-0 bottom-0 pt-16 pb-5 px-4 pr-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            {post.category || post.post_type}
          </span>
          {post.is_featured && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              Unggulan
            </span>
          )}
        </div>
        <h3 className="font-bold text-lg leading-snug line-clamp-2 mb-1">
          {post.title}
        </h3>
        <p className="text-sm text-white/80 line-clamp-2">
          {stripHtml(post.content)}
        </p>
        {product && (
          <span className="mt-2 inline-flex max-w-full items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs">
            <span className="truncate font-medium">{product.nama}</span>
            <span className="text-orange-300 font-bold whitespace-nowrap">
              {formatPrice(product.harga_jual)}
            </span>
          </span>
        )}
      </a>

      {/* Rail kanan: komentar, bagikan, buka artikel */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5">
        <a
          href={`${slug}#komentar`}
          aria-label={`Lihat komentar (${post.feed_comments?.[0]?.count || 0})`}
          className="flex flex-col items-center text-white drop-shadow"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-[11px] font-semibold mt-0.5">
            {post.feed_comments?.[0]?.count || 0}
          </span>
        </a>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Bagikan artikel"
          className="text-white drop-shadow"
        >
          {copied ? (
            <span className="text-[11px] font-bold bg-black/60 rounded-md px-2 py-1">
              Disalin!
            </span>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          )}
        </button>

        <a href={slug} aria-label="Baca artikel lengkap" className="text-white drop-shadow">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </a>

        {ytId && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
            className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white"
          >
            {muted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </article>
  );
};

// ─────────────────────────────────────────────────────────────
// Komponen utama: grid di desktop, feed vertikal di mobile
// ─────────────────────────────────────────────────────────────
const VerticalFeed = ({ posts }) => {
  const isDesktop = useIsDesktop();
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  // Observer kartu aktif (hanya mode vertikal)
  useEffect(() => {
    if (isDesktop || !containerRef.current) return;
    const cards = Array.from(
      containerRef.current.querySelectorAll("[data-index]"),
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveIndex(Number(entry.target.dataset.index));
          }
        });
      },
      { threshold: 0.8, root: containerRef.current },
    );
    cards.forEach((card) => io.observe(card));
    return () => io.disconnect();
  }, [isDesktop, posts.length]);

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">Belum ada postingan.</div>
    );
  }

  // Desktop: grid editorial memakai FeedCard eksisting
  if (isDesktop) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}
      </div>
    );
  }

  // Mobile: feed vertikal penuh
  return (
    <div
      ref={containerRef}
      className="-mx-4 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
    >
      {posts.map((post, i) => (
        <ShortCard
          key={post.id}
          post={post}
          index={i}
          isActive={i === activeIndex}
          // iframe hanya dimount saat kartu berada ±1 posisi dari viewport
          shouldMount={Math.abs(i - activeIndex) <= 1}
        />
      ))}
    </div>
  );
};

export default VerticalFeed;
