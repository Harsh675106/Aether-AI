export type ImageSearchResult = {
  title: string;
  preview_url: string;
  image_url: string;
  source_url: string;
  source_site: string;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
  score?: number;
  provider?: string;
  thumbnail_url?: string | null;
  details?: Record<string, unknown>;
};

export type ImageSearchPayload = {
  request_id?: string | null;
  query: string;
  request_source?: string | null;
  conversation_id?: string | null;
  created_at?: string | null;
  provider?: string;
  results: ImageSearchResult[];
};

export type ImageSearchHistoryEntry = ImageSearchPayload & {
  request_id: string;
  created_at: string;
};

export type ImageSearchViewerState = {
  isOpen: boolean;
  requestId: string | null;
  query: string;
  requestSource: string | null;
  createdAt: string | null;
  results: ImageSearchResult[];
  activeIndex: number;
};
