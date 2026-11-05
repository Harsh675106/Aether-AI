import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  BrowserState,
  BrowserLayout,
  SnapPosition,
  BROWSER_LAYOUTS,
} from '@/types/browser';

interface BrowserStore {
  state: BrowserState;
  lastUrl: string;

  openBrowser: (url?: string, bounds?: { x: number; y: number; width: number; height: number }) => Promise<void>;
  navigateBrowser: (url: string) => Promise<void>;
  updateBounds: (x: number, y: number, width: number, height: number) => Promise<void>;
  showBrowser: () => Promise<void>;
  hideBrowser: () => Promise<void>;
  minimizeBrowser: () => Promise<void>;
  maximizeBrowser: () => Promise<void>;
  closeBrowser: () => Promise<void>;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
  snapTo: (position: SnapPosition) => Promise<void>;
  setLayout: (layout: BrowserLayout) => Promise<void>;
  toggleBrowser: () => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;

  // Internal state setters used by BrowserProvider
  _setOpen: (isOpen: boolean) => void;
  _setVisible: (isVisible: boolean) => void;
  _setCurrentUrl: (url: string) => void;
}

const DEFAULT_STATE: BrowserState = {
  isOpen: false,
  isVisible: false,
  currentUrl: 'https://www.google.com',
  layout: 'floating',
  snapPosition: 'free',
  alwaysOnTop: false,
  width: BROWSER_LAYOUTS.floating.width,
  height: BROWSER_LAYOUTS.floating.height,
  x: 0,
  y: 0,
};

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  state: { ...DEFAULT_STATE },
  lastUrl: 'https://www.google.com',

  openBrowser: async (url?: string, bounds?: { x: number; y: number; width: number; height: number }) => {
    const targetUrl = url?.trim() || get().state.currentUrl || 'https://www.google.com';

    // 1. Immediately update in-memory state so the floating window renders instantly
    set((s) => ({
      lastUrl: targetUrl,
      state: {
        ...s.state,
        isOpen: true,
        isVisible: true,
        currentUrl: targetUrl,
      },
    }));

    // 2. Command native desktop Tauri child Chromium webview
    try {
      await invoke('browser_open', {
        url: targetUrl,
        x: bounds?.x,
        y: bounds?.y,
        width: bounds?.width,
        height: bounds?.height,
        alwaysOnTop: get().state.alwaysOnTop,
      });
    } catch (err) {
      console.warn('[BrowserStore] Native window invoke note:', err);
    }
  },

  navigateBrowser: async (url: string) => {
    const targetUrl = url.trim();
    if (!targetUrl) return;

    set((s) => ({
      lastUrl: targetUrl,
      state: { ...s.state, currentUrl: targetUrl, isVisible: true, isOpen: true },
    }));

    try {
      await invoke('browser_navigate', { url: targetUrl });
    } catch (err) {
      console.warn('[BrowserStore] browser_navigate invoke note:', err);
    }
  },

  updateBounds: async (x: number, y: number, width: number, height: number) => {
    try {
      await invoke('browser_update_bounds', { x, y, width, height });
    } catch (err) {
      // outside tauri
    }
  },

  goBack: async () => {
    try {
      await invoke('browser_back');
    } catch (err) {
      // outside tauri
    }
  },

  goForward: async () => {
    try {
      await invoke('browser_forward');
    } catch (err) {
      // outside tauri
    }
  },

  reload: async () => {
    try {
      await invoke('browser_reload');
    } catch (err) {
      // outside tauri
    }
  },

  showBrowser: async () => {
    set((s) => ({
      state: { ...s.state, isVisible: true, isOpen: true },
    }));

    try {
      await invoke('browser_show');
    } catch (err) {
      console.warn('[BrowserStore] browser_show invoke note:', err);
    }
  },

  hideBrowser: async () => {
    set((s) => ({
      state: { ...s.state, isVisible: false },
    }));

    try {
      await invoke('browser_hide');
    } catch (err) {
      console.warn('[BrowserStore] browser_hide invoke note:', err);
    }
  },

  minimizeBrowser: async () => {
    set((s) => ({
      state: { ...s.state, isVisible: false },
    }));

    try {
      await invoke('browser_minimize');
    } catch (err) {
      console.warn('[BrowserStore] browser_minimize invoke note:', err);
    }
  },

  maximizeBrowser: async () => {
    set((s) => ({
      state: {
        ...s.state,
        layout: 'expanded',
        width: BROWSER_LAYOUTS.expanded.width,
        height: BROWSER_LAYOUTS.expanded.height,
        isVisible: true,
      },
    }));

    try {
      await invoke('browser_maximize');
    } catch (err) {
      console.warn('[BrowserStore] browser_maximize invoke note:', err);
    }
  },

  closeBrowser: async () => {
    set((s) => ({
      state: {
        ...s.state,
        isOpen: false,
        isVisible: false,
        layout: 'floating',
      },
    }));

    try {
      await invoke('browser_close');
    } catch (err) {
      console.warn('[BrowserStore] browser_close invoke note:', err);
    }
  },

  setAlwaysOnTop: async (value: boolean) => {
    set((s) => ({
      state: { ...s.state, alwaysOnTop: value },
    }));

    try {
      await invoke('browser_set_always_on_top', { alwaysOnTop: value });
    } catch (err) {
      console.warn('[BrowserStore] browser_set_always_on_top invoke note:', err);
    }
  },

  snapTo: async (position: SnapPosition) => {
    set((s) => ({
      state: { ...s.state, snapPosition: position, isVisible: true },
    }));

    try {
      await invoke('browser_snap', { position });
    } catch (err) {
      console.warn('[BrowserStore] browser_snap invoke note:', err);
    }
  },

  setLayout: async (layout: BrowserLayout) => {
    if (layout === 'hidden') {
      await get().hideBrowser();
      return;
    }

    const dimensions = BROWSER_LAYOUTS[layout as keyof typeof BROWSER_LAYOUTS] || BROWSER_LAYOUTS.floating;
    set((s) => ({
      state: {
        ...s.state,
        layout,
        width: dimensions.width,
        height: dimensions.height,
        isVisible: true,
      },
    }));

    try {
      await invoke('browser_resize', {
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch (err) {
      console.warn('[BrowserStore] browser_resize invoke note:', err);
    }
  },

  toggleBrowser: async () => {
    const { state, lastUrl, openBrowser, showBrowser, hideBrowser } = get();
    if (!state.isOpen) {
      await openBrowser(lastUrl);
    } else if (state.isVisible) {
      await hideBrowser();
    } else {
      await showBrowser();
    }
  },

  _setOpen: (isOpen: boolean) => {
    set((s) => ({ state: { ...s.state, isOpen } }));
  },

  _setVisible: (isVisible: boolean) => {
    set((s) => ({ state: { ...s.state, isVisible } }));
  },

  _setCurrentUrl: (url: string) => {
    set((s) => ({ state: { ...s.state, currentUrl: url }, lastUrl: url }));
  },
}));
