// RelatedPostCard.jsx — Kartu artikel terkait
import React from "react";
import OptimizedImage from "../OptimizedImage.jsx";

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)|(?:shorts\/))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7] && match[7].length === 11 ? match[7] : null;
};

function getDriveDirectUrl(url) {
  if (!url || !url.includes("drive.google.com")) return url;
  const idMatch = url.match(/[-\w]{25,}/);
  if (idMatch)
    return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
  return url;
}

const RelatedPostCard = ({ post }) => {
  const ytId = getYouTubeId(post.youtube_url);
  const mediaUrl = getDriveDirectUrl(post.media_url);
  const commentCount = post.feed_comments?.[0]?.count || 0;

  return (
    <article className="group block bg-white rounded-xl border border-slate-100 overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:border-orange-200 transition-all duration-200 cursor-pointer">
      <a href={`/blog/${post.slug || post.id}`} className="flex flex-col h-full">
        <div className="relative aspect-video bg-slate-900 overflow-hidden">
          {ytId ? (
            <OptimizedImage
              src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
              alt={post.title || "Video"}
              width={400}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : mediaUrl ? (
            <OptimizedImage
              src={mediaUrl}
              alt={post.title || "Feed image"}
              width={400}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
          )}
          {ytId && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
                <svg className="w-4 h-4 text-orange-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          <span className="text-[11px] text-slate-400 mb-1">
            {post.published_at
              ? new Date(post.published_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : ""}
          </span>
          <h3 className="font-bold text-sm text-slate-900 line-clamp-2 group-hover:text-orange-600 transition-colors leading-snug mb-2 flex-1">
            {post.title}
          </h3>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {commentCount}
          </div>
        </div>
      </a>
    </article>
  );
};

export default RelatedPostCard;
