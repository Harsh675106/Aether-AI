import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { apiGet } from "@/services/apiClient";

type MemoryItem = {
  id: string;
  content: string;
  source: string;
  conversation_id?: string | null;
  created_at?: string | null;
  distance?: number | null;
};

type MemoryResponse = {
  memories: MemoryItem[];
  count: number;
  query?: string;
};

type MemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function MemoryModal({ isOpen, onClose }: MemoryModalProps) {
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadMemories = useCallback(async (searchQuery = "") => {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    const path = searchQuery
      ? `/memory/search?q=${encodeURIComponent(searchQuery)}&limit=50`
      : "/memory?limit=100";
    try {
      const response = await apiGet<MemoryResponse>(path);
      if (request !== requestId.current) return;
      setMemories(response.memories ?? []);
      setCount(response.count ?? response.memories?.length ?? 0);
    } catch (caught) {
      if (request !== requestId.current) return;
      setError(caught instanceof Error ? caught.message : "Unable to load Aether memories.");
      setMemories([]);
      setCount(0);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void loadMemories();
    else requestId.current += 1;
  }, [isOpen, loadMemories]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized) void loadMemories(normalized);
    else void loadMemories();
  };

  const showAll = () => {
    setQuery("");
    void loadMemories();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-md sm:p-6"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-title"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-violet-200/20 bg-[rgba(6,12,27,0.97)] text-white shadow-[0_35px_120px_rgba(91,33,182,0.2)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(167,139,250,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.09),transparent_35%)]" />
            <header className="relative border-b border-white/10 px-5 py-5 sm:px-8 sm:py-7">
              <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-200/20 bg-gradient-to-br from-violet-300/20 to-cyan-300/10 text-violet-100 shadow-[0_0_26px_rgba(167,139,250,0.13)]">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.34em] text-violet-200/75">
                      <Sparkles className="h-3.5 w-3.5" /> Aether recall
                    </p>
                    <h2 id="memory-title" className="mt-1 text-2xl font-semibold tracking-tight text-white">
                      Memory
                    </h2>
                    <p className="mt-1 text-xs text-slate-300/55">
                      Personal facts and preferences Aether can recall in future conversations.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadMemories(query.trim())}
                    disabled={loading}
                    title="Refresh memories"
                    aria-label="Refresh memories"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:border-violet-200/25 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close memory"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:border-white/25 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSearch} className="mt-5 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200/50" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search what Aether remembers..."
                    aria-label="Search memory"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-violet-200/35 focus:bg-white/[0.07]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border border-violet-200/25 bg-violet-300/10 px-4 text-sm font-medium text-violet-100 transition hover:bg-violet-300/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline">Search</span>
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/40">
                <span>{query.trim() ? "Semantic search" : "All memories"}</span>
                <div className="flex items-center gap-3">
                  <span>{count} {count === 1 ? "memory" : "memories"}</span>
                  {query.trim() && (
                    <button type="button" onClick={showAll} className="text-violet-200/75 transition hover:text-violet-100">
                      Show all
                    </button>
                  )}
                </div>
              </div>
            </header>

            <main className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              {error && (
                <div role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}
              {loading && memories.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-violet-100/65">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-xs uppercase tracking-[0.24em]">Reaching into memory</span>
                </div>
              ) : memories.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {memories.map((memory, index) => (
                    <motion.article
                      key={memory.id || `${memory.content}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.025, 0.25), duration: 0.22 }}
                      className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 transition hover:border-violet-200/20 hover:bg-white/[0.055] sm:p-5"
                    >
                      <p className="text-sm leading-6 text-slate-100/90">{memory.content}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.07] pt-3 text-[10px] uppercase tracking-[0.13em] text-white/35">
                        <span className="rounded-full border border-violet-200/10 bg-violet-300/[0.06] px-2 py-1 text-violet-100/60">
                          {memory.source || "conversation"}
                        </span>
                        {formatDate(memory.created_at) && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatDate(memory.created_at)}
                          </span>
                        )}
                        {memory.conversation_id && (
                          <span className="ml-auto max-w-40 truncate" title={memory.conversation_id}>
                            Conversation {memory.conversation_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </motion.article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200/15 bg-violet-300/[0.06] text-violet-100/55">
                    <BrainCircuit className="h-7 w-7" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-white/75">
                    {query.trim() ? "No related memories found" : "Aether's memory is ready"}
                  </p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-white/40">
                    {query.trim()
                      ? "Try a different phrase, or show all stored memories."
                      : "As Aether learns useful personal facts and preferences from conversations, they will appear here."}
                  </p>
                </div>
              )}
            </main>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
