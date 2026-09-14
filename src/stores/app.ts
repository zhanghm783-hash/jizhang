import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  addCategory as dbAddCategory,
  addExpense,
  countExpensesByCategory,
  deleteCategory as dbDeleteCategory,
  deleteExpense,
  fetchCategories,
  fetchMonthExpenses,
  fetchMonthStatsByTopCategory,
  fetchMonthSummary,
  fetchTrendMonths,
  initDatabase,
  updateCategory as dbUpdateCategory,
  updateExpense,
  type CategoryPatch,
  type ExpenseInput,
  type NewCategoryInput,
} from "../db";
import type { Category, CategoryTotal, DayGroup, ExpenseListItem, TrendPoint } from "../types";
import { currentMonth, formatMonthLabel, monthAdd } from "../utils/date";
import { groupExpensesByDate } from "../utils/group";

export { formatMonthLabel };

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
  const dayGroups = computed<DayGroup[]>(() => groupExpensesByDate(expenses.value));

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
    month.value = monthAdd(month.value, delta);
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

  /**
   * 分类任何变更后的统一刷新：
   * 重新读分类 + 刷新流水与统计（账单里的分类名是连表查出来的，不刷新会显示旧名）。
   */
  async function refreshCategories(): Promise<void> {
    categories.value = await fetchCategories();
    await Promise.all([reload(), reloadStats()]);
  }

  async function addCategory(input: NewCategoryInput): Promise<void> {
    await dbAddCategory(input);
    await refreshCategories();
  }

  async function updateCategory(id: number, patch: CategoryPatch): Promise<void> {
    await dbUpdateCategory(id, patch);
    await refreshCategories();
  }

  async function removeCategory(id: number): Promise<void> {
    await dbDeleteCategory(id);
    await refreshCategories();
  }

  /** 某二级分类下的账单数（删除前判断用，视图层只依赖 store） */
  async function expenseCount(categoryId: number): Promise<number> {
    return countExpensesByCategory(categoryId);
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
    addCategory,
    updateCategory,
    removeCategory,
    expenseCount,
  };
});
