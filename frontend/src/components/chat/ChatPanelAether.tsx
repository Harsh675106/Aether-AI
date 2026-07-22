import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Square, Sparkles, Volume2, Radio, Loader2, ArrowDown } from "lucide-react";
import { useState } from "react";

import { AetherLogo } from "@/components/aether/AetherLogo";
import { LightningLoader } from "@/components/chat/LightningLoader";
import { MarkdownMessage } from "@/components/chat/Markdown/MarkdownMessage";
import { useChat } from "@/hooks/useChat";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useSmartScroll } from "@/hooks/useSmartScroll";

export function ChatPanelAether() {
  const [draft, setDraft] = useState("");
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChat();
  const voice = useVoiceAssistant(sendMessage);

  const voiceState = voice.state;
  const isVoiceRunning = voice.isRunning;
  const phase = voiceState.phase;

  const isListening = voiceState.listening || phase === "listening";
  const isSpeaking = voiceState.speaking || phase === "speaking";
  const isProcessing = phase === "processing_speech" || phase === "sending_to_chatbot" || phase === "receiving_ai_response" || phase === "converting_to_speech";

  const {
    containerRef,
    handleScroll,
    scrollToBottom,
    isAtBottom,
  } = useSmartScroll<HTMLDivElement>([messages, isStreaming, voiceState.transcript, voiceState.response]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }

    const message = draft.trim();
    setDraft("");
    scrollToBottom("smooth");
    await sendMessage(message, { source: "text" });
  };

  const getVoicePhaseLabel = () => {
    switch (phase) {
      case "starting":
        return "Initializing Voice...";
      case "listening":
        return "Listening for speech...";
      case "processing_speech":
        return "Processing speech input...";
      case "sending_to_chatbot":
        return "Sending to Aether AI...";
      case "receiving_ai_response":
        return "Receiving AI response...";
      case "converting_to_speech":
        return "Converting to speech...";
      case "speaking":
        return "Aether Speaking...";
      case "completed":
        return "Voice cycle complete";
      case "error":
        return voiceState.error ?? "Voice Error";
      default:
        return "Voice Engine Ready";
    }
  };

  return (
    <>
      <AetherLogo />
      <motion.div className="pointer-events-none absolute left-4 top-1/2 mt-4 z-30 hidden -translate-y-1/2 flex w-[min(44rem,calc(100%-2rem))] flex-col gap-3 md:flex lg:left-6 lg:w-[52rem]">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="pointer-events-auto w-full flex-col overflow-hidden rounded-[2.5rem] bg-transparent text-white"
        >
          <div className="relative flex max-h-[calc(100vh-22rem)] flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-[rgba(5,10,20,0.59)] px-4 py-3 shadow-[0_0_55px_rgba(56,189,248,0.08)]">
            <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-sky-400/80 via-white/70 to-transparent" />
            <div className="pointer-events-none absolute left-0 bottom-0 h-1 w-full bg-gradient-to-r from-transparent via-white/50 to-sky-400/70" />
            <div className="pointer-events-none absolute left-0 top-0 h-full w-full rounded-[2.25rem] border border-white/5 opacity-50" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.08),_transparent_16%)]" />
            <div className="pointer-events-none absolute left-2 top-2 h-1 w-24 rounded-full bg-white/40 blur-sm animate-[pulse_3s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute right-2 bottom-8 h-1 w-32 rounded-full bg-sky-300/40 blur-sm animate-[pulse_4s_ease-in-out_infinite]" />

            <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 pb-3 text-white/90">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-sky-200/80">
                    Aether Chat
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                    Live assistant
                  </h2>
                </div>

                {isVoiceRunning && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-sky-300"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
                    </span>
                    Voice Mode
                  </motion.div>
                )}
              </div>

              <button
                type="button"
                onClick={clearMessages}
                className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-sky-100 transition hover:bg-sky-400/25"
              >
                Clear
              </button>
            </div>

            <div className="relative z-10 flex-1 overflow-hidden">
              <div ref={containerRef} onScroll={handleScroll} className="mt-3 h-96 overflow-y-auto rounded-[1.75rem] border border-white/10 bg-black/10 p-3 scrollbar-custom">
                {messages.length === 0 && (
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/10 p-3 text-sm text-slate-100/80">
                    Ask Aether anything by typing below or activating Voice Mode with the microphone button.
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {messages.map((message) => {
                    const isAssistant = message.role === "assistant";

                    return (
                      <div
                        key={message.id}
                        className={`flex max-w-[92%] flex-col gap-2 rounded-[1.35rem] border px-3.5 py-3 text-sm shadow-[0_0_30px_rgba(56,189,248,0.08)] backdrop-blur-sm ${
                          isAssistant
                            ? "mr-auto border-white/10 bg-[rgba(255,255,255,0.09)] text-slate-100"
                            : "ml-auto border-sky-300/20 bg-sky-400/20 text-sky-50"
                        }`}
                      >
                        {isAssistant ? (
                          <>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-sky-200/70">
                              <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                              Aether
                            </div>
                            {message.text ? (
                              <MarkdownMessage content={message.text} />
                            ) : isStreaming ? (
                              <div className="flex items-center gap-2 text-slate-200/90">
                                <LightningLoader />
                                <span className="text-xs uppercase tracking-[0.2em] text-slate-300">
                                  Thinking...
                                </span>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="whitespace-pre-wrap leading-7 text-sky-50/95">{message.text}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
              </div>

              <AnimatePresence>
                {!isAtBottom && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    type="button"
                    onClick={() => scrollToBottom("smooth")}
                    className="absolute bottom-6 right-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-sky-950/80 text-sky-300 hover:bg-sky-900 shadow-[0_4px_12px_rgba(56,189,248,0.25)] backdrop-blur-sm transition pointer-events-auto"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>

        <motion.aside
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="pointer-events-auto w-full overflow-hidden rounded-[2rem] border border-white/10 bg-transparent px-4 py-3 text-sm text-slate-100 shadow-[0_0_40px_rgba(56,189,248,0.08)]"
        >
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[rgba(5,10,20,0.59)] px-4 py-3">
            <div className="pointer-events-none absolute -left-4 top-2 h-14 w-14 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="pointer-events-none absolute right-8 bottom-6 h-0.5 w-20 rounded-full bg-white/40 animate-[pulse_2.5s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute left-4 bottom-12 h-0.5 w-24 rounded-full bg-sky-300/30 animate-[ping_2s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-sky-400/70 via-white/50 to-transparent" />
            <div className="pointer-events-none absolute left-0 bottom-0 h-1 w-full bg-gradient-to-r from-transparent via-white/50 to-sky-400/80" />

            {/* Voice Status & Live Indicator Banner */}
            <AnimatePresence>
              {isVoiceRunning && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="relative overflow-hidden rounded-[1.25rem] border border-sky-400/30 bg-gradient-to-r from-sky-950/60 via-slate-900/60 to-orange-700 px-3.5 py-2 text-xs backdrop-blur-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {isListening ? (
                        <div className="relative flex h-3 w-3 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                        </div>
                      ) : isSpeaking ? (
                        <Volume2 className="h-4 w-4 text-purple-400 animate-pulse shrink-0" />
                      ) : isProcessing ? (
                        <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
                      ) : (
                        <Radio className="h-4 w-4 text-sky-400 animate-pulse shrink-0" />
                      )}

                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold uppercase tracking-[0.2em] text-sky-200">
                          {getVoicePhaseLabel()}
                        </span>
                        {voiceState.transcript && (
                          <span className="truncate text-[11px] text-slate-300 italic">
                            "{voiceState.transcript}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Animated Audio Equalizer Waves */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(isListening || isSpeaking) && (
                        <div className="flex items-end gap-0.5 h-4">
                          <div className="w-1 bg-cyan-400 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" />
                          <div className="w-1 bg-sky-300 rounded-full animate-[bounce_1.1s_ease-in-out_infinite_0.2s]" />
                          <div className="w-1 bg-purple-400 rounded-full animate-[bounce_0.9s_ease-in-out_infinite_0.4s]" />
                          <div className="w-1 bg-indigo-300 rounded-full animate-[bounce_1.2s_ease-in-out_infinite_0.1s]" />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void voice.stop()}
                        title="Cancel Voice Interaction"
                        className="flex items-center justify-center h-6 w-6 rounded-full border border-black bg-black text-white-300 hover:bg-gray-800 transition"
                      >
                        <Square className="h-3 w-3 fill-current" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form
              onSubmit={handleSubmit}
              className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="flex-1 rounded-[1.5rem] border border-white/10 bg-transparent px-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-sky-200/70">Input</p>
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    isVoiceRunning
                      ? "Voice active. Speak naturally or type..."
                      : "Ask Aether anything..."
                  }
                  className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-200/60"
                  disabled={isStreaming}
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Voice Microphone Toggle Button */}
                <button
                  type="button"
                  onClick={() => void voice.toggle()}
                  disabled={!voice.supported || isStreaming}
                  title={
                    !voice.supported
                      ? "Voice engine not supported in browser"
                      : isVoiceRunning
                      ? "Stop Voice Engine"
                      : 'Start Voice Engine (Say "Aether")'
                  }
                  className={`relative inline-flex h-11 w-11 items-center justify-center rounded-[1.5rem] border text-sm transition-all duration-300 ${
                    !voice.supported
                      ? "cursor-not-allowed border-white/10 bg-white/5 text-slate-500"
                      : isVoiceRunning
                      ? isListening
                        ? "border-red-400/60 bg-red-500/20 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse"
                        : isSpeaking
                        ? "border-purple-400/60 bg-purple-500/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                        : "border-sky-400/60 bg-sky-500/20 text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                      : "border-white/15 bg-white/5 text-slate-300 hover:border-sky-300/40 hover:bg-sky-400/15 hover:text-white"
                  }`}
                >
                  {isVoiceRunning ? (
                    isListening ? (
                      <Mic className="h-5 w-5 text-red-400" />
                    ) : isSpeaking ? (
                      <Volume2 className="h-5 w-5 text-purple-300" />
                    ) : (
                      <Radio className="h-5 w-5 text-sky-300 animate-spin" />
                    )
                  ) : voice.supported ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isStreaming}
                  className="inline-flex h-11 items-center justify-center rounded-[1.5rem] border border-sky-300/40 bg-sky-400/15 px-4 text-[11px] uppercase tracking-[0.25em] text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStreaming ? "Streaming" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </motion.aside>
      </motion.div>
    </>
  );
}

