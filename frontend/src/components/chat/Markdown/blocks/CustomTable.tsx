import React from "react";

import { AnimatedBlock } from "./AnimatedBlock";

interface CustomTableProps {
  children: React.ReactNode;
}

export const CustomTable = React.memo(
  ({ children }: CustomTableProps) => {
    return (
      <AnimatedBlock>
        <div
          className="
            group
            relative
            my-7
            overflow-hidden
            rounded-2xl
            border border-white/10
            bg-slate-900/15
            backdrop-blur-xl
            shadow-[0_10px_40px_rgba(0,0,0,0.18)]
            transition-all duration-300
            hover:border-sky-400/20
            hover:shadow-[0_10px_45px_rgba(56,189,248,0.08)]
          "
        >
          {/* subtle top glow */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />

          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <table className="min-w-full border-collapse text-left text-sm text-slate-300">
              {children}
            </table>
          </div>
        </div>
      </AnimatedBlock>
    );
  }
);

CustomTable.displayName = "CustomTable";