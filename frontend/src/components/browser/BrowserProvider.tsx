import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useBrowserStore } from '@/stores/browserStore';
import { useBrowser } from '@/hooks/useBrowser';
import { apiPost } from '@/services/apiClient';

// ── Context ───────────────────────────────────────────────────────────────────

type BrowserContextValue = ReturnType<typeof useBrowser>;

const BrowserContext = createContext<BrowserContextValue | null>(null);

export function useBrowserContext(): BrowserContextValue {
  const ctx = useContext(BrowserContext);
  if (!ctx) {
    throw new Error('useBrowserContext must be used inside <BrowserProvider>');
  }
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface BrowserProviderProps {
  children: ReactNode;
}

export function BrowserProvider({ children }: BrowserProviderProps) {
  const store = useBrowserStore();
  const browser = useBrowser();

  useEffect(() => {
    const unlisten: UnlistenFn[] = [];

    async function registerListeners() {
      // Browser window was destroyed / closed externally
      const unlistenDestroyed = await listen('tauri://window-destroyed', (event) => {
        // Only react if it's the browser window
        const label = (event as any)?.windowLabel ?? (event.payload as any)?.label;
        if (label === 'browser') {
          store._setOpen(false);
          store._setVisible(false);
        }
      });
      unlisten.push(unlistenDestroyed);

      // Browser window was created externally (edge case)
      const unlistenCreated = await listen('tauri://window-created', (event) => {
        const label = (event as any)?.windowLabel ?? (event.payload as any)?.label;
        if (label === 'browser') {
          store._setOpen(true);
          store._setVisible(true);
        }
      });
      unlisten.push(unlistenCreated);

      // Custom event emitted by backend when the browser navigates
      const unlistenNav = await listen<{ url: string }>('browser://navigated', (event) => {
        if (event.payload?.url) {
          store._setCurrentUrl(event.payload.url);
        }
      });
      unlisten.push(unlistenNav);

      // Event emitted by Tauri native webview when URL changes
      const unlistenUrlChanged = await listen<{ tab_id: string; url: string }>(
        'browser-url-changed',
        (event) => {
          if (event.payload?.tab_id && event.payload.url) {
            store._setTabUrl(event.payload.tab_id, event.payload.url);
            if (
              useBrowserStore.getState().state.activeTabId === event.payload.tab_id
            ) {
              void apiPost('/browser/active-page', {
                url: event.payload.url,
                tab_id: event.payload.tab_id,
              }).catch((err) => {
                console.warn(
                  '[BrowserProvider] Failed to sync active browser tab with automation:',
                  err
                );
              });
            }
          }
        }
      );
      unlisten.push(unlistenUrlChanged);
    }

    registerListeners().catch((err) =>
      console.error('[BrowserProvider] Failed to register Tauri listeners:', err)
    );

    return () => {
      unlisten.forEach((fn) => fn());
    };
  }, []);

  return (
    <BrowserContext.Provider value={browser}>
      {children}
    </BrowserContext.Provider>
  );
}
