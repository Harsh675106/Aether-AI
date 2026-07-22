import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { publishVoiceMonitoringEvent } from "@/voice/monitoring";
import type { ImageSearchPayload, ImageSearchViewerState } from "./types";

import { apiGet } from '@/services/apiClient';
import type { ImageSearchHistoryEntry } from './types';

type ImageSearchContextValue = { 
  viewer: ImageSearchViewerState;
  history: ImageSearchHistoryEntry[];
  openResults: (payload: ImageSearchPayload) => void;
  openHistory: () => Promise<void>;
  openHistoryEntry: (entry: ImageSearchHistoryEntry) => void;
  close: () => void;
  setActiveIndex: (index: number) => void;
};

const defaultState: ImageSearchViewerState = {
  isOpen: false,
  requestId: null,
  query: "",
  requestSource: null,
  createdAt: null,
  results: [],
  activeIndex: 0,
};

const noop = () => undefined;

const ImageSearchContext = createContext<ImageSearchContextValue>({
  viewer: defaultState,
  history: [],
  openResults: noop,
  openHistory: async () => undefined,
  openHistoryEntry: noop,
  close: noop,
  setActiveIndex: noop,
});

function publishImageEvent(event_type: string, title: string, description: string, details: Record<string, unknown>) {
  publishVoiceMonitoringEvent({
    event_type,
    subsystem: "images",
    severity: "info",
    category: "image",
    title,
    description,
    status: "running",
    details,
  });
}

export function ImageSearchProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<ImageSearchViewerState>(defaultState);
  const [history, setHistory] = useState<ImageSearchHistoryEntry[]>([]);

  const openHistoryEntry = (entry: ImageSearchHistoryEntry) => {
    if (!entry.results.length) return;
    setViewer({
      isOpen: true,
      requestId: entry.request_id,
      query: entry.query,
      requestSource: entry.request_source ?? null,
      createdAt: entry.created_at ?? null,
      results: entry.results,
      activeIndex: 0,
    });
  };

  const openHistory = async () => {
    try {
      const response = await apiGet<{ entries: ImageSearchHistoryEntry[] }>('/images/history?limit=24');
      const entries = response.entries ?? [];
      setHistory(entries);
      const available = entries.filter((entry) => entry.results?.length);
      if (!available.length) return;
      const currentIndex = available.findIndex((entry) => entry.request_id === viewer.requestId);
      const nextEntry = currentIndex >= 0 ? available[(currentIndex + 1) % available.length] : available[0];
      if (nextEntry) openHistoryEntry(nextEntry);
    } catch (error) {
      console.error('Unable to load image history', error);
    }
  };

  const openResults = (payload: ImageSearchPayload) => {
    if (!payload.results.length) {
      return;
    }

    setViewer({
      isOpen: true,
      requestId: payload.request_id ?? null,
      query: payload.query,
      requestSource: payload.request_source ?? null,
      createdAt: payload.created_at ?? null,
      results: payload.results,
      activeIndex: 0,
    });

    publishImageEvent("image_popup_opened", "Image Viewer Opened", "The image gallery popup is now visible.", {
      query: payload.query,
      request_source: payload.request_source ?? null,
      result_count: payload.results.length,
      provider: payload.provider ?? "searxng",
    });
  };

  const close = () => {
    setViewer((current) => ({ ...current, isOpen: false }));
    publishImageEvent("image_popup_closed", "Image Viewer Closed", "The image gallery popup was dismissed.", {
      query: viewer.query,
      request_source: viewer.requestSource,
      result_count: viewer.results.length,
    });
  };

  const setActiveIndex = (index: number) => {
    setViewer((current) => {
      const nextIndex = Math.max(0, Math.min(index, current.results.length - 1));
      const next = { ...current, activeIndex: nextIndex };
      const item = current.results[nextIndex];
      if (item) {
        publishImageEvent("image_preview_opened", "Image Preview Opened", "A larger preview was opened in the viewer.", {
          query: current.query,
          request_source: current.requestSource,
          index: nextIndex,
          title: item.title,
          source_site: item.source_site,
        });
      }
      return next;
    });
  };

  const value = useMemo(
    () => ({
      viewer,
      history,
      openResults,
      openHistory,
      openHistoryEntry,
      close,
      setActiveIndex,
    }),
    [history, viewer]
  );

  return <ImageSearchContext.Provider value={value}>{children}</ImageSearchContext.Provider>;
}

export function useImageSearch() {
  return useContext(ImageSearchContext);
}
