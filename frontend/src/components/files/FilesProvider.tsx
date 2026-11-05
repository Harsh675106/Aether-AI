import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { apiDelete, apiGet } from "@/services/apiClient";
import type { FilesContextValue, StoredScreenshot } from "./types";

const noop = () => undefined;

const FilesContext = createContext<FilesContextValue>({
  isOpen: false,
  screenshots: [],
  isLoading: false,
  activeScreenshot: null,
  openFiles: noop,
  closeFiles: noop,
  loadScreenshots: async () => undefined,
  deleteScreenshot: async () => false,
  clearAllScreenshots: async () => undefined,
  setActiveScreenshot: noop,
});

export function FilesProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [screenshots, setScreenshots] = useState<StoredScreenshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeScreenshot, setActiveScreenshot] = useState<StoredScreenshot | null>(null);

  const loadScreenshots = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet<{ entries: StoredScreenshot[] }>("/screenshots?limit=50");
      setScreenshots(response.entries || []);
    } catch (err) {
      console.warn("Unable to load stored screenshots from memory", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openFiles = () => {
    setIsOpen(true);
    void loadScreenshots();
  };

  const closeFiles = () => {
    setIsOpen(false);
    setActiveScreenshot(null);
  };

  const deleteScreenshot = async (id: string): Promise<boolean> => {
    try {
      // Optimistic update
      setScreenshots((prev) => prev.filter((item) => item.id !== id));
      if (activeScreenshot?.id === id) {
        setActiveScreenshot(null);
      }
      await apiDelete<{ success: boolean }>(`/screenshots/${id}`);
      return true;
    } catch (err) {
      console.error("Failed to delete screenshot", err);
      // Revert if error
      void loadScreenshots();
      return false;
    }
  };

  const clearAllScreenshots = async () => {
    try {
      setScreenshots([]);
      setActiveScreenshot(null);
      await apiDelete<{ success: boolean }>("/screenshots");
    } catch (err) {
      console.error("Failed to clear screenshots", err);
      void loadScreenshots();
    }
  };

  // Preload screenshot count on mount
  useEffect(() => {
    void loadScreenshots();
  }, []);

  return (
    <FilesContext.Provider
      value={{
        isOpen,
        screenshots,
        isLoading,
        activeScreenshot,
        openFiles,
        closeFiles,
        loadScreenshots,
        deleteScreenshot,
        clearAllScreenshots,
        setActiveScreenshot,
      }}
    >
      {children}
    </FilesContext.Provider>
  );
}

export function useFiles() {
  return useContext(FilesContext);
}

