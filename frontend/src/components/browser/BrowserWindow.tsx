import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

import { useBrowserStore } from "@/stores/browserStore";
import { FloatingToolbar } from "./FloatingToolbar";
import "./browser.css";

export function BrowserWindow() {
  const {
    state: browserState,
    updateBounds,
    switchBrowserTab,
    reload,
    goBack,
    goForward,
    hideBrowser,
    showBrowser,
    setWindowDragging,
    snapTo,
  } = useBrowserStore();

  const [position, setPosition] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(40, Math.floor((window.innerWidth - 980) / 2)) : 100,
    y: typeof window !== "undefined" ? Math.max(40, Math.floor((window.innerHeight - 680) / 2)) : 60,
  }));
  const [size, setSize] = useState(() => ({
    width: typeof window !== "undefined" ? Math.min(980, window.innerWidth - 60) : 980,
    height: typeof window !== "undefined" ? Math.min(680, window.innerHeight - 100) : 680,
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragPositionRef = useRef(position);

  const getTabLabel = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  // Sync actual Chromium webview bounds to match the content area rect
  const syncWebviewBounds = useCallback(() => {
    if (!contentAreaRef.current) return;
    const rect = contentAreaRef.current.getBoundingClientRect();
    if (rect.width > 20 && rect.height > 20) {
      void updateBounds(
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.width),
        Math.round(rect.height)
      );
    }
  }, [updateBounds]);

  const scheduleSyncBounds = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = requestAnimationFrame(() => {
      syncWebviewBounds();
      animFrameRef.current = null;
    });
  }, [syncWebviewBounds]);

  // A native Tauri child WebView is not part of the DOM: it cannot follow a
  // CSS transform and must be created only after this content box has a final
  // layout rectangle. A layout effect runs after React commits the toolbar and
  // content area, but before the first browser paint.
  useLayoutEffect(() => {
    if (!browserState.isOpen || !browserState.isVisible || !contentAreaRef.current) {
      return;
    }

    syncWebviewBounds();

    const observer = new ResizeObserver(syncWebviewBounds);
    observer.observe(contentAreaRef.current);
    return () => observer.disconnect();
  }, [browserState.isOpen, browserState.isVisible, syncWebviewBounds]);

  // Sync window geometry when layout changes
  useEffect(() => {
    if (browserState.layout === "mini") {
      setSize({ width: 440, height: 320 });
      setPosition({
        x: Math.max(20, window.innerWidth - 460),
        y: Math.max(20, window.innerHeight - 400),
      });
    } else if (browserState.layout === "expanded") {
      setSize({
        width: Math.min(window.innerWidth - 30, 1500),
        height: Math.max(400, window.innerHeight - 100),
      });
      setPosition({ x: 15, y: 15 });
    } else if (browserState.layout === "integrated") {
      const halfW = Math.floor(window.innerWidth * 0.48);
      setSize({ width: halfW, height: window.innerHeight - 120 });
      setPosition({ x: window.innerWidth - halfW - 20, y: 20 });
    } else if (browserState.layout === "floating") {
      setSize({
        width: Math.min(980, window.innerWidth - 60),
        height: Math.min(680, window.innerHeight - 100),
      });
      setPosition({
        x: Math.max(40, Math.floor((window.innerWidth - 980) / 2)),
        y: Math.max(40, Math.floor((window.innerHeight - 680) / 2)),
      });
    }
  }, [browserState.layout]);

  // Handle snap position updates
  useEffect(() => {
    if (browserState.snapPosition === "free") return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const halfW = Math.floor(screenW / 2) - 20;
    const halfH = Math.floor(screenH / 2) - 40;

    switch (browserState.snapPosition) {
      case "left-half":
        setPosition({ x: 10, y: 10 });
        setSize({ width: halfW, height: screenH - 100 });
        break;
      case "right-half":
        setPosition({ x: Math.floor(screenW / 2) + 10, y: 10 });
        setSize({ width: halfW, height: screenH - 100 });
        break;
      case "top-left":
        setPosition({ x: 10, y: 10 });
        setSize({ width: halfW, height: halfH });
        break;
      case "top-right":
        setPosition({ x: Math.floor(screenW / 2) + 10, y: 10 });
        setSize({ width: halfW, height: halfH });
        break;
      case "bottom-left":
        setPosition({ x: 10, y: Math.floor(screenH / 2) });
        setSize({ width: halfW, height: halfH - 60 });
        break;
      case "bottom-right":
        setPosition({ x: Math.floor(screenW / 2) + 10, y: Math.floor(screenH / 2) });
        setSize({ width: halfW, height: halfH - 60 });
        break;
      case "center":
        const centerW = Math.min(1080, screenW - 80);
        const centerH = Math.min(740, screenH - 120);
        setPosition({
          x: Math.floor((screenW - centerW) / 2),
          y: Math.floor((screenH - centerH) / 2),
        });
        setSize({ width: centerW, height: centerH });
        break;
    }
  }, [browserState.snapPosition]);

  // Synchronize native webview bounds whenever position, size or visibility changes
  useEffect(() => {
    if (browserState.isOpen && browserState.isVisible && !isDragging) {
      scheduleSyncBounds();
    }
  }, [
    position,
    size,
    isDragging,
    browserState.isOpen,
    browserState.isVisible,
    scheduleSyncBounds,
  ]);

  // Also sync on window resize
  useEffect(() => {
    const onWindowResize = () => {
      setSize((current) => ({
        width: Math.min(current.width, window.innerWidth),
        height: Math.min(current.height, window.innerHeight),
      }));
      setPosition((current) => ({
        x: Math.max(0, Math.min(window.innerWidth - size.width, current.x)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, current.y)),
      }));
      if (!isDragging) {
        scheduleSyncBounds();
      }
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [isDragging, scheduleSyncBounds, size.width, size.height]);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragPointerIdRef.current = e.pointerId;
    dragPositionRef.current = position;
    e.currentTarget.setPointerCapture(e.pointerId);
    void snapTo("free");
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    void setWindowDragging(true);
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerIdRef.current) return;
      const maxX = Math.max(0, window.innerWidth - size.width);
      const maxY = Math.max(0, window.innerHeight - size.height);
      const nextX = Math.max(0, Math.min(maxX, e.clientX - dragOffset.x));
      const nextY = Math.max(0, Math.min(maxY, e.clientY - dragOffset.y));
      dragPositionRef.current = { x: nextX, y: nextY };
      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerEnd = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerIdRef.current) return;
      dragPointerIdRef.current = null;
      const { x } = dragPositionRef.current;
      const rightDistance = window.innerWidth - (x + size.width);
      if (x <= 24) {
        void snapTo("left-half");
      } else if (rightDistance <= 24) {
        void snapTo("right-half");
      } else {
        void snapTo("free");
      }
      setIsDragging(false);
      scheduleSyncBounds();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      void setWindowDragging(false);
    };
  }, [
    isDragging,
    dragOffset,
    scheduleSyncBounds,
    setWindowDragging,
    size.width,
    size.height,
    snapTo,
  ]);

  // Edge / Corner Resize handlers
  const handleResizeStart = (direction: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = position.x;
    const startPosY = position.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newPosX = startPosX;
      let newPosY = startPosY;

      if (direction.includes("e")) newWidth = Math.max(380, startWidth + deltaX);
      if (direction.includes("s")) newHeight = Math.max(260, startHeight + deltaY);
      if (direction.includes("w")) {
        const potentialWidth = Math.max(380, startWidth - deltaX);
        newPosX = startPosX + (startWidth - potentialWidth);
        newWidth = potentialWidth;
      }
      if (direction.includes("n")) {
        const potentialHeight = Math.max(260, startHeight - deltaY);
        newPosY = startPosY + (startHeight - potentialHeight);
        newHeight = potentialHeight;
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newPosX, y: newPosY });
      scheduleSyncBounds();
    };

    const onMouseUp = () => {
      setIsResizing(false);
      scheduleSyncBounds();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Brief loading spinner on URL navigation
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 900);
    return () => clearTimeout(timer);
  }, [browserState.currentUrl]);

  if (!browserState.isOpen || !browserState.isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        // Do not animate transform on the native-WebView parent. The child
        // HWND/WebView2 surface is positioned independently of CSS transforms.
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: browserState.alwaysOnTop ? 99999 : 100,
        }}
        className="browser-glass relative flex flex-col overflow-hidden rounded-[2rem] border border-sky-400/40 text-white shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_60px_rgba(56,189,248,0.25)]"
      >
        {/* Full-screen mouse capture shield during drag/resize so native child HWND doesn't steal pointer */}
        {(isDragging || isResizing) && (
          <div className="fixed inset-0 z-[999999] cursor-move select-none" />
        )}

        {/* Resize Handles */}
        <div className="browser-resize-handle browser-resize-handle-n" onMouseDown={(e) => handleResizeStart("n", e)} />
        <div className="browser-resize-handle browser-resize-handle-s" onMouseDown={(e) => handleResizeStart("s", e)} />
        <div className="browser-resize-handle browser-resize-handle-w" onMouseDown={(e) => handleResizeStart("w", e)} />
        <div className="browser-resize-handle browser-resize-handle-e" onMouseDown={(e) => handleResizeStart("e", e)} />
        <div className="browser-resize-handle browser-resize-handle-nw" onMouseDown={(e) => handleResizeStart("nw", e)} />
        <div className="browser-resize-handle browser-resize-handle-ne" onMouseDown={(e) => handleResizeStart("ne", e)} />
        <div className="browser-resize-handle browser-resize-handle-sw" onMouseDown={(e) => handleResizeStart("sw", e)} />
        <div className="browser-resize-handle browser-resize-handle-se" onMouseDown={(e) => handleResizeStart("se", e)} />

        {browserState.tabs.length > 0 && (
          <div
            className="flex min-h-9 items-center gap-1 overflow-x-auto border-b border-white/10 bg-slate-950/75 px-2 py-1"
            aria-label="Browser tabs"
          >
            {browserState.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => void switchBrowserTab(tab.id)}
                className={`max-w-40 shrink-0 truncate rounded-lg border px-3 py-1 text-[10px] transition ${
                  browserState.activeTabId === tab.id
                    ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
                aria-pressed={browserState.activeTabId === tab.id}
                title={tab.url}
              >
                {getTabLabel(tab.url)}
              </button>
            ))}
          </div>
        )}

        {/* ── 1. Aether Custom Title Bar & 2. Navigation Toolbar ──────────────── */}
        <FloatingToolbar
          onDragStart={handleDragStart}
          isLoading={isLoading}
          onRefresh={() => {
            setIsLoading(true);
            void reload();
          }}
          onBack={() => {
            void goBack();
          }}
          onForward={() => {
            void goForward();
          }}
        />

        {/* ── 3. Actual Embedded Chromium Web Content Area ───────────────────── */}
        <div
          ref={contentAreaRef}
          className="relative flex-1 overflow-hidden bg-slate-950 rounded-b-[1.75rem]"
        >
          {isLoading && (
            <div className="absolute inset-x-0 top-0 z-20 h-1 overflow-hidden bg-sky-950/60">
              <div className="h-full w-full bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500 animate-[loading_1.5s_infinite]" />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
