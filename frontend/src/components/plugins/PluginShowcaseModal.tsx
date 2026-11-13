import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Atom,
  AudioLines,
  Bot,
  Code2,
  Database,
  Globe2,
  HardDrive,
  Monitor,
  Play,
  Search,
  Server,
  X,
} from "lucide-react";

const stackItems = [
  {
    name: "Ollama",
    category: "AI runtime",
    description: "Runs Aether's local language models for private, on-device assistance.",
    mark: "O",
    color: "from-orange-300/25 to-amber-500/10",
    accent: "text-orange-200",
    Icon: Bot,
  },
  {
    name: "SearXNG",
    category: "Metasearch",
    description: "Federates web, image, and video discovery across configured search engines.",
    mark: "Sx",
    color: "from-cyan-300/25 to-sky-500/10",
    accent: "text-cyan-200",
    Icon: Search,
  },
  {
    name: "YouTube",
    category: "Video",
    description: "Supports video discovery and voice-driven playback in Aether's browser.",
    mark: "▶",
    color: "from-red-400/25 to-rose-500/10",
    accent: "text-red-200",
    Icon: Play,
  },
  {
    name: "Faster-Whisper",
    category: "Speech",
    description: "Transcribes voice input locally with the configured Whisper model.",
    mark: "FW",
    color: "from-violet-300/25 to-indigo-500/10",
    accent: "text-violet-200",
    Icon: AudioLines,
  },
  {
    name: "FastAPI",
    category: "Backend",
    description: "Provides Aether's asynchronous Python API and service endpoints.",
    mark: "API",
    color: "from-emerald-300/25 to-teal-500/10",
    accent: "text-emerald-200",
    Icon: Server,
  },
  {
    name: "ChromaDB",
    category: "Memory",
    description: "Stores persistent memories and saved image and video metadata.",
    mark: "Ch",
    color: "from-fuchsia-300/25 to-purple-500/10",
    accent: "text-fuchsia-200",
    Icon: Database,
  },
  {
    name: "SQLite",
    category: "Database",
    description: "Persists local conversation and application data.",
    mark: "SQL",
    color: "from-blue-300/25 to-indigo-500/10",
    accent: "text-blue-200",
    Icon: HardDrive,
  },
  {
    name: "Tauri",
    category: "Desktop",
    description: "Connects Aether's desktop interface with native window capabilities.",
    mark: "T",
    color: "from-slate-200/20 to-slate-500/10",
    accent: "text-slate-100",
    Icon: Monitor,
  },
  {
    name: "React + TypeScript",
    category: "Frontend",
    description: "Powers Aether's type-safe, animated desktop interface.",
    mark: "TS",
    color: "from-sky-300/25 to-blue-500/10",
    accent: "text-sky-200",
    Icon: Atom,
  },
  {
    name: "Playwright",
    category: "Automation",
    description: "Drives browser automation and page interaction workflows.",
    mark: "Pw",
    color: "from-lime-300/25 to-green-500/10",
    accent: "text-lime-200",
    Icon: Globe2,
  },
  {
    name: "Python",
    category: "Backend",
    description: "Powers Aether's backend services, orchestration, and integrations.",
    mark: "Py",
    color: "from-yellow-300/25 to-blue-500/10",
    accent: "text-yellow-200",
    Icon: Code2,
  },
];

type PluginShowcaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function PluginShowcaseModal({ isOpen, onClose }: PluginShowcaseModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-md sm:p-6"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="plugin-showcase-title"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-[rgba(5,13,28,0.96)] shadow-[0_35px_120px_rgba(2,132,199,0.2)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.13),transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.12),transparent_32%)]" />
            <header className="relative flex items-start justify-between gap-5 border-b border-white/10 px-5 py-5 sm:px-8 sm:py-7">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.38em] text-cyan-200/75">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
                  Aether ecosystem
                </p>
                <h2
                  id="plugin-showcase-title"
                  className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
                >
                  What powers Aether
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300/65">
                  A curated map of the models, services, and technologies working behind your AI desktop.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close plugins"
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/65 transition hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
                  Project stack
                </p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  {stackItems.length} integrations & technologies
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stackItems.map(({ name, category, description, mark, color, accent, Icon }, index) => (
                  <motion.article
                    key={name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.035, 0.28), duration: 0.25 }}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/25 hover:bg-white/[0.065] hover:shadow-[0_14px_38px_rgba(8,145,178,0.1)] sm:p-5"
                  >
                    <div className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${color} opacity-50 blur-2xl transition duration-500 group-hover:opacity-90`} />
                    <div className="relative flex items-start gap-3.5">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-gradient-to-br ${color} shadow-inner`}>
                        <span className={`text-sm font-black tracking-tight ${accent}`}>{mark}</span>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white">{name}</h3>
                          <span className="rounded-full border border-white/[0.08] bg-black/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.13em] text-white/45">
                            {category}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-300/60">{description}</p>
                      </div>
                    </div>
                    <div className="relative mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
                      <Icon className={`h-3.5 w-3.5 ${accent}`} />
                      <span>Aether stack</span>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
            <footer className="relative border-t border-white/[0.08] px-5 py-3.5 text-center text-[10px] uppercase tracking-[0.2em] text-white/30 sm:px-8">
              Built to work together · Aether AI
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
