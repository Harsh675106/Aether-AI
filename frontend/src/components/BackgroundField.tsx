export function BackgroundField() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,0.12),transparent_28%),linear-gradient(135deg,rgba(9,16,32,1),rgba(4,10,20,1)_45%,rgba(11,18,28,1))]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute -inset-24 animate-particle-drift opacity-40 [background-image:radial-gradient(circle,rgba(255,255,255,0.35)_1px,transparent_1.5px)] [background-size:64px_64px]" />
    </div>
  );
}

