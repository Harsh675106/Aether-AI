import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { publishVoiceMonitoringEvent } from "@/voice/monitoring";
import type { ImageSearchPayload, ImageSearchViewerState } from "./types";

type ImageSearchContextValue = {
  viewer: ImageSearchViewerState;
  openResults: (payload: ImageSearchPayload) => void;
  close: () => void;
  setActiveIndex: (index: number) => void;
};

const defaultState: ImageSearchViewerState = {
  isOpen: false,
  query: "",
  requestSource: null,
  results: [],
  activeIndex: 0,
};

const noop = () => undefined;

const ImageSearchContext = createContext<ImageSearchContextValue>({
  viewer: defaultState,
  openResults: noop,
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

  const openResults = (payload: ImageSearchPayload) => {
    if (!payload.results.length) {
      return;
    }

    setViewer({
      isOpen: true,
      query: payload.query,
      requestSource: payload.request_source ?? null,
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
      openResults,
      close,
      setActiveIndex,
    }),
    [viewer]
  );

  return <ImageSearchContext.Provider value={value}>{children}</ImageSearchContext.Provider>;
}

export function useImageSearch() {
  return useContext(ImageSearchContext);
}