import { describe, expect, it } from "vitest";
import { groupExpensesByDate } from "./group";
import type { ExpenseListItem } from "../types";

/** 造一条测试用账单，只填分组逻辑关心的字段 */
function item(id: number, date: string, cents: number): ExpenseListItem {
  return {
    id,
    amount_cents: cents,
    date,
    category_id: 1,
    payment_method: "微信",
    note: "",
    created_at: "",
    sub_name: "",
    sub_icon: null,
    parent_id: null,
    parent_name: "",
    parent_icon: null,
  };
}

describe("groupExpensesByDate", () => {
  it("空列表返回空分组", () => {
    expect(groupExpensesByDate([])).toEqual([]);
  });

  it("同一天的账单合并到一组，金额累加", () => {
    const groups = groupExpensesByDate([item(1, "2026-09-10", 100), item(2, "2026-09-10", 250)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe("2026-09-10");
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].totalCents).toBe(350);
  });

  it("不同日期分成多组，分组顺序与列表一致", () => {
    const groups = groupExpensesByDate([
      item(1, "2026-09-10", 100),
      item(2, "2026-09-09", 200),
      item(3, "2026-09-09", 50),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-09-10", "2026-09-09"]);
    expect(groups[1].totalCents).toBe(250);
  });
});
