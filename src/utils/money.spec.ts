import { describe, expect, it } from "vitest";
import { formatYuan } from "./money";

describe("formatYuan", () => {
  it("分转元：12345 → 123.45", () => {
    expect(formatYuan(12345)).toBe("123.45");
  });

  it("不足一元补零：5 → 0.05", () => {
    expect(formatYuan(5)).toBe("0.05");
  });

  it("整元保留两位小数：100 → 1.00", () => {
    expect(formatYuan(100)).toBe("1.00");
  });

  it("零元：0 → 0.00", () => {
    expect(formatYuan(0)).toBe("0.00");
  });
});
