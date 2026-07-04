export function LightningLoader() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-8">

      {/* Outer Energy Ring */}
      <div className="absolute h-44 w-44 rounded-full border border-cyan-400/20 animate-spin [animation-duration:8s]" />

      {/* Middle Ring */}
      <div className="absolute h-32 w-32 rounded-full border-2 border-blue-400/40 animate-spin-reverse [animation-duration:6s]" />

      {/* Glow */}
      <div className="absolute h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />

      {/* Lightning Core */}
      <div className="relative flex items-center justify-center">

        {/* White Glow */}
        <div className="absolute h-24 w-24 rounded-full bg-white/40 blur-2xl animate-pulse" />

        {/* Blue Glow */}
        <div className="absolute h-20 w-20 rounded-full bg-blue-500/40 blur-xl animate-pulse" />

        {/* SVG Lightning */}
        <svg
          viewBox="0 0 100 100"
          className="relative h-16 w-16 drop-shadow-[0_0_25px_rgba(59,130,246,1)] animate-pulse"
          fill="url(#boltGradient)"
        >
          <defs>
            <linearGradient id="boltGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>

          <path d="M56 4L22 52h20l-8 44 44-58H58l8-34z" />
        </svg>

      </div>

      {/* Progress */}
      <div className="relative h-2 w-72 overflow-hidden rounded-full bg-white/10 backdrop-blur">

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-pulse" />

        <div className="h-full w-full origin-left animate-[loading_2.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-white via-sky-300 to-blue-600 shadow-[0_0_25px_#3b82f6]" />

      </div>

      {/* Loading Text */}
      <div className="font-semibold tracking-[0.4em] uppercase text-cyan-200">
        Synthesizing...
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_12px_white] animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}