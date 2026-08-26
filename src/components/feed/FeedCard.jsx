// src/components/feed/FeedCard.jsx
import React, { useState, useCallback } from "react";
import OptimizedImage from "../OptimizedImage.jsx";

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)|(?:shorts\/))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7] && match[7].length === 11 ? match[7] : null;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').slice(0, 200);
};

const getReadTime = (content) => {
  if (!content) return 1;
  const words = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
};

function getDriveDirectUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;
  const idMatch = url.match(/[-\w]{25,}/);
  if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
  return url;
}

function clampRatio(w, h) {
  if (!w || !h) return '16/9';
  const r = w / h;
  if (r < 0.5) return '1/2';
  if (r > 2) return '2/1';
  return `${w}/${h}`;
}

const FeedCard = ({ post }) => {
  const ytId = getYouTubeId(post.youtube_url);
  const rawMediaUrl = post.media_url;
  const mediaUrl = getDriveDirectUrl(rawMediaUrl);
  const hasMedia = !!mediaUrl;
  const readTime = getReadTime(post.content);
  const commentCount = post.feed_comments?.[0]?.count || 0;

  const isVideo = !!ytId || post.post_type === 'video';
  const isYouTube = !!ytId;

  const [dims, setDims] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const dynamicAspect = isYouTube ? '16/9' : (dims ? clampRatio(dims.width, dims.height) : '16/9');

  const handlePlayClick = useCallback((e) => {
    if (isNavigating) return;
    e.preventDefault();
    e.stopPropagation();
    setIsNavigating(true);
    const target = `/blog/${post.slug || post.id}`;
    setTimeout(() => { window.location.href = target; }, 400);
  }, [isNavigating, post.slug, post.id]);

  const handleImgLoad = useCallback((e) => {
    setDims({ width: e.target.naturalWidth, height: e.target.naturalHeight });
  }, []);

  const handleVideoLoad = useCallback((e) => {
    setDims({ width: e.target.videoWidth, height: e.target.videoHeight });
  }, []);

  return (
    <article className="group block bg-white rounded-xl border border-slate-100 overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:border-orange-200 transition-all duration-200 cursor-pointer">
      <a href={`/blog/${post.slug || post.id}`} className="flex flex-col h-full" onClick={isVideo ? handlePlayClick : undefined}>
        {/* Thumbnail — adaptive aspect ratio */}
        <div
          className="relative bg-slate-900 overflow-hidden"
          style={{ aspectRatio: dynamicAspect }}
        >
          {isYouTube ? (
            <OptimizedImage
              src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
              alt={post.title || 'Video'}
              width={400}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : hasMedia ? (
            <>
              {post.post_type === 'video' && mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                <video
                  src={mediaUrl}
                  onLoadedMetadata={handleVideoLoad}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                />
              ) : (
                <OptimizedImage
                  src={mediaUrl}
                  alt={post.title || 'Feed image'}
                  width={600}
                  onLoad={handleImgLoad}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
          )}

          {/* Video overlay: gradient + badges + title */}
          {isVideo && (
            <div className="absolute inset-0 flex flex-col justify-end">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* VIDEO badge — top-left */}
              <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 z-10">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                VIDEO
              </div>

              {/* Play button — center */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-20 h-20 text-white ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Bottom overlay: category + title + meta */}
              <div className="relative z-10 p-3">
                <span className="inline-block bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md mb-1.5">
                  {post.category || post.post_type || 'Artikel'}
                </span>
                <h3 className="font-bold text-yellow-400 text-sm line-clamp-2 leading-snug mb-1">
                  {post.title}
                </h3>
                <div className="flex items-center gap-2 text-white/70 text-[11px]">
                  <span>{readTime} menit baca</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {commentCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Non-video: play button for image posts with video URL */}
          {!isVideo && (
            <>
              {/* Category badge — top-left */}
              <div className="absolute top-2 left-2 z-10">
                <span className="bg-orange-50 text-orange-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-orange-100">
                  {post.category || post.post_type || 'Artikel'}
                </span>
              </div>
            </>
          )}

          {/* Loading spinner overlay — saat navigasi */}
          {isNavigating && (
            <div className="absolute inset-0 z-30 bg-slate-900/80 flex items-center justify-center">
              <div className="w-10 h-10 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Non-video content — below thumbnail */}
        {!isVideo && (
          <div className="p-4 flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-slate-400">{readTime} menit baca</span>
            </div>

            <h3 className="font-bold text-slate-900 mb-1.5 line-clamp-2 group-hover:text-orange-600 transition-colors leading-snug">
              {post.title}
            </h3>

            <p className="text-sm text-slate-500 line-clamp-2 mb-3 flex-1 leading-relaxed">
              {stripHtml(post.content)}
            </p>

            <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-2 border-t border-slate-50">
              <span>{formatDate(post.published_at)}</span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {commentCount}
              </span>
            </div>
          </div>
        )}
      </a>
    </article>
  );
};

export default FeedCard;
export { getYouTubeId, formatDate, stripHtml };
