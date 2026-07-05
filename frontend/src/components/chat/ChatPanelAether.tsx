import { motion } from "framer-motion";
import { useState } from "react";

import { AetherLogo } from "@/components/aether/AetherLogo";
import { LightningLoader } from "@/components/chat/LightningLoader";
import { MarkdownMessage } from "@/components/chat/MarkdownMessage";
import { useChat } from "@/hooks/useChat";

export function ChatPanelAether() {
  const [draft, setDraft] = useState("");
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChat();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }

    const message = draft.trim();
    setDraft("");
    await sendMessage(message);
  };

  return (
    <>
      <AetherLogo />
      <motion.div className="pointer-events-none absolute left-4 top-1/2  mt-4 z-30 hidden -translate-y-1/2 flex w-[min(44rem,calc(100%-2rem))]
flex-col gap-3 md:flex lg:left-6 lg:w-[52rem] ">
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
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-sky-200/80">
                  Aether Chat
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                  Live assistant
                </h2>
              </div>
              <button
                type="button"
                onClick={clearMessages}
                className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-sky-100 transition hover:bg-sky-400/25"
              >
                Clear
              </button>
            </div>

            <div className="relative z-10  flex-1 overflow-hidden">
              <div className="mt-3 h-96 overflow-y-auto rounded-[1.75rem] border border-white/10 bg-black/10 p-3 scrollbar-custom">
                {messages.length === 0 && (
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/10 p-3 text-sm text-slate-100/80">
                    Ask Aether anything and the response will stream in live.
                  </div>
                )}
                <div className="flex flex-col gap-2 ">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-[1.25rem] px-3 py-2 text-sm text-pretty ${message.role === "user" ? "ml-auto bg-sky-400/20 text-sky-50" : "bg-white/10 text-slate-100"}`}
                    >
                      {message.role === "assistant" ? (
                        message.text ? (
                          <MarkdownMessage content={message.text} />
                        ) : isStreaming ? (
                          <LightningLoader />
                        ) : null
                      ) : (
                        message.text
                      )}
                    </div>
                  ))}
                </div>
                {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
              </div>
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
            <div className="pointer-events-none absolute right-4 top-4 h-1 w-20 rounded-full bg-white/40 blur-sm animate-[pulse_3s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute left-4 bottom-4 h-1 w-16 rounded-full bg-sky-300/35 blur-sm animate-[pulse_4s_ease-in-out_infinite]" />
            <form
              onSubmit={handleSubmit}
              className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="flex-1 rounded-[1.5rem] border border-white/10 bg-transparent px-4 ">
                <p className="text-[10px] uppercase tracking-[0.3em] text-sky-200/70">Input</p>
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask Aether anything..."
                  className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-200/60"
                  disabled={isStreaming}
                />
              </div>
              <button
                type="submit"
                disabled={isStreaming}
                className="inline-flex h-11 items-center justify-center rounded-[1.5rem] border border-sky-300/40 bg-sky-400/15 px-4 text-[11px] uppercase tracking-[0.25em] text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStreaming ? "Streaming" : "Send"}
              </button>
            </form>
          </div>
        </motion.aside>
      </motion.div>
    </>
  );
}
