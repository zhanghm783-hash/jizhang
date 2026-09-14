import { describe, expect, it } from "vitest";
import { currentMonth, formatMonthLabel, monthAdd } from "./date";

describe("formatMonthLabel", () => {
  it("把 2026-09 转成 2026年9月", () => {
    expect(formatMonthLabel("2026-09")).toBe("2026年9月");
  });

  it("个位数月份不带前导零：2026-01 → 2026年1月", () => {
    expect(formatMonthLabel("2026-01")).toBe("2026年1月");
  });
});

describe("monthAdd", () => {
  it("加一个月：2026-09 → 2026-10", () => {
    expect(monthAdd("2026-09", 1)).toBe("2026-10");
  });

  it("减一个月：2026-09 → 2026-08", () => {
    expect(monthAdd("2026-09", -1)).toBe("2026-08");
  });

  it("跨年：2026-01 减一个月是 2025-12", () => {
    expect(monthAdd("2026-01", -1)).toBe("2025-12");
  });

  it("跨年：2025-12 加一个月是 2026-01", () => {
    expect(monthAdd("2025-12", 1)).toBe("2026-01");
  });
});

describe("currentMonth", () => {
  it("返回 YYYY-MM 格式", () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
