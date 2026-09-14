<script setup lang="ts">
import { ref } from "vue";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAppStore } from "../stores/app";
import type { ExpenseListItem } from "../types";
import { formatYuan as yuan } from "../utils/money";
import ExpenseDialog from "../components/ExpenseDialog.vue";
import MonthNav from "../components/MonthNav.vue";

const store = useAppStore();

const dialogVisible = ref(false);
const editing = ref<ExpenseListItem | null>(null);

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** "2026-09-13" → "9月13日 周日" */
function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}月${d}日 周${WEEKDAYS[dt.getDay()]}`;
}

function openAdd(): void {
  editing.value = null;
  dialogVisible.value = true;
}

function openEdit(item: ExpenseListItem): void {
  editing.value = item;
  dialogVisible.value = true;
}

async function onDelete(item: ExpenseListItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除「${item.parent_name} · ${item.sub_name}」这笔 ${yuan(item.amount_cents)} 元的记录吗？删除后不可恢复。`,
      "删除确认",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return; // 用户点了取消
  }
  await store.removeExpense(item.id);
  ElMessage.success("已删除");
}

function onSaved(): void {
  const wasEdit = editing.value !== null;
  dialogVisible.value = false;
  ElMessage.success(wasEdit ? "已更新" : "记账成功");
  editing.value = null;
}
</script>

<template>
  <div class="records-page">
    <MonthNav />

    <div class="summary-card">
      <div class="summary-label">本月支出（元）</div>
      <div class="summary-amount">{{ yuan(store.totalCents) }}</div>
      <div class="summary-count">共 {{ store.totalCount }} 笔</div>
    </div>

    <div v-if="store.dayGroups.length === 0" class="empty-tip">
      <div class="empty-icon">📝</div>
      <p class="empty-main">本月还没有账单</p>
      <p class="empty-sub">点击右下角「记一笔」按钮开始记账吧</p>
    </div>

    <div v-for="group in store.dayGroups" :key="group.date" class="day-group">
      <div class="day-header">
        <span>{{ dayLabel(group.date) }}</span>
        <span class="day-total">支出 ¥{{ yuan(group.totalCents) }}</span>
      </div>
      <div v-for="item in group.items" :key="item.id" class="expense-item" @click="openEdit(item)">
        <div class="item-icon">{{ item.sub_icon || item.parent_icon || "💰" }}</div>
        <div class="item-main">
          <div class="item-title">{{ item.parent_name }} · {{ item.sub_name }}</div>
          <div class="item-meta">
            <span>{{ item.payment_method }}</span>
            <span v-if="item.note"> · {{ item.note }}</span>
          </div>
        </div>
        <div class="item-right">
          <div class="item-amount">-{{ yuan(item.amount_cents) }}</div>
          <el-button
            class="item-delete"
            circle
            size="small"
            type="danger"
            plain
            :icon="Delete"
            @click.stop="onDelete(item)"
          />
        </div>
      </div>
    </div>

    <div class="fab" @click="openAdd">
      <el-icon :size="22"><Plus /></el-icon>
      <span>记一笔</span>
    </div>

    <ExpenseDialog v-model="dialogVisible" :expense="editing" @saved="onSaved" />
  </div>
</template>

<style scoped>
.records-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px 100px;
}

.summary-card {
  background: linear-gradient(135deg, #1e293b, #0f172a);
  border-radius: 14px;
  color: #fff;
  padding: 22px 24px;
  margin-bottom: 20px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
}

.summary-label {
  font-size: 13px;
  color: #94a3b8;
}

.summary-amount {
  font-size: 34px;
  font-weight: 700;
  color: #fbbf24;
  margin: 6px 0 2px;
}

.summary-count {
  font-size: 13px;
  color: #94a3b8;
}

.empty-tip {
  text-align: center;
  padding: 60px 0;
  color: #9ca3af;
}

.empty-icon {
  font-size: 44px;
  margin-bottom: 12px;
}

.empty-main {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 6px;
}

.empty-sub {
  font-size: 13px;
  margin: 0;
}

.day-group {
  margin-bottom: 18px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #6b7280;
  padding: 4px 6px;
  margin-bottom: 6px;
}

.day-total {
  font-size: 12px;
  color: #9ca3af;
}

.expense-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.15s;
}

.expense-item:hover {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}

.item-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fef3c7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 15px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-amount {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.item-delete {
  opacity: 0;
  transition: opacity 0.15s;
}

.expense-item:hover .item-delete {
  opacity: 1;
}

.fab {
  position: fixed;
  right: 28px;
  bottom: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f59e0b;
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
  padding: 14px 20px;
  border-radius: 28px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.45);
  transition: transform 0.15s;
  user-select: none;
}

.fab:hover {
  transform: translateY(-2px);
}
</style>
