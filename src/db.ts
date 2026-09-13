import Database from "@tauri-apps/plugin-sql";
import { SEED_CATEGORIES } from "./constants";
import type { Category, CategoryTotal, ExpenseListItem, TrendPoint } from "./types";

let db: Database | null = null;

/** 获取数据库连接（整个应用只连接一次，之后复用） */
export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:heima.db");
  }
  return db;
}

/**
 * 建表 + 首次运行时写入内置分类。
 * 重复执行是安全的：表已存在则跳过建表，分类已存在则跳过写入。
 */
export async function initDatabase(): Promise<void> {
  const database = await getDb();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      icon TEXT
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_cents INTEGER NOT NULL,
      date TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT '微信',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const existing = await database.select<{ id: number }[]>("SELECT id FROM categories LIMIT 1");
  if (existing.length === 0) {
    for (let p = 0; p < SEED_CATEGORIES.length; p++) {
      const parent = SEED_CATEGORIES[p];
      const res = await database.execute(
        "INSERT INTO categories (name, parent_id, sort_order, icon) VALUES ($1, NULL, $2, $3)",
        [parent.name, p, parent.icon],
      );
      const parentId = Number(res.lastInsertId);
      for (let c = 0; c < parent.children.length; c++) {
        await database.execute(
          "INSERT INTO categories (name, parent_id, sort_order, icon) VALUES ($1, $2, $3, NULL)",
          [parent.children[c], parentId, c],
        );
      }
    }
  }
}

export async function fetchCategories(): Promise<Category[]> {
  const database = await getDb();
  return database.select<Category[]>("SELECT * FROM categories ORDER BY sort_order, id");
}

export interface ExpenseInput {
  amountCents: number;
  date: string;
  categoryId: number;
  paymentMethod: string;
  note: string;
}

export async function addExpense(input: ExpenseInput): Promise<void> {
  const database = await getDb();
  await database.execute(
    "INSERT INTO expenses (amount_cents, date, category_id, payment_method, note) VALUES ($1, $2, $3, $4, $5)",
    [input.amountCents, input.date, input.categoryId, input.paymentMethod, input.note],
  );
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  const database = await getDb();
  await database.execute(
    "UPDATE expenses SET amount_cents = $1, date = $2, category_id = $3, payment_method = $4, note = $5 WHERE id = $6",
    [input.amountCents, input.date, input.categoryId, input.paymentMethod, input.note, id],
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM expenses WHERE id = $1", [id]);
}

/** 查询某个月（YYYY-MM）的所有账单，附带分类名称与图标 */
export async function fetchMonthExpenses(month: string): Promise<ExpenseListItem[]> {
  const database = await getDb();
  return database.select<ExpenseListItem[]>(
    `SELECT e.id, e.amount_cents, e.date, e.category_id, e.payment_method, e.note, e.created_at,
            c.name AS sub_name, c.icon AS sub_icon, c.parent_id AS parent_id,
            p.name AS parent_name, p.icon AS parent_icon
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     JOIN categories p ON c.parent_id = p.id
     WHERE e.date LIKE $1
     ORDER BY e.date DESC, e.id DESC`,
    [`${month}-%`],
  );
}

/** 查询某个月的总支出与笔数 */
export async function fetchMonthSummary(month: string): Promise<{ totalCents: number; count: number }> {
  const database = await getDb();
  const rows = await database.select<{ total: number | null; cnt: number }[]>(
    "SELECT SUM(amount_cents) AS total, COUNT(*) AS cnt FROM expenses WHERE date LIKE $1",
    [`${month}-%`],
  );
  return { totalCents: rows[0]?.total ?? 0, count: rows[0]?.cnt ?? 0 };
}

/** 统计某个月各一级分类的花费总额（按金额从高到低，无支出的分类为 0） */
export async function fetchMonthStatsByTopCategory(month: string): Promise<CategoryTotal[]> {
  const database = await getDb();
  return database.select<CategoryTotal[]>(
    `SELECT p.id AS parent_id, p.name, p.icon,
            COALESCE(SUM(e.amount_cents), 0) AS total
     FROM categories p
     LEFT JOIN categories c ON c.parent_id = p.id
     LEFT JOIN expenses e ON e.category_id = c.id AND e.date LIKE $1
     WHERE p.parent_id IS NULL
     GROUP BY p.id
     ORDER BY total DESC, p.id`,
    [`${month}-%`],
  );
}

/** 统计以 endMonth 结尾的最近 count 个月每个月的总支出（无数据的月份补 0） */
export async function fetchTrendMonths(endMonth: string, count = 6): Promise<TrendPoint[]> {
  const [y, m] = endMonth.split("-").map(Number);
  const first = new Date(y, m - 1 - (count - 1), 1);
  const startStr = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`;
  const database = await getDb();
  const rows = await database.select<{ month: string; total: number | null }[]>(
    `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS total
     FROM expenses
     WHERE date >= $1 AND date <= $2
     GROUP BY month`,
    [`${startStr}-01`, `${endMonth}-31`],
  );
  const map = new Map(rows.map((r) => [r.month, r.total ?? 0]));
  const result: TrendPoint[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ month: key, totalCents: map.get(key) ?? 0 });
  }
  return result;
}
