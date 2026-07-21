import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useSmartScroll } from "./useSmartScroll";

describe("useSmartScroll", () => {
  let mockElement: any;

  beforeEach(() => {
    mockElement = {
      scrollHeight: 500,
      scrollTop: 0,
      clientHeight: 200,
      scrollTo: vi.fn().mockImplementation((options) => {
        if (options?.top !== undefined) {
          mockElement.scrollTop = options.top;
        }
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

    act(() => {
      rerender({ deps: [2] });
    });

    expect(mockElement.scrollTo).toHaveBeenCalledWith({
      top: mockElement.scrollHeight,
      behavior: "smooth",
    });
  });

  it("pauses auto scroll when scrolled up beyond threshold", () => {
    const { result } = renderHook(() => useSmartScroll([[]]));
    result.current.containerRef.current = mockElement;

    // Simulate user scrolling up (scrollTop = 100, scrollHeight = 500, clientHeight = 200, distanceFromBottom = 200 > threshold 60)
    mockElement.scrollTop = 100;

    act(() => {
      result.current.handleScroll();
    });

    expect(result.current.isAtBottom).toBe(false);
    expect(result.current.isAutoScrollEnabled()).toBe(false);
  });

  it("resumes auto scroll when scrolled back near bottom", () => {
    const { result } = renderHook(() => useSmartScroll([[]]));
    result.current.containerRef.current = mockElement;

    // Scroll up first
    mockElement.scrollTop = 100;
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAtBottom).toBe(false);

    // Scroll back down (scrollTop = 290, scrollHeight = 500, clientHeight = 200, distanceFromBottom = 10 <= threshold 60)
    mockElement.scrollTop = 290;
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAtBottom).toBe(true);
    expect(result.current.isAutoScrollEnabled()).toBe(true);
  });
});
