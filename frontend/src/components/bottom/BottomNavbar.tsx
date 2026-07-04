import { motion } from "framer-motion";

const navItems = [
  "Logs",
  "Memory",
  "Tools",
  "Tasks",
  "Plugins",
  "Files",
  "Notifications",
  "Settings",
];

export function BottomNavbar() {
  return (
    <>
      <style>{`
        @keyframes bottomPulse {
          0% { transform: translateX(-140%); }
          100% { transform: translateX(240%); }
        }
      `}</style>

      <motion.nav
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute left-6 right-6 bottom-6 z-40 mx-auto flex max-w-[calc(100vw-3rem)] flex-wrap items-center justify-center gap-3 rounded-[3rem] border border-white/20 bg-[rgba(10,16,32,0.10)] px-4 py-3 shadow-[0_32px_120px_rgba(8,15,30,0.28)] backdrop-blur-sm"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
          border: "1px solid rgba(255,255,255,0.22)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[3rem]">
          <div className="absolute inset-0 rounded-[3rem] border border-white/25 shadow-[0_0_24px_rgba(255,255,255,0.12),0_0_48px_rgba(56,189,248,0.14)]" />
          <div
            className="absolute inset-[-2px] rounded-[3rem] bg-[conic-gradient(from_0deg,transparent_0deg_280deg,rgba(56,189,248,0.72)_280deg_296deg,rgba(255,255,255,0.7)_296deg_302deg,transparent_302deg_360deg)] opacity-80 blur-[8px]"
            style={{ animation: "bottomPulse 9s linear infinite" }}
          />
        </div>

        <div className="relative flex flex-wrap items-center justify-center gap-8 text-[11px] uppercase tracking-[0.28em] text-slate-200">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className="group relative rounded-full border border-white/10 bg-slate-950/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition duration-300 ease-in-out hover:border-white/30 hover:bg-slate-950/25 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.28)]"
            >
              {item}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-white via-cyan-300 to-blue-500 opacity-0 transition duration-300 ease-in-out group-hover:scale-x-100 group-hover:opacity-90" />
            </button>
          ))}
        </div>
      </motion.nav>
    </>
  );
}
