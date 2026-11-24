import { describe, expect, it } from "vitest";
import { formatIDR } from "./currency";

describe("formatIDR", () => {
  it("formats zero", () => {
    expect(formatIDR(0)).toContain("0");
  });

  it("formats a normal amount", () => {
    expect(formatIDR(150000)).toMatch(/150[.\s]?000/);
  });

  it("formats a large amount with thousand separators", () => {
    expect(formatIDR(1250000)).toMatch(/1[.\s]?250[.\s]?000/);
  });
});
