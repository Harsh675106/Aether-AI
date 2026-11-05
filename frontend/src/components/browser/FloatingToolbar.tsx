import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Search,
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  X,
  Layers,
  Grid,
} from "lucide-react";
import { useBrowserStore } from "@/stores/browserStore";
import type { BrowserLayout, SnapPosition } from "@/types/browser";

interface FloatingToolbarProps {
  onDragStart?: (e: React.MouseEvent) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
  onForward?: () => void;
}

export function FloatingToolbar({
  onDragStart,
  isLoading = false,
  onRefresh,
  onBack,
  onForward,
}: FloatingToolbarProps) {
  const {
    state: browserState,
    navigateBrowser,
    setLayout,
    snapTo,
    setAlwaysOnTop,
    hideBrowser,
    closeBrowser,
  } = useBrowserStore();

  const [addressInput, setAddressInput] = useState(browserState.currentUrl);
  const [showSnapMenu, setShowSnapMenu] = useState(false);

  // Sync address input when currentUrl changes from outside (e.g. voice command)
  useEffect(() => {
    setAddressInput(browserState.currentUrl);
  }, [browserState.currentUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addressInput.trim()) {
      let target = addressInput.trim();
      if (!target.startsWith("http://") && !target.startsWith("https://")) {
        if (target.includes(".") && !target.includes(" ")) {
          target = `https://${target}`;
        } else {
          target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
        }
      }
      void navigateBrowser(target);
    }
  };

  const handleSnap = (pos: SnapPosition) => {
    setShowSnapMenu(false);
    void snapTo(pos);
  };

  const toggleFloat = () => {
    const nextLayout: BrowserLayout = browserState.layout === "floating" ? "integrated" : "floating";
    void setLayout(nextLayout);
  };

  const toggleMaximize = () => {
    const nextLayout: BrowserLayout = browserState.layout === "expanded" ? "floating" : "expanded";
    void setLayout(nextLayout);
  };

  return (
    <div className="relative flex flex-col border-b border-white/10 bg-slate-950/90 px-3.5 py-2 text-white backdrop-blur-md select-none">
      {/* ── Aether Custom Title Bar ────────────────────────────────────────── */}
      <div
        onMouseDown={onDragStart}
        className="flex cursor-grab active:cursor-grabbing items-center justify-between pb-1.5"
      >
        {/* Floating Indicator & Title */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-300">
            Aether Browser
          </span>
          <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-200">
            {browserState.layout}
          </span>
        </div>

        {/* Title Bar Actions */}
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {/* Always on top */}
          <button
            type="button"
            onClick={() => void setAlwaysOnTop(!browserState.alwaysOnTop)}
            className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
              browserState.alwaysOnTop
                ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
            title={browserState.alwaysOnTop ? "Always on top (Active) - Click to unpin" : "Pin Always on Top"}
          >
            {browserState.alwaysOnTop ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>

          {/* Float toggle (Docked Integrated vs Floating) */}
          <button
            type="button"
            onClick={toggleFloat}
            className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
              browserState.layout === "floating"
                ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
            title={browserState.layout === "floating" ? "Switch to Integrated Docked mode" : "Switch to Free Floating mode"}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>

          {/* Minimize */}
          <button
            type="button"
            onClick={() => void hideBrowser()}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            title="Minimize Browser"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>

          {/* Maximize / Restore */}
          <button
            type="button"
            onClick={toggleMaximize}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            title={browserState.layout === "expanded" ? "Restore Window" : "Maximize Window"}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={() => void closeBrowser()}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-300 transition"
            title="Close Browser"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Aether Navigation Toolbar ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-0.5" onMouseDown={(e) => e.stopPropagation()}>
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onForward}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Forward"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Refresh"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => void navigateBrowser("https://www.google.com")}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Home (Google)"
          >
            <Home className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Address / Search Bar */}
        <form onSubmit={handleSubmit} className="relative flex flex-1 items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Search web or enter website URL..."
            className="h-7 w-full rounded-xl border border-white/10 bg-black/50 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
          />
          {/* Loading indicator bar */}
          {isLoading && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-xl">
              <div className="h-full w-full bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500 animate-[loading_1.5s_infinite]" />
            </div>
          )}
        </form>

        {/* Layout Mode Toggles */}
        <div className="relative flex items-center gap-1">
          {/* Mini mode */}
          <button
            type="button"
            onClick={() => void setLayout(browserState.layout === "mini" ? "floating" : "mini")}
            className={`flex h-7 px-2.5 items-center gap-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition ${
              browserState.layout === "mini"
                ? "border-sky-400/60 bg-sky-500/20 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                : "border-white/10 bg-white/5 text-slate-300 hover:text-white"
            }`}
            title="Mini Video Player mode"
          >
            Mini
          </button>

          {/* Expand mode */}
          <button
            type="button"
            onClick={() => void setLayout(browserState.layout === "expanded" ? "floating" : "expanded")}
            className={`flex h-7 px-2.5 items-center gap-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition ${
              browserState.layout === "expanded"
                ? "border-sky-400/60 bg-sky-500/20 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                : "border-white/10 bg-white/5 text-slate-300 hover:text-white"
            }`}
            title="Expand to Full Dimensions"
          >
            Expand
          </button>

          {/* Snap Menu */}
          <button
            type="button"
            onClick={() => setShowSnapMenu(!showSnapMenu)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Snap Window Layout"
          >
            <Grid className="h-3.5 w-3.5" />
          </button>

          {/* Snap Menu Dropdown */}
          {showSnapMenu && (
            <div className="absolute right-0 top-9 z-50 flex w-36 flex-col gap-1 rounded-xl border border-sky-400/30 bg-slate-950/95 p-1.5 text-xs shadow-2xl backdrop-blur-xl">
              <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider text-sky-300/80">Snap Positions</span>
              <button
                type="button"
                onClick={() => handleSnap("left-half")}
                className="rounded px-2 py-1 text-left text-slate-200 hover:bg-sky-500/20 hover:text-white"
              >
                Left Half
              </button>
              <button
                type="button"
                onClick={() => handleSnap("right-half")}
                className="rounded px-2 py-1 text-left text-slate-200 hover:bg-sky-500/20 hover:text-white"
              >
                Right Half
              </button>
              <button
                type="button"
                onClick={() => handleSnap("top-right")}
                className="rounded px-2 py-1 text-left text-slate-200 hover:bg-sky-500/20 hover:text-white"
              >
                Top Right
              </button>
              <button
                type="button"
                onClick={() => handleSnap("bottom-right")}
                className="rounded px-2 py-1 text-left text-slate-200 hover:bg-sky-500/20 hover:text-white"
              >
                Bottom Right
              </button>
              <button
                type="button"
                onClick={() => handleSnap("center")}
                className="rounded px-2 py-1 text-left text-slate-200 hover:bg-sky-500/20 hover:text-white"
              >
                Center
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
