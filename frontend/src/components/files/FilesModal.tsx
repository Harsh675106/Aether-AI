import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Download,
  Eye,
  FileImage,
  FolderOpen,
  Globe,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { useFiles } from "./FilesProvider";
import type { StoredScreenshot } from "./types";

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
      " • " +
      d.toLocaleDateString();
  } catch {
    return isoString;
  }
}

function safeFilename(title: string): string {
  const base = (title || "screenshot").replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_");
  return `${base}.png`;
}

function downloadScreenshot(item: StoredScreenshot) {
  const link = document.createElement("a");
  link.href = item.image_data;
  link.download = safeFilename(item.title);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function FilesModal() {
  const {
    isOpen,
    screenshots,
    isLoading,
    activeScreenshot,
    closeFiles,
    loadScreenshots,
    deleteScreenshot,
    setActiveScreenshot,
  } = useFiles();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeScreenshot) {
          setActiveScreenshot(null);
        } else {
          closeFiles();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeScreenshot, closeFiles, setActiveScreenshot]);

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setDeletingId(id);
    await deleteScreenshot(id);
    setDeletingId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeFiles}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-white/15 bg-[rgba(8,14,28,0.85)] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(56,189,248,0.12)] backdrop-blur-2xl"
          >
            {/* Top Glowing Accents */}
            <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 opacity-90" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_35%)]" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-wide text-white">Files & Memory</h2>
                    <span className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300">
                      {screenshots.length} {screenshots.length === 1 ? "Screenshot" : "Screenshots"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Browser viewport captures stored directly in memory (zero disk clutter)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadScreenshots()}
                  disabled={isLoading}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  title="Refresh in-memory screenshots"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={closeFiles}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-400"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="relative z-10 flex-1 overflow-y-auto p-6">
              {isLoading && screenshots.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                  <p className="text-sm">Loading in-memory screenshots...</p>
                </div>
              ) : screenshots.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-slate-900/40 text-slate-500 shadow-inner">
                    <FileImage className="h-8 w-8 text-sky-400/60" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-base font-medium text-slate-200">No screenshots stored in memory</h3>
                    <p className="mt-1.5 text-xs text-slate-400">
                      When browsing websites or commanding Aether, ask:
                      <br />
                      <span className="font-mono text-sky-300">"take a screenshot"</span> or{" "}
                      <span className="font-mono text-sky-300">"capture screen"</span>.
                      <br />
                      The viewport will be captured and presented here with full delete options.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {screenshots.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-md transition-all duration-300 hover:border-sky-400/40 hover:bg-slate-900/80 hover:shadow-[0_8px_30px_rgba(56,189,248,0.12)]"
                    >
                      {/* Image Preview */}
                      <div
                        onClick={() => setActiveScreenshot(item)}
                        className="relative aspect-video w-full cursor-pointer overflow-hidden bg-slate-950/60"
                      >
                        <img
                          src={item.image_data}
                          alt={item.title}
                          className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                        {/* Hover Overlay Eye Icon */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
                          <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
                            <Eye className="h-3.5 w-3.5 text-sky-400" /> View full
                          </span>
                        </div>
                      </div>

                      {/* Card Content & Metadata */}
                      <div className="flex flex-1 flex-col justify-between p-3.5">
                        <div>
                          <h4
                            className="truncate text-sm font-medium text-slate-100"
                            title={item.title}
                          >
                            {item.title}
                          </h4>
                          {item.url && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-sky-300/80">
                              <Globe className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.url}</span>
                            </div>
                          )}
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{formatTimestamp(item.created_at)}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
                          <button
                            type="button"
                            onClick={() => downloadScreenshot(item)}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300"
                            title="Download PNG to your computer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download</span>
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={(e) => void handleDelete(item.id, e)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-300 transition hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-200"
                            title="Delete screenshot from memory"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            )}
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Lightbox / Expanded View */}
            <AnimatePresence>
              {activeScreenshot && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex flex-col bg-slate-950/95 backdrop-blur-xl"
                >
                  {/* Lightbox Header */}
                  <div className="flex items-center justify-between border-b border-white/10 px-6 py-3.5">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-semibold text-white">{activeScreenshot.title}</h3>
                      {activeScreenshot.url && (
                        <span className="text-xs text-sky-400/80">{activeScreenshot.url}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadScreenshot(activeScreenshot)}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-white"
                      >
                        <Download className="h-4 w-4 text-sky-400" />
                        <span>Download</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(activeScreenshot.id)}
                        className="flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-200"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <span>Delete</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveScreenshot(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Lightbox Image Preview */}
                  <div className="flex flex-1 items-center justify-center overflow-auto p-4">
                    <img
                      src={activeScreenshot.image_data}
                      alt={activeScreenshot.title}
                      className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

