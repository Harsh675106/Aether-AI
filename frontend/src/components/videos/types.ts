export type VideoResult = {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  video_url: string;
  platform: string;
  description?: string | null;
  duration?: string | null;
  duration_seconds?: number | null;
  published_at?: string | null;
  creator?: string | null;
  score?: number;
  metadata?: Record<string, unknown>;
  saved_at?: string;
};

export type VideoSearchResponse = {
  query: string;
  page: number;
  has_more: boolean;
  provider: string;
  results: VideoResult[];
};

export type VideoSearchView = "search" | "saved";
