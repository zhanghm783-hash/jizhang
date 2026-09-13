import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  addExpense,
  deleteExpense,
  fetchCategories,
  fetchMonthExpenses,
  fetchMonthStatsByTopCategory,
  fetchMonthSummary,
  fetchTrendMonths,
  initDatabase,
  updateExpense,
  type ExpenseInput,
} from "../db";
import type { Category, CategoryTotal, DayGroup, ExpenseListItem, TrendPoint } from "../types";

/** 当前月份，格式 YYYY-MM */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "2026年9月" */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export const useAppStore = defineStore("app", () => {
  const ready = ref(false);
  const month = ref(currentMonth());
  const categories = ref<Category[]>([]);
  const expenses = ref<ExpenseListItem[]>([]);
  const totalCents = ref(0);
  const totalCount = ref(0);
  const monthStats = ref<CategoryTotal[]>([]);
  const trend = ref<TrendPoint[]>([]);

  /** 一级分类 */
  const topCategories = computed(() => categories.value.filter((c) => c.parent_id === null));

  /** 某个一级分类下的二级分类 */
  function childrenOf(parentId: number | null): Category[] {
    return categories.value.filter((c) => c.parent_id === parentId);
  }

  /** 按日期分组的账单（供流水列表使用） */
  const dayGroups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const item of expenses.value) {
      const last = groups[groups.length - 1];
      if (last && last.date === item.date) {
        last.items.push(item);
        last.totalCents += item.amount_cents;
      } else {
        groups.push({ date: item.date, items: [item], totalCents: item.amount_cents });
      }
    }
    return groups;
  });

  /** 应用启动时调用：初始化数据库、加载分类与账单 */
  async function init(): Promise<void> {
    await initDatabase();
    categories.value = await fetchCategories();
    await Promise.all([reload(), reloadStats()]);
    ready.value = true;
  }

  /** 重新加载当前月份的账单与汇总 */
  async function reload(): Promise<void> {
    const [list, summary] = await Promise.all([
      fetchMonthExpenses(month.value),
      fetchMonthSummary(month.value),
    ]);
    expenses.value = list;
    totalCents.value = summary.totalCents;
    totalCount.value = summary.count;
  }

  /** 重新加载当前月份的统计（分类占比与趋势） */
  async function reloadStats(): Promise<void> {
    const [stats, trendData] = await Promise.all([
      fetchMonthStatsByTopCategory(month.value),
      fetchTrendMonths(month.value),
    ]);
    monthStats.value = stats;
    trend.value = trendData;
  }

  /** 切换月份：delta 为 -1 上个月、1 下个月 */
  function changeMonth(delta: number): void {
    const [y, m] = month.value.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    void reload();
    void reloadStats();
  }

  function goCurrentMonth(): void {
    month.value = currentMonth();
    void reload();
    void reloadStats();
  }

  /** 保存账单：有 id 为更新，无 id 为新增 */
  async function saveExpense(input: ExpenseInput, id?: number): Promise<void> {
    if (id) {
      await updateExpense(id, input);
    } else {
      await addExpense(input);
    }
    await reload();
  }

  async function removeExpense(id: number): Promise<void> {
    await deleteExpense(id);
    await reload();
  }

  return {
    ready,
    month,
    categories,
    expenses,
    totalCents,
    totalCount,
    monthStats,
    trend,
    topCategories,
    childrenOf,
    dayGroups,
    init,
    reload,
    reloadStats,
    changeMonth,
    goCurrentMonth,
    saveExpense,
    removeExpense,
  };
});
