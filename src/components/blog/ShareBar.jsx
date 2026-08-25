import React, { useState, useEffect } from "react";

const whatsappIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const twitterIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function ShareBar({ title, slug }) {
  const [copied, setCopied] = useState(false);
  // Origin aktual diambil setelah mount agar tidak ada hydration mismatch
  // (SSR & render awal pakai fallback), lalu diperbarui. Menghindari
  // hardcode domain sehingga benar di staging & produksi.
  const [origin, setOrigin] = useState("https://bjsracing.com");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const buildUrl = () => `${origin}/blog/${slug}`;
  const text = `${title} — BJS Racing`;

  const shareTo = () => {
    const url = buildUrl();
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      copyLink();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <>
      {/* Desktop: floating vertical bar kiri */}
      <div className="hidden xl:flex flex-col fixed left-3 xl:left-6 top-1/2 -translate-y-1/2 gap-3 z-40">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text + " " + buildUrl())}`}
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-green-600 hover:border-green-300 shadow-sm flex items-center justify-center transition-colors"
          aria-label="Bagikan via WhatsApp"
        >
          {whatsappIcon}
        </a>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(buildUrl())}&text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-sky-500 hover:border-sky-300 shadow-sm flex items-center justify-center transition-colors"
          aria-label="Bagikan ke Twitter / X"
        >
          {twitterIcon}
        </a>
        <button
          onClick={copyLink}
          className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-300 shadow-sm flex items-center justify-center transition-colors"
          aria-label="Salin tautan artikel"
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile & tablet: floating share button */}
      <div className="xl:hidden fixed bottom-24 right-4 z-50">
        <button
          onClick={shareTo}
          className="w-11 h-11 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Bagikan artikel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
        </button>
      </div>
    </>
  );
}