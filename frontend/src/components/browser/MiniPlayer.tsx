import React, { useEffect, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ExternalLink,
  Music,
} from "lucide-react";
import { useBrowserStore } from "@/stores/browserStore";

interface MiniPlayerProps {
  onExpand?: () => void;
  videoTitle?: string;
  channelName?: string;
}

export function MiniPlayer({ onExpand, videoTitle, channelName }: MiniPlayerProps) {
  const { state: browserState, setAlwaysOnTop } = useBrowserStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasMedia, setHasMedia] = useState(false);

  // Hook into iframe or active media element where accessible via DOM / postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "aether_media_state") {
        setIsPlaying(Boolean(event.data.isPlaying));
        setVolume(typeof event.data.volume === "number" ? event.data.volume : 1.0);
        setCurrentTime(event.data.currentTime || 0);
        setDuration(event.data.duration || 0);
        setHasMedia(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const togglePlay = () => {
    const nextPlayState = !isPlaying;
    setIsPlaying(nextPlayState);
    // Dispatch control event to any embedded iframe/webview
    window.postMessage({ type: "aether_media_command", command: nextPlayState ? "play" : "pause" }, "*");
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    window.postMessage({ type: "aether_media_command", command: "set_volume", value: newVol }, "*");
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    window.postMessage({ type: "aether_media_command", command: "mute", value: nextMute }, "*");
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    window.postMessage({ type: "aether_media_command", command: "seek", value: seekTime }, "*");
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-sky-400/20 bg-slate-950/90 px-4 py-2.5 text-white backdrop-blur-xl">
      {/* Title & Info Bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 truncate">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-red-400">
            <Music className="h-3 w-3" />
          </div>
          <span className="truncate font-medium text-slate-100">
            {videoTitle || (browserState.currentUrl.includes("youtube") ? "YouTube Video" : "Media Stream")}
          </span>
          {channelName && <span className="text-[10px] text-slate-400">({channelName})</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void setAlwaysOnTop(!browserState.alwaysOnTop)}
            className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider transition ${
              browserState.alwaysOnTop
                ? "border border-sky-400/50 bg-sky-500/20 text-sky-200"
                : "border border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
            title="Toggle Always On Top"
          >
            {browserState.alwaysOnTop ? "Pinned" : "Pin"}
          </button>

          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              title="Expand to Full Browser"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress & Seek Bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="h-1 flex-1 cursor-pointer accent-sky-400"
        />
        <span className="text-[10px] text-slate-400">{formatTime(duration)}</span>
      </div>

      {/* Media Action Buttons */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => window.postMessage({ type: "aether_media_command", command: "prev" }, "*")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="Previous Video"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.4)] transition hover:bg-sky-400"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          <button
            type="button"
            onClick={() => window.postMessage({ type: "aether_media_command", command: "next" }, "*")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="Next Video"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="text-slate-300 hover:text-white"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5 text-sky-400" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="h-1 w-16 cursor-pointer accent-sky-400"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
}

