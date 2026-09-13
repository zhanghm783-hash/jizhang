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
 * 老数据库升级：给 categories 表补 builtin 列，并把种子行标记为内置。
 * 用 PRAGMA user_version 做一次性开关，重复执行是安全的；
 * 老版本没有任何自建分类入口，按「名称 + 父级」匹配种子行不会误锁。
 */
async function migrateCategories(database: Database): Promise<void> {
  const uvRows = await database.select<{ user_version: number }[]>("PRAGMA user_version");
  if ((uvRows[0]?.user_version ?? 0) >= 1) return;

  const cols = await database.select<{ name: string }[]>("PRAGMA table_info(categories)");
  if (!cols.some((c) => c.name === "builtin")) {
    await database.execute("ALTER TABLE categories ADD COLUMN builtin INTEGER NOT NULL DEFAULT 0");
  }

  for (const parent of SEED_CATEGORIES) {
    const tops = await database.select<{ id: number }[]>(
      "SELECT id FROM categories WHERE parent_id IS NULL AND name = $1",
      [parent.name],
    );
    if (tops.length === 0) continue;
    await database.execute("UPDATE categories SET builtin = 1 WHERE id = $1", [tops[0].id]);
    for (const child of parent.children) {
      await database.execute(
        "UPDATE categories SET builtin = 1 WHERE parent_id = $1 AND name = $2",
        [tops[0].id, child],
      );
    }
  }
  await database.execute("PRAGMA user_version = 1");
}

/**
 * 建表 + 老库迁移 + 首次运行时写入内置分类。
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
      icon TEXT,
      builtin INTEGER NOT NULL DEFAULT 0
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

  await migrateCategories(database);

  const existing = await database.select<{ id: number }[]>("SELECT id FROM categories LIMIT 1");
  if (existing.length === 0) {
    for (let p = 0; p < SEED_CATEGORIES.length; p++) {
      const parent = SEED_CATEGORIES[p];
      const res = await database.execute(
        "INSERT INTO categories (name, parent_id, sort_order, icon, builtin) VALUES ($1, NULL, $2, $3, 1)",
        [parent.name, p, parent.icon],
      );
      const parentId = Number(res.lastInsertId);
      for (let c = 0; c < parent.children.length; c++) {
        await database.execute(
          "INSERT INTO categories (name, parent_id, sort_order, icon, builtin) VALUES ($1, $2, $3, NULL, 1)",
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

/** 新增分类入参：parentId 为 null 时是一级分类 */
export interface NewCategoryInput {
  name: string;
  parentId: number | null;
  icon?: string | null;
}

/** 修改分类入参：传哪个字段就改哪个；parentId 变化即「搬家」 */
export interface CategoryPatch {
  name?: string;
  icon?: string | null;
  parentId?: number | null;
}

/** 新增分类（用户自建 builtin=0），排在同级末尾，返回新分类 id */
export async function addCategory(input: NewCategoryInput): Promise<number> {
  const database = await getDb();
  const rows = await database.select<{ m: number }[]>(
    "SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories WHERE COALESCE(parent_id, 0) = COALESCE($1, 0)",
    [input.parentId],
  );
  const res = await database.execute(
    "INSERT INTO categories (name, parent_id, sort_order, icon, builtin) VALUES ($1, $2, $3, $4, 0)",
    [input.name, input.parentId, (rows[0]?.m ?? 0) + 1, input.icon ?? null],
  );
  return Number(res.lastInsertId);
}

/** 修改分类（改名 / 改图标 / 搬家），仅限用户自建分类 */
export async function updateCategory(id: number, patch: CategoryPatch): Promise<void> {
  const database = await getDb();
  const rows = await database.select<Category[]>("SELECT * FROM categories WHERE id = $1", [id]);
  const cat = rows[0];
  if (!cat) throw new Error("分类不存在");
  if (cat.builtin === 1) throw new Error("内置分类不可修改");

  const name = patch.name ?? cat.name;
  const icon = patch.icon !== undefined ? patch.icon : cat.icon;
  const parentId = patch.parentId !== undefined ? patch.parentId : cat.parent_id;

  let sortOrder = cat.sort_order;
  if (parentId !== cat.parent_id) {
    // 搬家：排到新父级下同级分类的末尾
    const maxRows = await database.select<{ m: number }[]>(
      "SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories WHERE COALESCE(parent_id, 0) = COALESCE($1, 0)",
      [parentId],
    );
    sortOrder = (maxRows[0]?.m ?? 0) + 1;
  }

  const res = await database.execute(
    "UPDATE categories SET name = $1, icon = $2, parent_id = $3, sort_order = $4 WHERE id = $5 AND builtin = 0",
    [name, icon, parentId, sortOrder, id],
  );
  if (res.rowsAffected === 0) throw new Error("内置分类不可修改");
}

/** 删除分类，仅限用户自建分类 */
export async function deleteCategory(id: number): Promise<void> {
  const database = await getDb();
  const res = await database.execute("DELETE FROM categories WHERE id = $1 AND builtin = 0", [id]);
  if (res.rowsAffected === 0) throw new Error("内置分类不可删除");
}

/** 某二级分类下的账单数（删除前判断用） */
export async function countExpensesByCategory(categoryId: number): Promise<number> {
  const database = await getDb();
  const rows = await database.select<{ cnt: number }[]>(
    "SELECT COUNT(*) AS cnt FROM expenses WHERE category_id = $1",
    [categoryId],
  );
  return rows[0]?.cnt ?? 0;
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
