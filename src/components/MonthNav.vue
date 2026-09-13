<script setup lang="ts">
import { computed } from "vue";
import { ArrowLeft, ArrowRight } from "@element-plus/icons-vue";
import { formatMonthLabel, useAppStore } from "../stores/app";

const store = useAppStore();

const isCurrentMonth = computed(() => {
  const now = new Date();
  return store.month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});
</script>

<template>
  <div class="month-nav">
    <el-button circle :icon="ArrowLeft" @click="store.changeMonth(-1)" />
    <span class="month-label">{{ formatMonthLabel(store.month) }}</span>
    <el-button circle :icon="ArrowRight" @click="store.changeMonth(1)" />
    <el-button v-if="!isCurrentMonth" text type="primary" size="small" @click="store.goCurrentMonth()">
      回到本月
    </el-button>
  </div>
</template>

<style scoped>
.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.month-label {
  font-size: 18px;
  font-weight: 600;
  min-width: 96px;
  text-align: center;
}
</style>
