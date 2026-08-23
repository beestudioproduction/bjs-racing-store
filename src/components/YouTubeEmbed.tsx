// src/components/YouTubeEmbed.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { FiPlay } from "react-icons/fi";

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  product?: string;
  showInfo?: boolean;
  isActive?: boolean;
  onPlay?: () => void;
}

/**
 * Reusable YouTube player with click-to-play thumbnail.
 */
const YouTubeEmbed = ({ videoId, title, product, showInfo = true, isActive, onPlay }: YouTubeEmbedProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&origin=${typeof window !== 'undefined' ? window.location.origin : 'https://bjsracing.com'}`;

  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
      onPlay?.();
    } else if (isPlaying) {
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handleThumbError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const src = e.currentTarget.src;
    if (src.includes("maxresdefault")) {
      e.currentTarget.src = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
    } else if (src.includes("sddefault")) {
      e.currentTarget.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
  }, [videoId]);

  return (
    <div className="w-full">
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 group">
        {isPlaying ? (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            onClick={handlePlay}
            className="absolute inset-0 w-full h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-inset"
            aria-label={`Putar video: ${title}`}
          >
            <img
              src={thumbnailUrl}
              alt={title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={handleThumbError}
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-200" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 mobile:w-12 mobile:h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
                <FiPlay className="w-4 h-4 mobile:w-5 mobile:h-5 text-orange-600 ml-0.5" />
              </div>
            </div>
          </button>
        )}
      </div>

      {showInfo && (
        <div className="mt-3 px-1">
          <h3 className="text-xs mobile:text-sm font-semibold text-slate-800 line-clamp-2">
            {title}
          </h3>
          {product && (
            <p className="text-xs mobile:text-xs text-orange-600 font-medium mt-0.5">
              {product}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default YouTubeEmbed;
