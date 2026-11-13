import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Check,
  Clock3,
  ExternalLink,
  Loader2,
  Play,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";

import { useVideoSearch } from "./VideoSearchContext";
import type { VideoResult } from "./types";
import { useBrowserStore } from "@/stores/browserStore";

type PlatformFilter = "all" | "youtube" | "other";
type DurationFilter = "all" | "short" | "medium" | "long";
type SortOrder = "relevance" | "recent";

function isYouTube(video: VideoResult) {
  try {
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(new URL(video.video_url).hostname);
  } catch {
    return false;
  }
}

function durationBucket(seconds?: number | null): DurationFilter | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  if (seconds < 4 * 60) return "short";
  if (seconds <= 20 * 60) return "medium";
  return "long";
}

function formatPublished(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function VideoCard({
  video,
  isSaved,
  onSave,
  onRemove,
  onOpen,
}: {
  video: VideoResult;
  isSaved: boolean;
  onSave: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const published = formatPublished(video.published_at);

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-[0_12px_42px_rgba(2,8,23,0.28)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:shadow-[0_18px_48px_rgba(8,145,178,0.16)]">
      <div className="relative aspect-video overflow-hidden bg-slate-900">
        {video.thumbnail_url && !thumbnailFailed ? (
          <img
            src={video.thumbnail_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setThumbnailFailed(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
            <Video className="h-10 w-10 text-cyan-200/50" />
          </div>
        )}
        {video.duration && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-1 text-[11px] font-semibold text-white">
            {video.duration}
          </span>
        )}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${video.title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100 focus-visible:bg-black/30 focus-visible:opacity-100"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-cyan-400/90 text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.45)]">
            <Play className="ml-1 h-6 w-6 fill-current" />
          </span>
        </button>
        <button
          type="button"
          onClick={isSaved ? onRemove : onSave}
          aria-label={isSaved ? "Remove from saved videos" : "Save video"}
          title={isSaved ? "Remove from Saved Videos" : "Save video"}
          className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition ${
            isSaved
              ? "border-cyan-300/50 bg-cyan-400/25 text-cyan-100"
              : "border-white/20 bg-black/50 text-white hover:border-cyan-300/50 hover:bg-cyan-400/20"
          }`}
        >
          {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-left">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white transition group-hover:text-cyan-100">
              {video.title}
            </h3>
          </button>
          {isSaved && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove saved video"
              className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:bg-rose-400/10 hover:text-rose-200"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200/75">
          <span>{video.platform}</span>
          {video.creator && <><span className="text-white/25">•</span><span className="normal-case tracking-normal text-white/55">{video.creator}</span></>}
          {published && <><span className="text-white/25">•</span><span className="normal-case tracking-normal text-white/45">{published}</span></>}
        </p>
        {video.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300/65">{video.description}</p>
        )}
      </div>
    </article>
  );
}

export function VideosModal() {
  const videos = useVideoSearch();
  const browser = useBrowserStore();
  const { isOpen, view, refreshSaved } = videos;
  const [draft, setDraft] = useState(videos.query);
  const [savedQuery, setSavedQuery] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [duration, setDuration] = useState<DurationFilter>("all");
  const [sort, setSort] = useState<SortOrder>("relevance");

  useEffect(() => {
    setDraft(videos.query);
  }, [videos.query]);

  useEffect(() => {
    if (!isOpen || view !== "search") return;
    void refreshSaved();
  }, [isOpen, refreshSaved, view]);

  const filteredResults = useMemo(() => {
    if (videos.view === "saved") {
      return videos.saved.filter((item) =>
        `${item.title} ${item.description ?? ""} ${item.creator ?? ""}`
          .toLowerCase()
          .includes(savedQuery.toLowerCase()),
      );
    }
    const source = videos.results;
    const filtered = source.filter((video) => {
      if (platform === "youtube" && !isYouTube(video)) return false;
      if (platform === "other" && isYouTube(video)) return false;
      if (duration !== "all" && durationBucket(video.duration_seconds) !== duration) return false;
      const publishedTime = Date.parse(video.published_at ?? "");
      if (sort === "recent" && (!Number.isFinite(publishedTime) || publishedTime < Date.now() - 30 * 24 * 60 * 60 * 1000)) return false;
      return true;
    });
    if (sort === "recent") {
      filtered.sort((left, right) => Date.parse(right.published_at ?? "") - Date.parse(left.published_at ?? ""));
    }
    return filtered;
  }, [duration, platform, savedQuery, sort, videos.results, videos.saved, videos.view]);

  const savedIds = useMemo(() => new Set(videos.saved.map((video) => video.id)), [videos.saved]);

  const openVideo = async (video: VideoResult) => {
    try {
      const url = new URL(video.video_url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported video URL");
      videos.select(video);
      if (browser.state.isOpen) {
        await browser.navigateBrowser(url.toString());
        if (!browser.state.isVisible) await browser.showBrowser();
      } else {
        await browser.openBrowser(url.toString());
      }
    } catch (error) {
      console.error("Unable to open video in Aether browser", error);
    }
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void videos.search(draft);
  };

  const toggleSave = async (video: VideoResult) => {
    try {
      if (savedIds.has(video.id)) await videos.remove(video);
      else await videos.save(video);
    } catch {
      // The provider exposes the API error in the modal.
    }
  };

  const recentThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const hasRecentResults = (videos.view === "saved" ? videos.saved : videos.results)
    .some((video) => video.published_at && Date.parse(video.published_at) >= recentThreshold);

  return (
    <AnimatePresence>
      {videos.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-5"
          onClick={videos.close}
        >
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(event) => event.stopPropagation()}
            aria-label="Video discovery"
            className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[1.8rem] border border-cyan-300/20 bg-[rgba(4,13,26,0.97)] shadow-[0_30px_120px_rgba(2,132,199,0.2)]"
          >
            <header className="relative border-b border-white/10 p-4 sm:px-7 sm:py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.38em] text-cyan-200/75">
                    <Video className="h-4 w-4" /> Aether Discovery
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                    {videos.view === "saved" ? "Saved Videos" : "Video Search"}
                  </h2>
                </div>
                <button type="button" onClick={videos.close} aria-label="Close Videos" className="rounded-full border border-white/10 p-2 text-white/65 transition hover:border-white/30 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {videos.view === "search" ? (
                <form onSubmit={handleSearch} className="mt-4 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/55" />
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Search videos, tutorials, creators..."
                      aria-label="Search videos"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/45 focus:bg-white/[0.07]"
                    />
                  </div>
                  <button type="submit" disabled={!draft.trim() || videos.loading} className="inline-flex h-12 items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/15 px-5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-50">
                    {videos.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="hidden sm:inline">Search</span>
                  </button>
                </form>
              ) : (
                <div className="mt-4 flex gap-2">
                  <input value={savedQuery} onChange={(event) => setSavedQuery(event.target.value)} placeholder="Search saved videos..." aria-label="Search saved videos" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-cyan-300/40" />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => videos.view === "saved" ? videos.open(videos.query || undefined) : void videos.showSaved()} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${videos.view === "saved" ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"}`}>
                  {videos.view === "saved" ? "Search Videos" : `Saved Videos (${videos.saved.length})`}
                </button>
                {videos.view === "search" && <>
                  {videos.recentQueries.map((recent) => (
                    <button key={recent} type="button" onClick={() => { setDraft(recent); void videos.search(recent); }} className="max-w-40 truncate rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/55 transition hover:border-cyan-300/25 hover:text-cyan-100">{recent}</button>
                  ))}
                </>}
              </div>
              {videos.view === "search" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select aria-label="Platform filter" value={platform} onChange={(event) => setPlatform(event.target.value as PlatformFilter)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white/80">
                    <option value="all">All platforms</option><option value="youtube">YouTube</option><option value="other">Other platforms</option>
                  </select>
                  <select aria-label="Duration filter" value={duration} onChange={(event) => setDuration(event.target.value as DurationFilter)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white/80">
                    <option value="all">Any duration</option><option value="short">Short (&lt; 4 min)</option><option value="medium">Medium (4–20 min)</option><option value="long">Long (&gt; 20 min)</option>
                  </select>
                  <select aria-label="Sort videos" value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white/80">
                    <option value="relevance">Relevance</option>
                    <option value="recent" disabled={!hasRecentResults}>Recently published</option>
                  </select>
                  {videos.query && <span className="ml-auto text-xs text-white/40">{videos.query} · {filteredResults.length} shown</span>}
                </div>
              )}
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              {videos.error && <div role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{videos.error}</div>}
              {videos.loading && filteredResults.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-cyan-100/70">
                  <Loader2 className="h-8 w-8 animate-spin" /><span className="text-xs uppercase tracking-[0.25em]">Discovering videos</span>
                </div>
              ) : filteredResults.length ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredResults.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        isSaved={savedIds.has(video.id)}
                        onOpen={() => void openVideo(video)}
                        onSave={() => void toggleSave(video)}
                        onRemove={() => void toggleSave(video)}
                      />
                    ))}
                  </div>
                  {videos.view === "search" && videos.hasMore && (
                    <div className="mt-7 flex justify-center">
                      <button type="button" onClick={() => void videos.loadMore()} disabled={videos.loading} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-5 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50">
                        {videos.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />} Load more
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <Video className="h-10 w-10 text-cyan-200/40" />
                  <p className="mt-4 text-sm font-medium text-white/75">{videos.view === "saved" ? "No saved videos found" : videos.query ? "No videos found for this search" : "Search for something to watch"}</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-white/40">{videos.view === "saved" ? "Bookmark a video to keep its link and details here." : "Search results come from your configured SearXNG video engines."}</p>
                  {videos.view === "search" && videos.query && <ExternalLink className="mt-3 h-4 w-4 text-white/20" />}
                </div>
              )}
            </main>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
