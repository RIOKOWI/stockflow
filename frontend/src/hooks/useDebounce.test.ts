
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./useDebounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebounce", () => {
  it("returns the initial value right away", () => {
    const { result } = renderHook(() => useDebounce("lap"));

    expect(result.current).toBe("lap");
  });

  it("keeps the old value until the delay has passed", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: "l" } },
    );

    rerender({ value: "lap" });

    expect(result.current).toBe("l");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("l");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("lap");
  });

  it("only settles on the last value of a burst", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: "" } },
    );

    for (const value of ["l", "la", "lap", "lapt", "laptop"]) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("laptop");
  });

  it("resets the timer on every change", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("abc");
  });
});
