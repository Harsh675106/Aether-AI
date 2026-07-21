import { motion } from "framer-motion";

export function AetherLogo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="pointer-events-auto absolute  z-50 hidden md:flex items-center "
    >
      <motion.img
        src="/assets/logo.png"
        alt="Aether Logo"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: 1,
          scale: 1,
          rotate: 360,
        }}
        transition={{
          opacity: { duration: 0.8 },
          scale: { duration: 0.8 },
          rotate: {
            delay: 0.8, // Start rotating after fade-in
            duration: 8,
            ease: "linear",
            repeat: Infinity,
          },
        }}
        className="h-30 w-40 object-contain select-none"
        draggable={false}
      />

      {/* Existing Text */}
      <div className="flex flex-col">
        <h1
          className="text-[54px] font-semibold uppercase tracking-[0.42em] text-white"
          style={{
            fontFamily: "Orbitron, sans-serif",
            textShadow: `
              0 0 10px rgba(59,130,246,.55),
              0 0 25px rgba(249,115,22,.35),
              0 0 45px rgba(59,130,246,.25)
            `,
          }}
        >
          AETHER
        </h1>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-2 h-px bg-gradient-to-r from-cyan-400 via-orange-400 to-transparent"
        />
      </div>
    </motion.div>
  );
}
