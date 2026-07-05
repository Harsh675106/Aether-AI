import { motion } from "framer-motion";
import { Waves } from "lucide-react";

import { useMonitoring } from "@/hooks/useMonitoring";


export function MonitorPanel() {
  const { events } = useMonitoring();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="monitor-panel absolute right-6 top-36 bottom-28 z-30 w-[clamp(35%,40rem,45%)] overflow-hidden rounded-[3rem] border border-white/10 bg-[rgba(5,10,20,0.59)] shadow-[0_20px_70px_rgba(8,15,30,0.14)]"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[3rem] bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.03),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[3rem] border border-white/10 opacity-85 shadow-[0_0_12px_rgba(255,255,255,0.05),0_0_18px_rgba(56,189,248,0.06)]" />

      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-sky-300/80">Aether Live</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Live Activity</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
            <Waves className="h-3.5 w-3.5" />
            Live
          </div>
        </div>
        <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
          {/* Animated left timeline */}
          <div className="pointer-events-none absolute left-[13px] top-0 bottom-0 w-px overflow-hidden">
            <div className="absolute inset-0 bg-cyan-400/20" />
            <div className="absolute top-0 h-24 w-full bg-gradient-to-b from-cyan-300 via-cyan-400 to-transparent animate-[pulse_2s_linear_infinite]" />
          </div>

          <div
  className="h-full min-h-0 overflow-y-auto pr-3 font-mono
    [&::-webkit-scrollbar]:w-1.5
    [&::-webkit-scrollbar-thumb]:rounded-full
    [&::-webkit-scrollbar-thumb]:bg-cyan-400/50
    [&::-webkit-scrollbar-track]:bg-transparent"
>
            {events.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_#5EEBFF] animate-pulse" />

                    <div className="absolute inset-0 rounded-full bg-cyan-300 animate-ping opacity-40" />
                  </div>

                  <span className="text-cyan-300 uppercase tracking-[0.35em] text-sm">
                    Waiting For Live Activity...
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pb-10">
                {events.map((event, index) => {
                  const latest = index === events.length - 1;

                  const tone =
                    event.severity === "success"
                      ? {
                          dot: "bg-emerald-400",
                          text: "text-emerald-300",
                          glow: "shadow-[0_0_18px_#4ADE80]",
                          label: "SUCCESS",
                          icon: "✓",
                        }
                      : event.severity === "warning"
                        ? {
                            dot: "bg-orange-400",
                            text: "text-orange-300",
                            glow: "shadow-[0_0_18px_#FB923C]",
                            label: "WARNING",
                            icon: "⚡",
                          }
                        : {
                            dot: "bg-cyan-400",
                            text: "text-cyan-300",
                            glow: "shadow-[0_0_18px_#5EEBFF]",
                            label: "INFO",
                            icon: "◉",
                          };

                  return (
                    <div
                      key={event.event_id}
                      className={`relative pl-10 transition-all duration-300 ${
                        latest ? "scale-[1.01]" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {/* Timeline Node */}

                      <div
                        className={`absolute left-[5px] top-3 h-4 w-4 rounded-full border-2 border-black ${tone.dot} ${tone.glow}`}
                      >
                        {latest && (
                          <div
                            className={`absolute inset-0 rounded-full ${tone.dot} animate-ping opacity-40`}
                          />
                        )}
                      </div>

                      {/* Log */}

                      <div className="group">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-white/40 text-xs">
                            {new Date(event.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>

                          <span className={`${tone.text} font-bold tracking-[0.2em] text-xs`}>
                            {tone.icon} {tone.label}
                          </span>

                          <span className="uppercase tracking-[0.25em] text-cyan-200 text-xs">
                            {event.subsystem}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 overflow-hidden">
                          <span
                            className={`shrink-0 text-[15px] font-semibold ${
                              latest ? "text-white" : "text-white/90"
                            }`}
                          >
                            {event.title}
                          </span>

                          {event.description && (
                            <>
                              <span className="text-cyan-300/50">—</span>

                              <span className="min-w-0 flex-1 truncate text-[13px] text-white/65">
                                {event.description}
                              </span>
                            </>
                          )}

                          {latest && (
                            <span className="ml-1 h-5 w-[2px] bg-cyan-300 animate-pulse shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
