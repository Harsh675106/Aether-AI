import { useCallback, useEffect, useRef, useState } from "react";

export type SmartScrollOptions = {
  threshold?: number;
};

export function useSmartScroll<T extends HTMLElement>(
  dependencies: any[],
  options?: SmartScrollOptions
) {
  const containerRef = useRef<T | null>(null);
  const isAutoScrollEnabledRef = useRef<boolean>(true);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);
  const threshold = options?.threshold ?? 60;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    isAutoScrollEnabledRef.current = true;
    setIsAtBottom(true);
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= threshold;

    isAutoScrollEnabledRef.current = nearBottom;
    setIsAtBottom(nearBottom);
  }, [threshold]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isAutoScrollEnabledRef.current) return;

    const rafId = requestAnimationFrame(() => {
      if (el && isAutoScrollEnabledRef.current) {
        if (typeof el.scrollTo === "function") {
          el.scrollTo({
            top: el.scrollHeight,
            behavior: "smooth",
          });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, dependencies);

  return {
    containerRef,
    handleScroll,
    scrollToBottom,
    isAtBottom,
    isAutoScrollEnabled: () => isAutoScrollEnabledRef.current,
  };
}
