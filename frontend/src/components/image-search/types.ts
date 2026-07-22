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
  query: string;
  request_source?: string | null;
  provider?: string;
  results: ImageSearchResult[];
};

export type ImageSearchViewerState = {
  isOpen: boolean;
  query: string;
  requestSource: string | null;
  results: ImageSearchResult[];
  activeIndex: number;
};