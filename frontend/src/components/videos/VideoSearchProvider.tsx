import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { apiDelete, apiGet, apiPost } from "@/services/apiClient";
import type { VideoResult, VideoSearchResponse, VideoSearchView } from "./types";
import { VideoSearchContext, type VideoSearchContextValue } from "./VideoSearchContext";


export function VideoSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<VideoSearchView>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [saved, setSaved] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [selected, setSelected] = useState<VideoResult | null>(null);
  const searchSequence = useRef(0);

  const search = useCallback(async (value: string, targetPage = 1) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const sequence = ++searchSequence.current;
    setLoading(true);
    setError(null);
    setView("search");
    setIsOpen(true);
    setQuery(trimmed);
    if (targetPage === 1) {
      setSelected(null);
      setRecentQueries((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 6));
    }
    try {
      const response = await apiPost<VideoSearchResponse>("/videos/search", {
        query: trimmed,
        page: targetPage,
        limit: 24,
      });
      if (sequence !== searchSequence.current) return;
      setResults((current) => {
        if (targetPage === 1) return response.results;
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...response.results.filter((item) => !existing.has(item.id))];
      });
      setPage(targetPage);
      setHasMore(response.has_more);
    } catch (caught) {
      if (sequence !== searchSequence.current) return;
      setError(caught instanceof Error ? caught.message : "Video search failed.");
      if (targetPage === 1) setResults([]);
    } finally {
      if (sequence === searchSequence.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !query) return;
    await search(query, page + 1);
  }, [hasMore, loading, page, query, search]);

  const showSaved = useCallback(async () => {
    setView("saved");
    setIsOpen(true);
    setSelected(null);
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<{ videos: VideoResult[] }>("/videos/saved");
      setSaved(response.videos);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load saved videos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSaved = useCallback(async () => {
    try {
      const response = await apiGet<{ videos: VideoResult[] }>("/videos/saved");
      setSaved(response.videos);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load saved videos.");
    }
  }, []);

  const save = useCallback(async (video: VideoResult) => {
    setError(null);
    try {
      const response = await apiPost<{ video: VideoResult }>("/videos/save", video);
      setSaved((current) => [
        response.video,
        ...current.filter((item) => item.id !== response.video.id),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this video.");
      throw caught;
    }
  }, []);

  const remove = useCallback(async (video: VideoResult) => {
    setError(null);
    try {
      await apiDelete<{ deleted: boolean }>(`/videos/saved/${encodeURIComponent(video.id)}`);
      setSaved((current) => current.filter((item) => item.id !== video.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove this video.");
      throw caught;
    }
  }, []);

  const select = useCallback((video: VideoResult) => {
    setSelected(video);
  }, []);

  const openCommandResults = useCallback((payload: Record<string, unknown>) => {
    searchSequence.current += 1;
    setError(null);
    if (payload.view === "saved") {
      void showSaved();
      return;
    }
    if (payload.view !== "results") return;
    const responseResults = Array.isArray(payload.results) ? payload.results as VideoResult[] : [];
    const commandQuery = typeof payload.query === "string" ? payload.query : "";
    setQuery(commandQuery);
    setResults(responseResults);
    setSelected(null);
    if (commandQuery.trim()) {
      setRecentQueries((current) => [
        commandQuery,
        ...current.filter((item) => item !== commandQuery),
      ].slice(0, 6));
    }
    setPage(typeof payload.page === "number" ? payload.page : 1);
    setHasMore(Boolean(payload.has_more));
    setView("search");
    setIsOpen(true);
  }, [showSaved]);

  const open = useCallback((initialQuery?: string) => {
    setIsOpen(true);
    setView("search");
    if (initialQuery) void search(initialQuery);
  }, [search]);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({
      isOpen,
      view,
      query,
      results,
      saved,
      loading,
      error,
      page,
      hasMore,
      recentQueries,
      selected,
      open,
      close,
      search,
      loadMore,
      showSaved,
      refreshSaved,
      save,
      remove,
      select,
      openCommandResults,
    }),
    [close, error, hasMore, isOpen, loadMore, loading, open, openCommandResults, page, query, recentQueries, refreshSaved, remove, results, save, saved, search, select, selected, showSaved, view],
  );

  return <VideoSearchContext.Provider value={value}>{children}</VideoSearchContext.Provider>;
}

