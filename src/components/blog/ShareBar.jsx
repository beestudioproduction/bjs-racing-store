import React, { useState, useEffect, useCallback, useRef } from "react";

export default function ShareBar({ title, slug }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://bjsracing.com");
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mobileOpen]);

  const buildUrl = useCallback(() => `${origin}/blog/${slug}`, [origin, slug]);
  const text = `${title} — BJS Racing`;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [buildUrl]);

  const shareTo = useCallback(() => {
    const url = buildUrl();
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      setMobileOpen((o) => !o);
    }
  }, [buildUrl, title]);

  return (
    <>
      {/* ===== DESKTOP: inline share bar ===== */}
      <div className="hidden md:flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-6">
        <span className="text-sm font-semibold text-slate-700 mr-1">Bagikan</span>

        {/* WhatsApp */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text + " " + buildUrl())}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Bagikan via WhatsApp"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all duration-200 text-sm font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          WhatsApp
        </a>

        {/* X / Twitter */}
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(buildUrl())}&text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Bagikan ke X / Twitter"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 text-black hover:bg-black/10 transition-all duration-200 text-sm font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X
        </a>

        {/* Salin Tautan */}
        <button
          onClick={copyLink}
          aria-label="Salin tautan artikel"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer ${
            copied
              ? "bg-green-50 text-green-600"
              : "bg-orange-50 text-orange-600 hover:bg-orange-100"
          }`}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Tersalin!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Salin
            </>
          )}
        </button>
      </div>

      {/* ===== MOBILE: floating button + expandable panel ===== */}
      <div className="md:hidden fixed bottom-24 right-4 z-50" ref={panelRef}>
        {/* Expandable panel */}
        {mobileOpen && (
          <div className="absolute bottom-14 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 mb-2 w-48 animate-in slide-in-from-bottom-2 duration-200">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(text + " " + buildUrl())}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Bagikan via WhatsApp"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-700">WhatsApp</span>
            </a>

            {/* X / Twitter */}
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(buildUrl())}&text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Bagikan ke X / Twitter"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-700">X</span>
            </a>

            {/* Salin Tautan */}
            <button
              onClick={() => {
                copyLink();
                setTimeout(() => setMobileOpen(false), 800);
              }}
              aria-label="Salin tautan artikel"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-orange-50 transition-colors cursor-pointer"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${copied ? "bg-green-500" : "bg-orange-500"}`}>
                {copied ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium text-slate-700">{copied ? "Tersalin!" : "Salin Link"}</span>
            </button>
          </div>
        )}

        {/* Floating trigger button */}
        <button
          onClick={shareTo}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all duration-200 cursor-pointer ${
            mobileOpen
              ? "bg-slate-800 text-white rotate-45"
              : "bg-orange-500 text-white"
          }`}
          aria-label="Bagikan artikel"
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
