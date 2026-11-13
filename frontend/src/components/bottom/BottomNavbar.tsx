import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, FolderOpen, Globe, Images, Video } from "lucide-react";

import { useImageSearch } from "@/components/image-search";
import { useFiles } from "@/components/files";
import { useBrowserStore } from "@/stores/browserStore";
import { useVideoSearch } from "@/components/videos";
import { PluginShowcaseModal } from "@/components/plugins/PluginShowcaseModal";
import { MemoryModal } from "@/components/memory/MemoryModal";

const navItems = [
  "Videos",
  "Memory",
  "Tools",
  "Tasks",
  "Plugins",
  "Files",
  "Notifications",
  "Settings",
];

export function BottomNavbar() {
  const { openHistory, history } = useImageSearch();
  const { openFiles, screenshots } = useFiles();
  const { state: browserState, openBrowser, toggleBrowser } = useBrowserStore();
  const videoSearch = useVideoSearch();
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const closePlugins = useCallback(() => setPluginsOpen(false), []);
  const closeMemory = useCallback(() => setMemoryOpen(false), []);

  const handleBrowserClick = () => {
    if (browserState.isOpen) {
      void toggleBrowser();
    } else {
      void openBrowser("https://www.google.com");
    }
  };

  return (
    <>
      <style>{`
        @keyframes bottomPulse {
          0% { transform: translateX(-140%); }
          100% { transform: translateX(240%); }
        }
      `}</style>

      <motion.nav
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute left-6 right-6 bottom-3 z-40 mx-auto flex max-w-[calc(100vw-3rem)] flex-wrap items-center justify-center gap-3 rounded-[3rem] border border-white/20 bg-[rgba(10,16,32,0.10)] px-4 py-3 shadow-[0_32px_120px_rgba(8,15,30,0.28)] backdrop-blur-sm"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
          border: "1px solid rgba(255,255,255,0.22)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[3rem]">
          <div className="absolute inset-0 rounded-[3rem] border border-white/25 shadow-[0_0_24px_rgba(255,255,255,0.12),0_0_48px_rgba(56,189,248,0.14)]" />
          <div
            className="absolute inset-[-2px] rounded-[3rem] bg-[conic-gradient(from_0deg,transparent_0deg_280deg,rgba(56,189,248,0.72)_280deg_296deg,rgba(255,255,255,0.7)_296deg_302deg,transparent_302deg_360deg)] opacity-80 blur-[8px]"
            style={{ animation: "bottomPulse 9s linear infinite" }}
          />
        </div>

        <div className="relative flex flex-wrap items-center justify-center gap-6 text-[11px] uppercase tracking-[0.28em] text-slate-200">
          {/* Images History Button */}
          <button
            type="button"
            onClick={() => void openHistory()}
            className="group relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition duration-300 ease-in-out hover:border-white/30 hover:bg-slate-950/25 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.28)]"
            aria-label="Reopen image history"
            title="Reopen stored image requests"
          >
            <Images className="h-4 w-4 text-cyan-300" />
            Images{history.length ? ` (${history.length})` : ""}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-white via-cyan-300 to-blue-500 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-90" />
          </button>

          {/* Browser Button */}
          <button
            type="button"
            onClick={handleBrowserClick}
            className={`group relative inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] transition duration-300 ease-in-out ${
              browserState.isOpen && browserState.isVisible
                ? "border-sky-400/60 bg-sky-500/20 text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                : browserState.isOpen && !browserState.isVisible
                ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200 hover:border-indigo-400/60 hover:bg-indigo-500/25"
                : "border-sky-400/30 bg-sky-950/20 text-sky-200 hover:border-sky-400/60 hover:bg-sky-950/40 hover:text-white hover:shadow-[0_0_20px_rgba(56,189,248,0.35)]"
            }`}
            aria-label="Open browser window"
            title={
              browserState.isOpen && browserState.isVisible
                ? "Hide floating browser"
                : browserState.isOpen
                ? "Show floating browser"
                : "Open floating browser"
            }
          >
            <Globe
              className={`h-4 w-4 ${
                browserState.isOpen && browserState.isVisible
                  ? "text-sky-300"
                  : browserState.isOpen
                  ? "text-indigo-300"
                  : "text-sky-400"
              }`}
            />
            Browser{browserState.isOpen && !browserState.isVisible ? " (hidden)" : ""}
            {browserState.isOpen && browserState.isVisible && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
              </span>
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-100" />
          </button>

          {navItems.map((item) => {
            if (item === "Videos") {
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => videoSearch.open()}
                  className="group relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition duration-300 ease-in-out hover:border-white/30 hover:bg-slate-950/25 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.28)]"
                  aria-label="Open video search"
                  title="Search and save videos"
                >
                  <Video className="h-4 w-4 text-cyan-300" />
                  Videos
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-white via-cyan-300 to-blue-500 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-90" />
                </button>
              );
            }
            if (item === "Plugins") {
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPluginsOpen(true)}
                  className="group relative inline-flex items-center gap-2 rounded-full border border-fuchsia-300/15 bg-slate-950/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition duration-300 ease-in-out hover:border-fuchsia-200/35 hover:bg-fuchsia-400/[0.08] hover:text-white hover:shadow-[0_0_20px_rgba(217,70,239,0.16)]"
                  aria-label="Explore Aether plugins and technologies"
                  title="Explore the Aether project stack"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-md border border-fuchsia-200/30 bg-gradient-to-br from-fuchsia-300/30 to-cyan-300/20 text-[9px] font-black text-fuchsia-100">
                    A
                  </span>
                  Plugins
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-fuchsia-300 via-cyan-200 to-blue-400 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-90" />
                </button>
              );
            }
            if (item === "Memory") {
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMemoryOpen(true)}
                  className="group relative inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-slate-950/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition duration-300 ease-in-out hover:border-violet-200/35 hover:bg-violet-400/[0.08] hover:shadow-[0_0_20px_rgba(167,139,250,0.18)]"
                  aria-label="Open Aether memory"
                  title="View and search Aether's memories"
                >
                  <BrainCircuit className="h-4 w-4 text-violet-200" />
                  Memory
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-violet-300 via-cyan-200 to-blue-400 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-90" />
                </button>
              );
            }
            if (item === "Files") {
              return (
                <button
                  key={item}
                  type="button"
                  onClick={openFiles}
                  className="group relative inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/20 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-200 transition duration-300 ease-in-out hover:border-sky-400/60 hover:bg-sky-950/40 hover:text-white hover:shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                  aria-label="Open files and memory screenshots"
                  title="View captured screenshots in memory"
                >
                  <FolderOpen className="h-4 w-4 text-sky-400" />
                  Files{screenshots.length ? ` (${screenshots.length})` : ""}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-100" />
                </button>
              );
            }

            return (
              <button
                key={item}
                type="button"
                className="group relative rounded-full border border-white/10 bg-slate-950/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition duration-300 ease-in-out hover:border-white/30 hover:bg-slate-950/25 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.28)]"
              >
                {item}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-white via-cyan-300 to-blue-500 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-90" />
              </button>
            );
          })}
        </div>
      </motion.nav>
      <PluginShowcaseModal isOpen={pluginsOpen} onClose={closePlugins} />
      <MemoryModal isOpen={memoryOpen} onClose={closeMemory} />
    </>
  );
}
