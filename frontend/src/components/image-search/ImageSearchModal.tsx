import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Images,
  Loader2,
  X,
} from "lucide-react";

import { useImageSearch } from "./ImageSearchProvider";
import { publishVoiceMonitoringEvent } from "@/voice/monitoring";
import { openExternalLink } from "@/components/chat/Markdown/blocks/CustomLink";

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

const API_URL = import.meta.env.VITE_AETHER_API_URL ?? "http://localhost:8001/api/v1";
function safeFilename(title: string) {
  return (title || "image").replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export function ImageSearchModal() {
  const { viewer, close, setActiveIndex } = useImageSearch();
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [errored, setErrored] = useState<Record<string, boolean>>({});
  const [copyState, setCopyState] = useState<string | null>(null);

  const activeImage = viewer.results[viewer.activeIndex] ?? null;

  useEffect(() => {
    if (!viewer.isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex(viewer.activeIndex - 1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex(viewer.activeIndex + 1);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, setActiveIndex, viewer.activeIndex, viewer.isOpen]);

  useEffect(() => {
    setLoaded({});
    setErrored({});
    setCopyState(null);
  }, [viewer.results, viewer.isOpen]);

  const canPrev = viewer.activeIndex > 0;
  const canNext = viewer.activeIndex < viewer.results.length - 1;

  const updateCopyState = (label: string) => {
    setCopyState(label);
    window.setTimeout(() => setCopyState((current) => (current === label ? null : current)), 1800);
  };

  const downloadImage = async () => {
    if (!activeImage) {
      return;
    }

    publishImageEvent("image_downloaded", "Image Download Requested", "The user started downloading an image.", {
      title: activeImage.title,
      image_url: activeImage.image_url,
      source_url: activeImage.source_url,
      source_site: activeImage.source_site,
    });

    try {
      const downloadUrl = API_URL + "/images/download?url=" + encodeURIComponent(activeImage.image_url);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = safeFilename(activeImage.title) + ".jpg";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      await openExternalLink(activeImage.image_url);
    }
  };

  const copyImageUrl = async () => {
    if (!activeImage) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeImage.image_url);
      updateCopyState("Copied URL");
      publishImageEvent("image_url_copied", "Image URL Copied", "The image URL was copied to the clipboard.", {
        title: activeImage.title,
        image_url: activeImage.image_url,
        source_site: activeImage.source_site,
      });
    } catch {
      updateCopyState("Copy failed");
    }
  };

  const openSource = () => {
    if (!activeImage) {
      return;
    }

    publishImageEvent("image_source_opened", "Source Opened", "The original source page was opened.", {
      title: activeImage.title,
      source_url: activeImage.source_url,
      source_site: activeImage.source_site,
    });
    void openExternalLink(activeImage.source_url);
  };

  const previewText = useMemo(() => {
    if (!activeImage) {
      return "Choose an image to preview it here.";
    }

    if (activeImage.width && activeImage.height) {
      return `${activeImage.width} x ${activeImage.height}`;
    }

    return activeImage.source_site;
  }, [activeImage]);

  return (
    <AnimatePresence>
      {viewer.isOpen && (
        <motion.div
        key="image-search-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-transparent p-3 sm:p-6"
        onClick={close}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={(event) => event.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[rgba(4,16,28,0.93)] shadow-[0_30px_120px_rgba(2,132,199,0.22)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.1),transparent_28%)]" />
          <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.42em] text-cyan-300/80">Image Viewer</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-white sm:text-2xl">{viewer.query || "Image Search"}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/45">
                {viewer.results.length} result{viewer.results.length === 1 ? "" : "s"}
                {viewer.requestSource ? ` · ${viewer.requestSource}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={close}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-cyan-400/15 hover:text-cyan-100"
              aria-label="Close image viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-5 lg:flex-row">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-transparent p-4">
              <div className="relative flex min-h-[18rem] flex-1 items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-transparent">
                {activeImage ? (
                  errored[activeImage.image_url] ? (
                    <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-white/70">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-400/20 bg-rose-500/10 text-rose-200">
                        <Images className="h-7 w-7" />
                      </div>
                      <p className="text-sm font-medium text-white">This image could not be loaded.</p>
                      <p className="text-xs text-white/50">The source may be blocked or temporarily unavailable.</p>
                    </div>
                  ) : (
                    <>
                      {!loaded[activeImage.image_url] && (
                        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-cyan-400/10 via-white/5 to-transparent" />
                      )}
                      <motion.img
                        key={activeImage.image_url}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        src={activeImage.image_url}
                        alt={activeImage.title}
                        loading="eager"
                        decoding="async"
                        onLoad={() => setLoaded((current) => ({ ...current, [activeImage.image_url]: true }))}
                        onError={() => {
                          setErrored((current) => ({ ...current, [activeImage.image_url]: true }));
                          publishImageEvent("image_error", "Image Load Failed", "The preview image failed to load.", {
                            title: activeImage.title,
                            image_url: activeImage.image_url,
                            source_url: activeImage.source_url,
                            source_site: activeImage.source_site,
                          });
                        }}
                        className="max-h-[62vh] max-w-full rounded-[1.25rem] object-contain shadow-[0_25px_80px_rgba(0,0,0,0.38)]"
                      />
                    </>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/60">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
                    <p className="text-sm">Loading images...</p>
                  </div>
                )}

                {canPrev && (
                  <button
                    type="button"
                    onClick={() => setActiveIndex(viewer.activeIndex - 1)}
                    className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/70 text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition hover:bg-cyan-500/20"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}

                {canNext && (
                  <button
                    type="button"
                    onClick={() => setActiveIndex(viewer.activeIndex + 1)}
                    className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/70 text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition hover:bg-cyan-500/20"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>

              {activeImage && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadImage}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={openSource}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Source
                  </button>
                  <button
                    type="button"
                    onClick={copyImageUrl}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/10"
                  >
                    {copyState === "Copied URL" ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                    {copyState ?? "Copy URL"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex min-h-0 w-full flex-col gap-4 overflow-hidden lg:w-[24rem] xl:w-[28rem]">
              <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4">
                <p className="text-[10px] uppercase tracking-[0.34em] text-cyan-300/80">Selected Image</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{activeImage?.title ?? "Choose an image"}</h3>
                <div className="mt-3 space-y-2 text-sm text-white/70">
                  <p><span className="text-white/45">Source:</span> {activeImage?.source_site ?? "Unknown"}</p>
                  <p><span className="text-white/45">Original:</span> {activeImage?.source_url ?? "-"}</p>
                  <p><span className="text-white/45">Image:</span> {activeImage?.image_url ?? "-"}</p>
                  <p><span className="text-white/45">Size:</span> {previewText}</p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-[10px] uppercase tracking-[0.34em] text-cyan-300/70">Gallery</p>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">{viewer.activeIndex + 1}/{viewer.results.length || 0}</p>
                </div>
                <div className="grid max-h-[38vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {viewer.results.map((item, index) => {
                    const active = index === viewer.activeIndex;
                    const isLoaded = loaded[item.preview_url] || loaded[item.image_url];
                    const hasError = errored[item.preview_url] || errored[item.image_url];
                    const thumb = item.preview_url || item.image_url;

                    return (
                      <button
                        type="button"
                        key={`${item.image_url}-${index}`}
                        onClick={() => setActiveIndex(index)}
                        className={`group relative overflow-hidden rounded-[1.2rem] border text-left transition duration-300 ${active ? "border-cyan-300/60 ring-2 ring-cyan-400/30" : "border-white/10 hover:border-cyan-300/30"}`}
                      >
                        <div className="aspect-[4/3] w-full bg-slate-900/80">
                          {!isLoaded && !hasError && <div className="absolute inset-0 animate-pulse bg-white/5" />}
                          {hasError ? (
                            <div className="flex h-full items-center justify-center text-white/35">
                              <Images className="h-6 w-6" />
                            </div>
                          ) : (
                            <img
                              src={thumb}
                              alt={item.title}
                              loading="lazy"
                              decoding="async"
                              onLoad={() => setLoaded((current) => ({ ...current, [thumb]: true }))}
                              onError={() => {
                                setErrored((current) => ({ ...current, [thumb]: true }));
                                publishImageEvent("image_error", "Image Load Failed", "A gallery thumbnail failed to load.", {
                                  title: item.title,
                                  image_url: item.image_url,
                                  source_url: item.source_url,
                                  source_site: item.source_site,
                                });
                              }}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                            />
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent p-2.5">
                          <p className="line-clamp-2 text-[11px] font-medium text-white/90">{item.title}</p>
                          <p className="mt-1 truncate text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">{item.source_site}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
