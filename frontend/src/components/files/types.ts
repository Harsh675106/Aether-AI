export interface StoredScreenshot {
  id: string;
  title: string;
  url: string;
  image_data: string; // base64 data URL
  full_page: boolean;
  size_bytes: number;
  created_at: string;
}

export interface FilesContextValue {
  isOpen: boolean;
  screenshots: StoredScreenshot[];
  isLoading: boolean;
  activeScreenshot: StoredScreenshot | null;
  openFiles: () => void;
  closeFiles: () => void;
  loadScreenshots: () => Promise<void>;
  deleteScreenshot: (id: string) => Promise<boolean>;
  clearAllScreenshots: () => Promise<void>;
  setActiveScreenshot: (item: StoredScreenshot | null) => void;
}

