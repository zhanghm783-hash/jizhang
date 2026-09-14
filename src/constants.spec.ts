import { describe, expect, it } from "vitest";
import { PAYMENT_METHODS, SEED_CATEGORIES } from "./constants";

describe("内置分类种子数据", () => {
  it("有 10 个一级分类", () => {
    expect(SEED_CATEGORIES).toHaveLength(10);
  });

  it("有 50 个二级分类", () => {
    const total = SEED_CATEGORIES.reduce((sum, c) => sum + c.children.length, 0);
    expect(total).toBe(50);
  });

  it("一级分类名称不重复", () => {
    const names = SEED_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("每个一级分类都有图标，二级分类非空且名称不重复", () => {
    for (const cat of SEED_CATEGORIES) {
      expect(cat.icon).toBeTruthy();
      expect(cat.children.length).toBeGreaterThan(0);
      expect(new Set(cat.children).size).toBe(cat.children.length);
    }
  });
});

describe("支付方式", () => {
  it("包含 6 种固定支付方式且不重复", () => {
    expect(PAYMENT_METHODS).toHaveLength(6);
    expect(new Set(PAYMENT_METHODS).size).toBe(PAYMENT_METHODS.length);
  });
});
