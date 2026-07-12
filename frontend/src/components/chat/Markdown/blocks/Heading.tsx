import React from "react";

import { AnimatedBlock } from "./AnimatedBlock";
import { getCalloutType } from "../utils";

interface CustomHeadingProps {
  level: number;
  children: React.ReactNode;
}

export const CustomHeading = React.memo(
  ({ level, children }: CustomHeadingProps) => {
    let textContent = "";

    React.Children.forEach(children, (child) => {
      if (typeof child === "string") {
        textContent += child;
      }
    });

    const callout = getCalloutType(textContent);

    if (callout) {
      const { config } = callout;
      const Icon = config.icon;

      return (
        <AnimatedBlock>
          <div
            className={`
              group relative my-7 overflow-hidden
              rounded-2xl
              border ${config.border}
              ${config.bg}
              px-5 py-4
              backdrop-blur-xl
              shadow-[0_8px_30px_rgba(0,0,0,0.18)]
              transition-all duration-300
              hover:border-white/20
            `}
          >
            {/* Accent Glow */}
            <div
              className={`absolute left-0 top-0 h-full w-1 rounded-full ${config.bg}`}
            />

            <div className="flex items-center gap-3">
              <Icon
                className={`h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110 ${config.accent}`}
              />

              <span
                className={`
                  text-sm
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  ${config.accent}
                `}
              >
                {textContent}
              </span>
            </div>
          </div>
        </AnimatedBlock>
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