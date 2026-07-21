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

  const targetScrollTopRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const isInitialScrollRef = useRef<boolean>(true);
  const prevElementRef = useRef<T | null>(null);

  // Smooth scroll animation using requestAnimationFrame interpolation (lerp)
  const startScrollAnimation = useCallback((target: number) => {
    targetScrollTopRef.current = target;
    isProgrammaticScrollRef.current = true;

    const animate = () => {
      const el = containerRef.current;
      if (!el) {
        animationFrameIdRef.current = null;
        return;
      }

      // If auto-scroll is enabled, continuously update target to the current bottom.
      // This ensures we smoothly follow new logs appended during the animation.
      if (isAutoScrollEnabledRef.current) {
        targetScrollTopRef.current = el.scrollHeight - el.clientHeight;
      }

      const current = el.scrollTop;
      const targetVal = targetScrollTopRef.current;

      // Snap to target if very close
      if (Math.abs(targetVal - current) < 1.5) {
        el.scrollTop = targetVal;
        animationFrameIdRef.current = null;
        isProgrammaticScrollRef.current = false;
        return;
      }

      // Interpolation step
      const next = current + (targetVal - current) * 0.15;
      el.scrollTop = next;

      // If we couldn't make progress (clamped at boundary or subpixel rounding limit), stop
      if (Math.abs(el.scrollTop - current) < 0.1) {
        el.scrollTop = targetVal;
        animationFrameIdRef.current = null;
        isProgrammaticScrollRef.current = false;
        return;
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    if (!animationFrameIdRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;

    const target = el.scrollHeight - el.clientHeight;
    isAutoScrollEnabledRef.current = true;
    setIsAtBottom(true);

    if (behavior === "smooth") {
      startScrollAnimation(target);
    } else {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      el.scrollTop = target;
      isProgrammaticScrollRef.current = false;
    }
  }, [startScrollAnimation]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= threshold;

    if (nearBottom) {
      isAutoScrollEnabledRef.current = true;
      setIsAtBottom(true);
    } else {
      // Pause auto-scroll only if it is a user-initiated scroll
      if (!isProgrammaticScrollRef.current) {
        isAutoScrollEnabledRef.current = false;
        setIsAtBottom(false);
      }
    }
  }, [threshold]);

  const handleUserInteraction = useCallback(() => {
    isProgrammaticScrollRef.current = false;
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  }, []);

  // Set up user interaction listeners
  useEffect(() => {
    const el = containerRef.current;
    if (el === prevElementRef.current) return;

    if (prevElementRef.current) {
      const prevEl = prevElementRef.current;
      prevEl.removeEventListener("wheel", handleUserInteraction);
      prevEl.removeEventListener("touchmove", handleUserInteraction);
      prevEl.removeEventListener("pointerdown", handleUserInteraction);
      prevEl.removeEventListener("keydown", handleUserInteraction);
    }

    if (el) {
      const options = { passive: true };
      el.addEventListener("wheel", handleUserInteraction, options);
      el.addEventListener("touchmove", handleUserInteraction, options);
      el.addEventListener("pointerdown", handleUserInteraction, options);
      el.addEventListener("keydown", handleUserInteraction, options);
      prevElementRef.current = el;
    }

    return () => {
      if (prevElementRef.current) {
        const prevEl = prevElementRef.current;
        prevEl.removeEventListener("wheel", handleUserInteraction);
        prevEl.removeEventListener("touchmove", handleUserInteraction);
        prevEl.removeEventListener("pointerdown", handleUserInteraction);
        prevEl.removeEventListener("keydown", handleUserInteraction);
      }
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [dependencies, handleUserInteraction]);

  // Handle dependency changes (e.g. new logs)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isAutoScrollEnabledRef.current) return;

    const target = el.scrollHeight - el.clientHeight;

    if (isInitialScrollRef.current) {
      el.scrollTop = target;
      isInitialScrollRef.current = false;
      setIsAtBottom(true);
    } else {
      startScrollAnimation(target);
    }
  }, dependencies);

  return {
    containerRef,
    handleScroll,
    scrollToBottom,
    isAtBottom,
    isAutoScrollEnabled: () => isAutoScrollEnabledRef.current,
  };
}
