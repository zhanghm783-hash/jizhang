<script setup lang="ts">
import { onMounted, ref } from "vue";
import { DataAnalysis, FolderOpened, Wallet } from "@element-plus/icons-vue";
import { useAppStore } from "./stores/app";
import RecordsView from "./views/RecordsView.vue";
import StatsView from "./views/StatsView.vue";
import CategoriesView from "./views/CategoriesView.vue";
import SnakeView from "./views/SnakeView.vue";

const store = useAppStore();
const active = ref<"records" | "stats" | "categories" | "snake">("records");

onMounted(() => {
  void store.init();
});
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">🐎 黑马记账</div>
      <nav class="menu">
        <div
          class="menu-item"
          :class="{ active: active === 'records' }"
          @click="active = 'records'"
        >
          <el-icon><Wallet /></el-icon>
          <span>账单流水</span>
        </div>
        <div
          class="menu-item"
          :class="{ active: active === 'stats' }"
          @click="active = 'stats'"
        >
          <el-icon><DataAnalysis /></el-icon>
          <span>统计分析</span>
        </div>
        <div
          class="menu-item"
          :class="{ active: active === 'categories' }"
          @click="active = 'categories'"
        >
          <el-icon><FolderOpened /></el-icon>
          <span>分类管理</span>
        </div>
        <div
          class="menu-item"
          :class="{ active: active === 'snake' }"
          @click="active = 'snake'"
        >
          <span class="menu-emoji">🐍</span>
          <span>贪吃蛇</span>
        </div>
      </nav>
      <div class="sidebar-footer">数据保存在本机 · 安心记账</div>
    </aside>

    <main class="content">
      <div v-if="!store.ready" class="app-loading">正在打开账本…</div>
      <!-- 只缓存贪吃蛇页：切走时暂停保局，其他页面保持原来的每次重新加载 -->
      <KeepAlive v-else :include="['SnakeView']">
        <RecordsView v-if="active === 'records'" />
        <StatsView v-else-if="active === 'stats'" />
        <SnakeView v-else-if="active === 'snake'" />
        <CategoriesView v-else />
      </KeepAlive>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100%;
}

.sidebar {
  width: 210px;
  flex-shrink: 0;
  background: #0f172a;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

.logo {
  padding: 24px 20px;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

.menu {
  padding: 8px 12px;
  flex: 1;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 15px;
  margin-bottom: 4px;
  user-select: none;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.menu-item.active {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

/* 菜单里用 emoji 当图标时，宽度对齐 el-icon（16px） */
.menu-emoji {
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.sidebar-footer {
  padding: 16px 20px;
  font-size: 12px;
  color: #64748b;
}

.content {
  flex: 1;
  overflow-y: auto;
}

.app-loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 15px;
}
</style>
