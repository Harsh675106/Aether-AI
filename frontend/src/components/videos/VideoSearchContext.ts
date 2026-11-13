import { createContext, useContext } from "react";

import type { VideoResult, VideoSearchView } from "./types";

export type VideoSearchContextValue = {
  isOpen: boolean;
  view: VideoSearchView;
  query: string;
  results: VideoResult[];
  saved: VideoResult[];
  loading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  recentQueries: string[];
  selected: VideoResult | null;
  open: (query?: string) => void;
  close: () => void;
  search: (query: string, page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  showSaved: () => Promise<void>;
  refreshSaved: () => Promise<void>;
  save: (video: VideoResult) => Promise<void>;
  remove: (video: VideoResult) => Promise<void>;
  select: (video: VideoResult) => void;
  openCommandResults: (payload: Record<string, unknown>) => void;
};

export const VideoSearchContext = createContext<VideoSearchContextValue | null>(null);

export function useVideoSearch() {
  const value = useContext(VideoSearchContext);
  if (!value) throw new Error("useVideoSearch must be used within VideoSearchProvider");
  return value;
}
