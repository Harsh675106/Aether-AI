import { motion } from "framer-motion";

const stats = [
  { label: "CPU", value: "72%", detail: "Core 0: 68% | Core 1: 75%" },
  { label: "RAM", value: "64%", detail: "14.8 / 23 GB used" },
  { label: "GPU", value: "81%", detail: "RTX 4080 | 8 GB VRAM" },
  { label: "MODEL", value: "GPT-Aether", detail: "v1.2.0 • 1.9B params" },
  { label: "STATUS", value: "ONLINE", detail: "Latency 17ms • Stable", active: true },
  { label: "⚙", value: "CFG", detail: "Auto-optimize enabled" },
];

export function StatusPanel() {
  return (
    <>
      <style>{`
        @keyframes statusShine {
          0% { transform: translateX(-120%); opacity: 0; }
          50% { transform: translateX(120%); opacity: 0.24; }
          100% { transform: translateX(260%); opacity: 0; }
        }

        @keyframes borderPulse {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <motion.nav
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="status-panel absolute right-6 top-6 z-40 flex w-[clamp(55%,62rem,70%)] flex-col gap-3 rounded-[3rem] border border-white/20 bg-[rgba(10,16,32,0.10)] px-4 py-3 shadow-[0_32px_120px_rgba(8,15,30,0.28)] backdrop-blur-sm"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
          border: "1px solid rgba(255,255,255,0.22)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[3rem]">
          <div className="absolute inset-0 rounded-[3rem] border border-white/25 shadow-[0_0_28px_rgba(255,255,255,0.14),0_0_52px_rgba(56,189,248,0.16)]" />
          <div
            className="absolute inset-[-2px] rounded-[3rem] bg-[conic-gradient(from_0deg,_transparent_0deg_280deg,rgba(56,189,248,0.72)_280deg_294deg,rgba(255,255,255,0.65)_294deg_302deg,transparent_302deg_360deg)] opacity-80 blur-[10px]"
            style={{ animation: "borderPulse 8s linear infinite" }}
          />
          <div className="absolute left-0 top-0 h-full w-1/3 rounded-full bg-[radial-gradient(circle_at_left,_rgba(56,189,248,0.18),transparent_32%)] blur-3xl opacity-70" />
          <div
            className="absolute inset-y-0 left-[-25%] h-full w-[50%] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.18),transparent_45%)] opacity-40"
            style={{ animation: "statusShine 18s linear infinite" }}
          />
        </div>

        <div className="relative flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.35em] text-slate-200">
          <div className="flex items-center gap-3 ml-4 ">
            <span className="font-semibold text-slate-100">System Status</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-100 shadow-[0_8px_20px_rgba(56,189,248,0.10)] backdrop-blur-sm">
              Live
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-slate-400">
            <span className="rounded-full bg-slate-950/15 px-2 py-1 text-white">AETHER HUB</span>
          </div>
        </div>

        <div className="relative grid grid-cols-6 gap-3">
          {stats.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * index, duration: 0.45, ease: "easeOut" }}
              className={`group relative pointer-events-auto overflow-visible rounded-full border px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.28em] transition duration-300 ease-in-out ${
                item.active
                  ? "border-white/30 bg-slate-950/22 text-white shadow-[0_0_24px_rgba(56,189,248,0.28)]"
                  : "border-white/10 bg-slate-950/10 text-slate-100 shadow-[0_8px_20px_rgba(14,165,233,0.12)] hover:border-white/30 hover:bg-slate-950/20 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.35),0_0_35px_rgba(56,189,248,0.18)]"
              } hover:scale-105`}
            >
              <div className="relative overflow-visible">
                <span className="relative z-10">{item.label}</span>
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 transform rounded-2xl border border-white/15 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.35)] group-hover:block w-max min-w-[12rem]">
                  <div className="font-semibold text-white">{item.value}</div>
                  <div className="mt-1 text-[11px] text-slate-300">{item.detail}</div>
                </span>
              </div>
              <span className="absolute inset-x-1/2 bottom-0 left-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-white via-cyan-300 to-blue-500 opacity-0 transition-all duration-500 ease-in-out group-hover:scale-x-100 group-hover:opacity-100" />
            </motion.div>
          ))}
        </div>
      </motion.nav>
    </>
  );
}
