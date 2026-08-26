// ArticleHero.jsx — Hero section untuk halaman artikel (dengan modal video)
import React, { useState, useCallback } from "react";

function getYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)|(?:shorts\/))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7] && match[7].length === 11 ? match[7] : null;
}

function getDriveDirectUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;
  const idMatch = url.match(/[-\w]{25,}/);
  if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
  return url;
}

function clampRatio(w, h) {
  if (!w || !h) return '16/9';
  const r = w / h;
  if (r < 0.5) return '0.5';
  if (r > 2) return '2';
  return `${w}/${h}`;
}

const ArticleHero = ({ title, mediaUrl, youtubeUrl, postType, isShort }) => {
  const ytId = getYouTubeId(youtubeUrl || '');
  const imageSrc = getDriveDirectUrl(mediaUrl || '');
  const isYouTube = !!ytId;

  const [dims, setDims] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const dynamicAspect = isYouTube
    ? (isShort ? '9/16' : '16/9')
    : (dims ? clampRatio(dims.width, dims.height) : '16/9');

  const handleImgLoad = useCallback((e) => {
    setDims({ width: e.target.naturalWidth, height: e.target.naturalHeight });
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // YouTube thumbnail
  const ytThumbnail = isYouTube ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;

  if (isYouTube) {
    return (
      <>
        {/* Thumbnail + play button — tampil saat belum play */}
        {!isPlaying && (
          <div
            className="relative w-full bg-slate-900 rounded-xl overflow-hidden mb-6 cursor-pointer group"
            style={{ aspectRatio: dynamicAspect }}
            onClick={handlePlay}
          >
            {ytThumbnail && (
              <img
                src={ytThumbnail}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="eager"
              />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-200">
                <svg className="w-7 h-7 text-orange-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* YouTube badge */}
            <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              VIDEO
            </div>
          </div>
        )}

        {/* Modal — tampil saat play */}
        {isPlaying && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={handleClose}>
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Tutup video"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Iframe */}
            <div
              className="relative w-full max-w-3xl bg-black rounded-xl overflow-hidden"
              style={{ aspectRatio: isShort ? '9/16' : '16/9' }}
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&modestbranding=1&rel=0&fs=0&playsinline=1&iv_load_policy=3&disablekb=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                className="w-full h-full"
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Image — adaptive aspect ratio
  if (imageSrc) {
    const imgAspect = dims ? clampRatio(dims.width, dims.height) : '16/9';
    return (
      <div
        className="w-full bg-slate-100 rounded-xl overflow-hidden mb-6"
        style={{ aspectRatio: imgAspect }}
      >
        <img
          src={imageSrc}
          alt={title}
          className="w-full h-full object-cover"
          width={800}
          height={450}
          loading="eager"
          onLoad={handleImgLoad}
        />
      </div>
    );
  }

  return null;
};

export default ArticleHero;
