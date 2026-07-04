import { motion } from "framer-motion";
import { Activity, AlertTriangle, BrainCircuit, Database, Network, Search, Sparkles, Waves } from "lucide-react";

import { useMonitoring } from "@/hooks/useMonitoring";

const statusTone = (severity: string) => {
  switch (severity) {
    case "success":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "error":
    case "critical":
      return "border-rose-400/30 bg-rose-500/10 text-rose-200";
    case "debug":
      return "border-violet-400/30 bg-violet-500/10 text-violet-200";
    case "trace":
      return "border-slate-400/30 bg-slate-500/10 text-slate-200";
    default:
      return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  }
};

const healthBadges = [
  { label: "Frontend", tone: "text-sky-300" },
  { label: "Backend", tone: "text-indigo-300" },
  { label: "LLM", tone: "text-violet-300" },
  { label: "Ollama", tone: "text-cyan-300" },
  { label: "Memory", tone: "text-emerald-300" },
  { label: "Search", tone: "text-amber-300" },
  { label: "Database", tone: "text-teal-300" },
  { label: "WebSocket", tone: "text-sky-300" },
];

export function MonitorPanel() {
  const { events, stats } = useMonitoring();
  const current = events[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="monitor-panel absolute right-6 top-36 bottom-28 z-30 w-[clamp(55%,62rem,70%)] overflow-hidden rounded-[3rem] border border-white/10 bg-[rgba(12,18,32,0.06)] shadow-[0_20px_70px_rgba(8,15,30,0.14)]"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[3rem] bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.03),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[3rem] border border-white/10 opacity-85 shadow-[0_0_12px_rgba(255,255,255,0.05),0_0_18px_rgba(56,189,248,0.06)]" />

      <div className="relative h-full p-5">
        <div className="h-full rounded-[2.5rem] border border-white/10 bg-[rgba(15,23,42,0.18)] p-4">
          <div className="flex h-full flex-col rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 text-sm text-slate-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-sky-300/80">Aether Ops</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Real-time AI Operations Center</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
                <Waves className="h-3.5 w-3.5" />
                Live
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-200">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm font-semibold">Live activity</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Streaming</div>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-100">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-sky-300/80">Current task</div>
                    <div className="mt-1 font-medium">{current?.title || "Awaiting first event"}</div>
                    <div className="mt-1 text-sm text-slate-300">{current?.description || "The operation stream is loading..."}</div>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {events.slice(0, 8).map((event) => (
                      <div key={event.event_id} className={`rounded-xl border p-2 text-sm ${statusTone(event.severity)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{event.title}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em]">{event.subsystem}</span>
                        </div>
                        <div className="mt-1 text-xs opacity-80">{event.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-3">
                  <div className="mb-3 flex items-center gap-2 text-violet-200">
                    <BrainCircuit className="h-4 w-4" />
                    <span className="text-sm font-semibold">System health</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {healthBadges.map((badge) => (
                      <span key={badge.label} className={`rounded-full border border-white/10 px-2.5 py-1 text-[11px] ${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-3">
                  <div className="mb-3 flex items-center gap-2 text-emerald-200">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-semibold">Live counters</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Events</div>
                      <div className="mt-1 font-semibold text-white">{stats.events}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Errors</div>
                      <div className="mt-1 font-semibold text-rose-300">{stats.errors}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Warnings</div>
                      <div className="mt-1 font-semibold text-amber-300">{stats.warnings}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Success</div>
                      <div className="mt-1 font-semibold text-emerald-300">{stats.successes}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-3">
                  <div className="mb-3 flex items-center gap-2 text-amber-200">
                    <Search className="h-4 w-4" />
                    <span className="text-sm font-semibold">Subsystem focus</span>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span>Web search</span><span className="text-amber-300">Live</span></div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span>Memory</span><span className="text-emerald-300">Live</span></div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span>Streaming</span><span className="text-cyan-300">Live</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
