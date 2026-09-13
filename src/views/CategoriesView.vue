<script setup lang="ts">
import { ref } from "vue";
import { Delete, Edit, Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAppStore } from "../stores/app";
import type { Category } from "../types";
import CategoryDialog from "../components/CategoryDialog.vue";

const store = useAppStore();

const dialogVisible = ref(false);
const editing = ref<Category | null>(null);
const dialogMode = ref<"top" | "child">("top");
const initialParentId = ref<number | null>(null);

function openAddTop(): void {
  editing.value = null;
  dialogMode.value = "top";
  initialParentId.value = null;
  dialogVisible.value = true;
}

function openAddChild(parentId: number): void {
  editing.value = null;
  dialogMode.value = "child";
  initialParentId.value = parentId;
  dialogVisible.value = true;
}

function openEdit(cat: Category): void {
  editing.value = cat;
  dialogVisible.value = true;
}

/** 删除自建分类：二级需无账单，一级需无二级分类 */
async function onDelete(cat: Category): Promise<void> {
  const isTop = cat.parent_id === null;
  if (isTop) {
    const childCount = store.childrenOf(cat.id).length;
    if (childCount > 0) {
      ElMessage.warning(`「${cat.name}」下还有 ${childCount} 个二级分类，请先移动或删除它们`);
      return;
    }
  } else {
    const n = await store.expenseCount(cat.id);
    if (n > 0) {
      ElMessage.warning(`「${cat.name}」下已有 ${n} 笔账单，无法删除。请先修改或删除这些账单。`);
      return;
    }
  }

  try {
    await ElMessageBox.confirm(
      `确定删除${isTop ? "一级" : "二级"}分类「${cat.name}」吗？删除后不可恢复。`,
      "删除确认",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return; // 用户点了取消
  }
  await store.removeCategory(cat.id);
  ElMessage.success("已删除");
}

function onSaved(): void {
  dialogVisible.value = false;
  editing.value = null;
}
</script>

<template>
  <div class="categories-page">
    <div class="page-head">
      <h2 class="page-title">分类管理</h2>
      <el-button type="primary" :icon="Plus" @click="openAddTop">新增一级分类</el-button>
    </div>
    <div class="lock-tip">带 🔒 的是内置分类，不可修改、不可删除</div>

    <div v-for="top in store.topCategories" :key="top.id" class="top-card">
      <div class="top-head">
        <span class="top-icon">{{ top.icon }}</span>
        <span class="top-name">{{ top.name }}</span>
        <span v-if="top.builtin === 1" class="lock-badge" title="内置分类，不可修改">🔒</span>
        <span class="top-count">{{ store.childrenOf(top.id).length }} 个二级</span>
        <div v-if="top.builtin === 0" class="top-actions">
          <el-button size="small" :icon="Edit" @click="openEdit(top)">编辑</el-button>
          <el-button size="small" type="danger" plain :icon="Delete" @click="onDelete(top)">删除</el-button>
        </div>
      </div>

      <div class="child-list">
        <div v-for="child in store.childrenOf(top.id)" :key="child.id" class="child-row">
          <span class="child-name">{{ child.name }}</span>
          <span v-if="child.builtin === 1" class="lock-badge" title="内置分类，不可修改">🔒</span>
          <div v-if="child.builtin === 0" class="child-actions">
            <el-button link size="small" type="primary" :icon="Edit" @click="openEdit(child)">编辑</el-button>
            <el-button link size="small" type="danger" :icon="Delete" @click="onDelete(child)">删除</el-button>
          </div>
        </div>
        <div class="add-child" @click="openAddChild(top.id)">+ 新增二级分类</div>
      </div>
    </div>

    <CategoryDialog
      v-model="dialogVisible"
      :category="editing"
      :mode="dialogMode"
      :initial-parent-id="initialParentId"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.categories-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px 60px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  color: #1f2937;
}

.lock-tip {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 16px;
}

.top-card {
  background: #fff;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.top-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-icon {
  font-size: 20px;
}

.top-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.lock-badge {
  font-size: 12px;
  color: #9ca3af;
}

.top-count {
  font-size: 12px;
  color: #9ca3af;
  flex: 1;
}

.top-actions {
  display: flex;
  gap: 4px;
}

.child-list {
  margin-top: 10px;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.child-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4b5563;
}

.child-name {
  flex: 1;
}

.child-actions {
  display: flex;
  gap: 4px;
}

.add-child {
  font-size: 13px;
  color: #f59e0b;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
  width: fit-content;
}

.add-child:hover {
  text-decoration: underline;
}
</style>
