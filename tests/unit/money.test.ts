import { describe, expect, it } from "vitest";
import { formatCompact, formatMoney, formatPercent, fromMinor, percentChange, toMinor } from "@/lib/money";

describe("money conversion", () => {
  it("converts to and from minor units without float drift", () => {
    expect(toMinor(1234.56)).toBe(123456);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(fromMinor(123456)).toBe(1234.56);
  });
});

describe("formatMoney", () => {
  it("uses Indian digit grouping for INR", () => {
    expect(formatMoney(100000)).toBe("₹1,00,000");
    expect(formatMoney(12345678)).toBe("₹1,23,45,678");
  });

  it("shows decimals only when needed", () => {
    expect(formatMoney(1450.5)).toBe("₹1,450.50");
    expect(formatMoney(1450)).toBe("₹1,450");
  });

  it("handles signs", () => {
    expect(formatMoney(-500)).toBe("-₹500");
    expect(formatMoney(500, "INR", { signed: true })).toBe("+₹500");
  });

  it("formats compact lakh / crore values", () => {
    expect(formatCompact(250000)).toBe("₹2.5L");
    expect(formatCompact(32000000)).toBe("₹3.2Cr");
    expect(formatCompact(1500, "USD")).toBe("$1.5K");
    expect(formatMoney(150000, "INR", { compact: true })).toBe("₹1.5L");
  });
});

describe("percentChange", () => {
  it("computes relative change", () => {
    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(80, 100)).toBeCloseTo(-20);
  });

  it("returns null without a baseline", () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });

  it("formats percentages", () => {
    expect(formatPercent(12.4, { signed: true })).toBe("+12%");
    expect(formatPercent(null)).toBe("—");
  });
});
