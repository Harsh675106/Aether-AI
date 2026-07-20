import React from "react";

import { AnimatedBlock } from "./AnimatedBlock";
import { CalloutBlock } from "./CalloutBlock";
import { extractTextContent, getCalloutType } from "../utils";

interface CustomHeadingProps {
  level: number;
  children: React.ReactNode;
}

export const CustomHeading = React.memo(
  ({ level, children }: CustomHeadingProps) => {
    const textContent = extractTextContent(children);
    const callout = getCalloutType(textContent);

    if (callout) {
      const { config } = callout;
      const Icon = config.icon;

      return (
        <CalloutBlock title={textContent} config={config}>
          <span className={`text-sm font-semibold uppercase tracking-[0.18em] ${config.accent}`}>
            {textContent}
          </span>
        </CalloutBlock>
      );
    }

    const styles = {
      1: {
        size: "text-3xl md:text-4xl",
        color: "text-white",
        accent: "bg-sky-400",
        spacing: "mt-10 mb-5",
      },
      2: {
        size: "text-2xl md:text-3xl",
        color: "text-slate-100",
        accent: "bg-violet-400",
        spacing: "mt-8 mb-4",
      },
      3: {
        size: "text-xl md:text-2xl",
        color: "text-slate-200",
        accent: "bg-emerald-400",
        spacing: "mt-7 mb-3",
      },
    };

    const current =
      styles[level as keyof typeof styles] ?? {
        size: "text-lg",
        color: "text-slate-300",
        accent: "bg-slate-500",
        spacing: "mt-6 mb-2",
      };

    return (
      <AnimatedBlock>
        <div
          className={`
            group
            relative
            flex
            items-center
            gap-4
            ${current.spacing}
          `}
        >
          {/* Accent Bar */}
          <div
            className={`
              h-8
              w-1
              rounded-full
              ${current.accent}
              shadow-lg
              transition-all
              duration-300
              group-hover:h-10
            `}
          />

          <div
            className={`
              ${current.size}
              ${current.color}
              font-bold
              tracking-tight
              transition-colors
              duration-300
              group-hover:text-white
            `}
          >
            {children}
          </div>
        </div>
      </AnimatedBlock>
    );
  }
);

CustomHeading.displayName = "CustomHeading";