// src/components/feed/FeedCard.d.ts
// Deklarasi type agar Astro LSP mengenali props FeedCard (file .jsx murni).

import type { FC, Key } from "react";

declare module "@/components/feed/FeedCard" {
  export type FeedPost = {
    id: string;
    slug?: string;
    title: string;
    youtube_url?: string;
    media_url?: string;
    category?: string;
    post_type?: string;
    is_featured?: boolean;
    published_at?: string;
    feed_comments?: [{ count: number }];
  };

  // key adalah props khusus JSX — dideklarasikan eksplisit agar LSP
  // tidak memunculkan "Property 'key' does not exist".
  export const FeedCard: FC<{ post: FeedPost; key?: Key }>;
  export function getYouTubeId(url: string): string | null;
  export function formatDate(dateStr: string): string;
  export function stripHtml(html: string): string;
}