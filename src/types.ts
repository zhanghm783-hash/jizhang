/** 分类（categories 表）：parent_id 为 null 的是一级分类，否则是二级分类 */
export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  icon: string | null;
}

/** 账单（expenses 表）原始字段 */
export interface Expense {
  id: number;
  amount_cents: number;
  date: string;
  category_id: number;
  payment_method: string;
  note: string;
  created_at: string;
}

/** 列表展示用的账单：额外带上了分类名称和图标（通过连表查询得到） */
export interface ExpenseListItem extends Expense {
  sub_name: string;
  sub_icon: string | null;
  parent_id: number | null;
  parent_name: string;
  parent_icon: string | null;
}

/** 按日期分组后的账单列表 */
export interface DayGroup {
  date: string;
  items: ExpenseListItem[];
  totalCents: number;
}

/** 统计页：某个月各一级分类的花费总额 */
export interface CategoryTotal {
  parent_id: number;
  name: string;
  icon: string | null;
  total: number;
}

/** 统计页：趋势图的一个数据点 */
export interface TrendPoint {
  month: string;
  totalCents: number;
}
