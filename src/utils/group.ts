import type { DayGroup, ExpenseListItem } from "../types";

/**
 * 按日期分组账单（列表已按日期倒序排好，同一天相邻）：
 * 同一天的账单合并到一组，组内金额累加，分组顺序与列表顺序一致。
 */
export function groupExpensesByDate(items: ExpenseListItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) {
      last.items.push(item);
      last.totalCents += item.amount_cents;
    } else {
      groups.push({ date: item.date, items: [item], totalCents: item.amount_cents });
    }
  }
  return groups;
}
