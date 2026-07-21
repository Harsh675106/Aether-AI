import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useSmartScroll } from "./useSmartScroll";

describe("useSmartScroll", () => {
  let mockElement: any;
  let eventListeners: { [key: string]: Function } = {};

  beforeEach(() => {
    eventListeners = {};
    mockElement = {
      scrollHeight: 500,
      scrollTop: 0,
      clientHeight: 200,
      scrollTo: vi.fn().mockImplementation((options) => {
        if (options?.top !== undefined) {
          mockElement.scrollTop = options.top;
        }
      }),
      addEventListener: vi.fn().mockImplementation((event, callback) => {
        eventListeners[event] = callback;
      }),
      removeEventListener: vi.fn().mockImplementation((event) => {
        delete eventListeners[event];
      }),
    };
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  it("initializes with isAtBottom as true", () => {
    const { result } = renderHook(() => useSmartScroll([[]]));
    expect(result.current.isAtBottom).toBe(true);
    expect(result.current.isAutoScrollEnabled()).toBe(true);
  });

  it("scrolls to bottom when dependencies change and auto scroll is enabled", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useSmartScroll(deps),
      {
        initialProps: { deps: [1] },
      }
    );

    result.current.containerRef.current = mockElement;

    // First rerender: triggers initial scroll which is instant scroll
    act(() => {
      rerender({ deps: [2] });
    });
    // For initial scroll, it sets scrollTop directly to target (500 - 200 = 300)
    expect(mockElement.scrollTop).toBe(300);

    // Reset scrollTop to test subsequent smooth scroll animation
    mockElement.scrollTop = 0;

    // Second rerender: triggers smooth scroll animation (via startScrollAnimation)
    act(() => {
      rerender({ deps: [3] });
    });

    // Custom animation should have run and set scrollTop to target
    expect(mockElement.scrollTop).toBe(300);
  });

  it("pauses auto scroll when scrolled up beyond threshold", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useSmartScroll(deps),
      {
        initialProps: { deps: [1] },
      }
    );
    result.current.containerRef.current = mockElement;

    // Mount listeners
    act(() => {
      rerender({ deps: [2] });
    });

    // Simulate user scrolling up (scrollTop = 100, distanceFromBottom = 200 > threshold 60)
    mockElement.scrollTop = 100;

    act(() => {
      result.current.handleScroll();
    });

    expect(result.current.isAtBottom).toBe(false);
    expect(result.current.isAutoScrollEnabled()).toBe(false);
  });

  it("resumes auto scroll when scrolled back near bottom", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useSmartScroll(deps),
      {
        initialProps: { deps: [1] },
      }
    );
    result.current.containerRef.current = mockElement;

    // Mount listeners
    act(() => {
      rerender({ deps: [2] });
    });

    // Scroll up first
    mockElement.scrollTop = 100;
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAtBottom).toBe(false);

    // Scroll back down (distanceFromBottom = 10 <= threshold 60)
    mockElement.scrollTop = 290;
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAtBottom).toBe(true);
    expect(result.current.isAutoScrollEnabled()).toBe(true);
  });

  it("stops programmatic scroll and pauses auto-scroll on user interaction", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useSmartScroll(deps),
      {
        initialProps: { deps: [1] },
      }
    );
    result.current.containerRef.current = mockElement;

    // Mount listeners and trigger initial scroll
    act(() => {
      rerender({ deps: [2] });
    });

    // Trigger programmatic smooth scroll
    act(() => {
      result.current.scrollToBottom("smooth");
    });

    // Trigger a user interaction event (e.g. wheel)
    expect(eventListeners["wheel"]).toBeDefined();
    act(() => {
      eventListeners["wheel"]();
    });

    // Verify it disabled programmatic scroll and auto-scroll when far from bottom
    mockElement.scrollTop = 100;
    act(() => {
      result.current.handleScroll();
    });

    expect(result.current.isAtBottom).toBe(false);
    expect(result.current.isAutoScrollEnabled()).toBe(false);
  });
});
