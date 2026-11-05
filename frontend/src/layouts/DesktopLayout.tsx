import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import StartupAnimation from "@/components/aether/AetherBackground";
import { ChatPanelAether } from "@/components/chat/ChatPanelAether";
import { StatusPanel } from "@/components/status/StatusPanel";
import { BottomNavbar } from "@/components/bottom/BottomNavbar";
import { MonitorPanel } from "@/components/monitor/MonitorPanel";

const DISPLAY_VIDEO_URL = "/assets/DisplayVideo.mp4";

export function DesktopLayout() {
  const [bootComplete, setBootComplete] = useState(false);
  const [displayVideoReady, setDisplayVideoReady] = useState(false);
  const displayVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!bootComplete) {
      return;
    }

    const video = displayVideoRef.current;
    if (!video) {
      return;
    }

    const handleCanPlay = () => setDisplayVideoReady(true);

    video.addEventListener("canplay", handleCanPlay);
    const playPromise = video.play();

    if (playPromise) {
      playPromise.catch((error) => {
        console.warn("Display video autoplay may be blocked:", error);
      });
    }

    video.muted = false;
    video.volume = 0.75;

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [bootComplete]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {!bootComplete && <StartupAnimation onComplete={() => setBootComplete(true)} />}

      {bootComplete && (
        <video
          ref={displayVideoRef}
          src={DISPLAY_VIDEO_URL}
          autoPlay
          muted={false}
          playsInline
          loop
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}


      <div className="relative z-20 min-h-screen">
        <StatusPanel />
        <MonitorPanel />
        <ChatPanelAether />
        <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        </main>
        <BottomNavbar />
      </div>

      {bootComplete && !displayVideoReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-slate-200/90">
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-6 py-4 text-sm">
            Loading Aether display video...
          </div>
        </div>
      )}
    </div>
  );
}
