// BlogSkeleton.jsx — Loading skeleton untuk blog index
import React from "react";

const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden animate-pulse">
    <div className="aspect-video bg-slate-200" />
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="h-5 w-16 bg-slate-200 rounded-md" />
        <div className="h-5 w-20 bg-slate-100 rounded-md" />
      </div>
      <div className="h-5 bg-slate-200 rounded w-full mb-1.5" />
      <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-full mb-1" />
      <div className="h-3 bg-slate-100 rounded w-2/3 mb-3" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 bg-slate-100 rounded" />
        <div className="h-3 w-12 bg-slate-100 rounded" />
      </div>
    </div>
  </div>
);

const BlogSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default BlogSkeleton;
