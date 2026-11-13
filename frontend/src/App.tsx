import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ImageSearchModal, ImageSearchProvider } from "@/components/image-search";
import { FilesModal, FilesProvider } from "@/components/files";
import { BrowserProvider } from "@/components/browser";
import { VideoSearchProvider, VideosModal } from "@/components/videos";
import { router } from "@/routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <ImageSearchProvider>
      <VideoSearchProvider>
        <FilesProvider>
          <BrowserProvider>
            <QueryClientProvider client={queryClient}>
              <RouterProvider router={router} />
              <ImageSearchModal />
              <VideosModal />
              <FilesModal />
            </QueryClientProvider>
          </BrowserProvider>
        </FilesProvider>
      </VideoSearchProvider>
    </ImageSearchProvider>
  );
}
