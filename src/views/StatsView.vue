<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";
import { useAppStore } from "../stores/app";
import MonthNav from "../components/MonthNav.vue";

const store = useAppStore();

/**
 * 分类配色：固定「颜色 ↔ 分类」的对应关系（颜色跟着分类走，不跟着排名走）。
 * 前 8 个一级分类使用校验过的安全色板；最后两个杂项类（金融支出、其他杂项）用灰色，
 * 与饼图里「其他」的折叠色一致。
 */
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const OTHER_GRAY = "#898781";

const colorMap = computed(() => {
  const m = new Map<number, string>();
  store.topCategories.forEach((c, i) => {
    m.set(c.id, i < PALETTE.length ? PALETTE[i] : OTHER_GRAY);
  });
  return m;
});

function fmtYuan(cents: number): string {
  return `¥${(cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 本月有支出的分类，按金额从高到低；最多展示 7 个，其余折叠进「其他」 */
const pieData = computed(() => {
  const stats = store.monthStats.filter((s) => s.total > 0);
  const keep = stats.slice(0, 7);
  const rest = stats.slice(7);
  const data = keep.map((s) => ({
    name: s.name,
    value: Number((s.total / 100).toFixed(2)),
    itemStyle: { color: colorMap.value.get(s.parent_id) ?? OTHER_GRAY },
  }));
  if (rest.length > 0) {
    data.push({
      name: "其他",
      value: Number((rest.reduce((a, b) => a + b.total, 0) / 100).toFixed(2)),
      itemStyle: { color: OTHER_GRAY },
    });
  }
  return data;
});

/** 排行列表：本月有支出的分类（按金额降序） */
const ranked = computed(() => store.monthStats.filter((s) => s.total > 0));

const maxRankedTotal = computed(() =>
  ranked.value.reduce((a, b) => Math.max(a, b.total), 0),
);

const trendMonths = computed(() => store.trend.map((t) => `${Number(t.month.split("-")[1])}月`));
const trendValues = computed(() => store.trend.map((t) => Number((t.totalCents / 100).toFixed(2))));

// ---------- ECharts 生命周期 ----------

const pieEl = ref<HTMLDivElement | null>(null);
const lineEl = ref<HTMLDivElement | null>(null);
let pieChart: echarts.ECharts | null = null;
let lineChart: echarts.ECharts | null = null;

function renderPie(): void {
  if (!pieChart) return;
  pieChart.setOption(
    {
      tooltip: {
        trigger: "item",
        formatter: "{b}：¥{c}（{d}%）",
      },
      legend: {
        bottom: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#52514e", fontSize: 12 },
      },
      series: [
        {
          type: "pie",
          radius: ["42%", "68%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
          label: {
            color: "#52514e",
            fontSize: 12,
            // 只给占比较大的扇区直接标注，小扇区看图例即可
            formatter: (p: { percent?: number; name: string }) =>
              p.percent !== undefined && p.percent >= 5 ? `${p.name} ${p.percent}%` : "",
          },
          labelLine: { length: 12, length2: 8 },
          data: pieData.value,
        },
      ],
    },
    true,
  );
}

function renderLine(): void {
  if (!lineChart) return;
  lineChart.setOption(
    {
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) => `¥${Number(v).toFixed(2)}`,
      },
      xAxis: {
        type: "category",
        data: trendMonths.value,
        axisLine: { lineStyle: { color: "#c3c2b7" } },
        axisTick: { show: false },
        axisLabel: { color: "#898781" },
      },
      yAxis: {
        type: "value",
        min: 0,
        splitLine: { lineStyle: { color: "#e1e0d9" } },
        axisLabel: { color: "#898781" },
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: trendValues.value,
          lineStyle: { color: "#2a78d6", width: 2 },
          itemStyle: { color: "#2a78d6", borderColor: "#ffffff", borderWidth: 2 },
          symbolSize: 8,
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(42, 120, 214, 0.18)" },
                { offset: 1, color: "rgba(42, 120, 214, 0)" },
              ],
            },
          },
        },
      ],
    },
    true,
  );
}

function renderCharts(): void {
  renderPie();
  renderLine();
}

function onResize(): void {
  pieChart?.resize();
  lineChart?.resize();
}

onMounted(() => {
  if (pieEl.value) pieChart = echarts.init(pieEl.value);
  if (lineEl.value) lineChart = echarts.init(lineEl.value);
  window.addEventListener("resize", onResize);
  renderCharts();
});

watch([pieData, trendMonths, trendValues], renderCharts);

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  pieChart?.dispose();
  lineChart?.dispose();
});
</script>

<template>
  <div class="stats-page">
    <MonthNav />

    <div class="summary-row">
      <div class="summary-cell">
        <div class="summary-label">本月支出</div>
        <div class="summary-value">{{ fmtYuan(store.totalCents) }}</div>
      </div>
      <div class="summary-cell">
        <div class="summary-label">记账笔数</div>
        <div class="summary-value">{{ store.totalCount }} 笔</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <h3 class="card-title">分类占比</h3>
        <div v-if="pieData.length === 0" class="chart-empty">本月暂无支出数据</div>
        <div v-show="pieData.length > 0" ref="pieEl" class="chart-box"></div>
      </div>

      <div class="card">
        <h3 class="card-title">分类排行</h3>
        <div v-if="ranked.length === 0" class="chart-empty">本月暂无支出数据</div>
        <div v-else class="rank-list">
          <div v-for="s in ranked" :key="s.parent_id" class="rank-item">
            <div class="rank-head">
              <span class="rank-name">{{ s.icon }} {{ s.name }}</span>
              <span class="rank-amount">{{ fmtYuan(s.total) }}</span>
            </div>
            <div class="rank-track">
              <div
                class="rank-bar"
                :style="{
                  width: maxRankedTotal > 0 ? `${(s.total / maxRankedTotal) * 100}%` : '0%',
                  background: colorMap.get(s.parent_id) ?? OTHER_GRAY,
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">近 6 个月消费趋势</h3>
      <div ref="lineEl" class="chart-box line"></div>
    </div>
  </div>
</template>

<style scoped>
.stats-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 20px 60px;
}

.summary-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.summary-cell {
  flex: 1;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  border-radius: 12px;
  padding: 16px 20px;
  color: #fff;
}

.summary-label {
  font-size: 12px;
  color: #94a3b8;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #fbbf24;
  margin-top: 4px;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-title {
  font-size: 15px;
  margin: 0 0 8px;
  color: #1f2937;
}

.chart-box {
  height: 300px;
}

.chart-box.line {
  height: 260px;
}

.chart-empty {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 13px;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 6px;
}

.rank-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.rank-name {
  font-size: 13px;
  color: #1f2937;
}

.rank-amount {
  font-size: 13px;
  font-weight: 600;
  color: #52514e;
  font-variant-numeric: tabular-nums;
}

.rank-track {
  height: 10px;
  background: #e5e7eb;
  border-radius: 5px;
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  border-radius: 5px;
}
</style>
