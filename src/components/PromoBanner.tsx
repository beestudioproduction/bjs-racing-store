// src/components/PromoBanner.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseBrowserClient";
import OptimizedImage from "./OptimizedImage.jsx";

const FALLBACK_SLIDES = [
  {
    id: "fallback-1",
    title: "Promo Spesial Racing Gear",
    subtitle: "Diskon hingga 30% untuk helm dan jaket racing",
    cta_text: "Belanja Sekarang",
    cta_href: "/katalog-warna",
    bg_gradient: "from-slate-900 via-slate-800 to-slate-900",
    image_url: null,
  },
  {
    id: "fallback-2",
    title: "Ongkir Gratis Area Lokal",
    subtitle: "Gratis ongkir untuk area internal BJS Racing",
    cta_text: "Lihat Syarat",
    cta_href: "/",
    bg_gradient: "from-orange-600 via-orange-500 to-orange-600",
    image_url: null,
  },
  {
    id: "fallback-3",
    title: "New Arrival: Lift Kit & Onderdil",
    subtitle: "Perangkat underbone terbaru sudah tersedia",
    cta_text: "Lihat Katalog",
    cta_href: "/onderdil",
    bg_gradient: "from-blue-700 via-blue-600 to-blue-700",
    image_url: null,
  },
];

const SLIDE_DURATION = 5000;
const SWIPE_THRESHOLD = 50;

const RacingPattern = () => (
  <svg
    className="absolute inset-0 w-full h-full opacity-[0.07]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern
        id="racing-grid"
        x="0"
        y="0"
        width="60"
        height="60"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M0 30 L30 0 L60 30 L30 60 Z"
          fill="none"
          stroke="white"
          strokeWidth="1"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#racing-grid)" />
  </svg>
);

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_href: string;
  bg_gradient?: string;
  image_url?: string | null;
}

const PromoBanner = ({ slides: initialSlides = [] }: { slides?: Slide[] }) => {
  const [slides, setSlides] = useState<Slide[]>(
    initialSlides.length > 0 ? initialSlides : FALLBACK_SLIDES
  );
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const timerRef = useRef<number | null>(null);
  const dragState = useRef({ startX: 0, startY: 0, isDragging: false });

  useEffect(() => {
    const fetchFreshPromos = async () => {
      try {
        const { data, error } = await supabase
          .from("promos")
          .select(
            "id, title, subtitle, cta_text, cta_href, image_url, bg_gradient, sort_order, valid_from, valid_until"
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(7);

        if (error) throw error;

        const now = new Date();
        const active = (data || []).filter((p) => {
          const from = p.valid_from ? new Date(p.valid_from) : null;
          const until = p.valid_until ? new Date(p.valid_until) : null;
          return (!from || from <= now) && (!until || until >= now);
        });

        // SELALU perbarui slide: jangan biarkan snapshot prerender (yang bisa
        // berisi promo kedaluarsa) bertahan. Bila tidak ada promo aktif,
        // gunakan FALLBACK_SLIDES agar banner tidak menampilkan promo kedaluarsa.
        setSlides(active.length > 0 ? active : FALLBACK_SLIDES);
      } catch (err) {
        // Biarkan initialSlides tetap jika gagal sementara (SSR benar → aman),
        // tapi jangan memaksakan data kedaluarsa.
      }
    };

    fetchFreshPromos();
  }, []);

  useEffect(() => {
    setIndex((prev) => (prev >= slides.length ? 0 : prev));
  }, [slides.length]);

  const goTo = useCallback(
    (next?: number) => {
      setIndex((prev) => {
        const nextIndex = typeof next === "number" ? next : (prev + 1) % slides.length;
        return nextIndex;
      });
      setProgressKey((k) => k + 1);
    },
    [slides.length],
  );

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setProgressKey((k) => k + 1);
  }, [slides.length]);

  const goNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % slides.length);
    setProgressKey((k) => k + 1);
  }, [slides.length]);

  const handleDragStart = (clientX: number, clientY: number) => {
    if (slides.length <= 1) return;
    dragState.current = { startX: clientX, startY: clientY, isDragging: true };
  };

  const handleDragMove = (_clientX: number, _clientY: number) => {
    if (!dragState.current.isDragging) return;
  };

  const handleDragEnd = (clientX: number, clientY: number) => {
    if (!dragState.current.isDragging) return;
    const deltaX = clientX - dragState.current.startX;
    const deltaY = clientY - dragState.current.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > absY && absX > SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    dragState.current.isDragging = false;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    handleDragEnd(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (isPaused || slides.length <= 1) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
      setProgressKey((k) => k + 1);
    }, SLIDE_DURATION);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [isPaused, progressKey, slides.length]);

  const current = slides[index];
  const total = slides.length;
  const hasImage = !!current.image_url;

  return (
    <section
      className="w-full bg-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      role="region"
      aria-label="Promo banner carousel"
      aria-roledescription="carousel"
    >
      {/* Image Area */}
      <div
        className="relative w-full aspect-video overflow-hidden bg-slate-100 select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              slide.image_url
                ? ""
                : `bg-gradient-to-r ${slide.bg_gradient || "from-slate-900 via-slate-800 to-slate-900"}`
            } ${
              idx === index
                ? "opacity-100 translate-x-0 z-10"
                : idx < index
                  ? "opacity-0 -translate-x-full z-0"
                  : "opacity-0 translate-x-full z-0"
            }`}
          >
            {slide.image_url ? (
              <OptimizedImage
                src={slide.image_url}
                alt={slide.title}
                width={1200}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                <RacingPattern />
                <div className="absolute inset-0 bg-black/10" />
              </>
            )}
          </div>
        ))}

        {/* Dots on image */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => goTo(idx)}
                className={`rounded-full transition-all duration-200 cursor-pointer ${
                  idx === index
                    ? "bg-white w-6 h-2"
                    : "bg-white/50 hover:bg-white/80 w-2 h-2"
                }`}
                aria-label={`Slide ${idx + 1}`}
                aria-current={idx === index ? "true" : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content Area — below image */}
      <div className="w-full bg-white">
        <div className="max-w-6xl mx-auto px-3 md:px-5 py-4 md:py-5">
          <div
            key={index}
            className="animate-[fadeInUp_0.4s_ease-out]"
          >
            <h2 className="text-lg md:text-2xl font-bold text-slate-900 mb-1.5">
              {current.title}
            </h2>
            <p className="text-xs md:text-base text-slate-500 mb-4">
              {current.subtitle}
            </p>
            <div className="flex items-center justify-between">
              <a
                href={current.cta_href || "/"}
                className="inline-block bg-orange-500 text-white font-semibold px-4 py-2 md:px-5 md:py-2.5 rounded-lg hover:bg-orange-600 transition-colors duration-200 cursor-pointer shadow-sm text-xs md:text-base"
              >
                {current.cta_text || "Selengkapnya"}
              </a>
              {slides.length > 1 && (
                <span className="text-xs font-medium text-slate-400 tabular-nums">
                  {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {slides.length > 1 && (
          <div className="w-full h-1 bg-slate-100">
            <div
              key={progressKey}
              className="h-full bg-orange-500"
              style={{
                animation: `progressFill ${SLIDE_DURATION}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes progressFill {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
};

export default PromoBanner;
