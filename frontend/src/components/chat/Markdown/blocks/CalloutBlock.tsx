import React from "react";

import { AnimatedBlock } from "./AnimatedBlock";
import type { CalloutConfig } from "../types";

interface CalloutBlockProps {
  title: string;
  config: CalloutConfig;
  children?: React.ReactNode;
}

export function CalloutBlock({ title, config, children }: CalloutBlockProps) {
  const Icon = config.icon;

  return (
    <AnimatedBlock>
      <div
        role="note"
        aria-label={title}
        className={`
          group relative my-7 overflow-hidden rounded-2xl border ${config.border} ${config.bg}
          px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl
          transition-all duration-300 hover:border-white/20
        `}
      >
        <div className={`absolute left-0 top-0 h-full w-1 rounded-full ${config.bg}`} />

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/50">
            <Icon className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${config.accent}`} />
          </div>

          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className={`text-sm font-semibold uppercase tracking-[0.18em] ${config.accent}`}>
                {title}
              </span>
              <span className={`text-sm ${config.accent}`}>{config.emoji}</span>
            </div>
            {children ? <div className={`text-sm leading-7 ${config.text}`}>{children}</div> : null}
          </div>
        </div>
      </div>
    </AnimatedBlock>
  );
}
