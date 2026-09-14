<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";

/** 棋盘：24 列 × 18 行，每格 22 像素 */
const COLS = 24;
const ROWS = 18;
const CELL = 22;
/** 蛇每走一步的间隔（毫秒），数字越小蛇爬得越快 */
const TICK_MS = 140;
/** 每吃到一个食物加的分数 */
const SCORE_PER_FOOD = 10;

type Direction = "up" | "down" | "left" | "right";
interface Point {
  x: number;
  y: number;
}

/** 每个方向对应的坐标增量 */
const DIR_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
/** 相反方向：180 度掉头是不允许的 */
const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** 键盘按键 → 方向（按物理键位判断，法语键盘等特殊布局也能用） */
const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

/** 游戏状态：待开始 / 进行中 / 已暂停 / 已结束 */
type GameStatus = "idle" | "running" | "paused" | "over";

const status = ref<GameStatus>("idle");
const snake = ref<Point[]>([]);
const dir = ref<Direction>("right");
/** 待执行的转向队列：快速连按两个方向键时第二个也不会丢（最多排 2 个，防止积压） */
const pendingDirs = ref<Direction[]>([]);
const food = ref<Point>({ x: 0, y: 0 });
const score = ref(0);
/** 棋盘被蛇铺满即通关（几乎不可能，留个彩蛋） */
const won = ref(false);

const boardWidth = COLS * CELL;
const boardHeight = ROWS * CELL;

let timer: ReturnType<typeof setInterval> | null = null;
/** 当前页面是否正在显示（切到别的菜单页时为 false，不再响应键盘） */
let isActive = true;

/** 重置一局：蛇回到棋盘中央向右爬，重新撒食物 */
function resetGame(): void {
  snake.value = [
    { x: 12, y: 9 },
    { x: 11, y: 9 },
    { x: 10, y: 9 },
  ];
  dir.value = "right";
  pendingDirs.value = [];
  score.value = 0;
  won.value = false;
  spawnFood();
}

/** 在蛇没占用的格子里随机挑一个放食物 */
function spawnFood(): void {
  const occupied = new Set(snake.value.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) {
    won.value = true;
    endGame();
    return;
  }
  food.value = free[Math.floor(Math.random() * free.length)];
}

/** 蛇爬一步：判断掉头 → 撞墙/撞自己 → 移动/吃食物 */
function tick(): void {
  const next = pendingDirs.value.shift();
  if (next && next !== OPPOSITE[dir.value]) dir.value = next;

  const head = snake.value[0];
  const v = DIR_VECTORS[dir.value];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const eating = newHead.x === food.value.x && newHead.y === food.value.y;

  // 撞墙：游戏结束
  if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
    endGame();
    return;
  }

  // 撞自己：吃食物时尾巴不动，整个身体都算障碍；否则尾巴这步会让开
  const body = eating ? snake.value : snake.value.slice(0, -1);
  if (body.some((p) => p.x === newHead.x && p.y === newHead.y)) {
    endGame();
    return;
  }

  if (eating) {
    // 吃到食物：头部前移一格，身体变长，加分并撒新食物
    snake.value = [newHead, ...snake.value];
    score.value += SCORE_PER_FOOD;
    spawnFood();
  } else {
    // 正常前进：头部前移一格，尾巴收一格
    snake.value = [newHead, ...snake.value.slice(0, -1)];
  }
}

function startLoop(): void {
  stopLoop();
  timer = setInterval(tick, TICK_MS);
}

function stopLoop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** 开始新一局（上一局结束的话先重置） */
function startGame(): void {
  if (status.value === "over") resetGame();
  status.value = "running";
  startLoop();
}

function pauseGame(): void {
  status.value = "paused";
  stopLoop();
}

function resumeGame(): void {
  status.value = "running";
  startLoop();
}

function endGame(): void {
  status.value = "over";
  stopLoop();
}

/** 键盘操作：方向键/WASD 转向，空格开始或暂停 */
function onKeydown(e: KeyboardEvent): void {
  // 系统连发事件直接忽略：按住不放只认第一次按下，防止开始/暂停来回横跳
  if (e.repeat) return;
  // 页面切到别的菜单页时不响应键盘
  if (!isActive) return;

  const d = KEY_DIRS[e.code];
  if (d) {
    // 只有游戏进行中才接收方向键：暂停/待开始时按的方向键不埋伏
    if (status.value !== "running") return;
    e.preventDefault();
    const last =
      pendingDirs.value.length > 0 ? pendingDirs.value[pendingDirs.value.length - 1] : dir.value;
    // 不能原地掉头：新方向不能和「当前已排队的最新方向」相同或相反
    if (d === last || d === OPPOSITE[last]) return;
    // 队列最多排 2 个转向：一步之内最多提前转两次弯，防止连按积压一大串
    if (pendingDirs.value.length >= 2) return;
    pendingDirs.value.push(d);
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    if (status.value === "idle" || status.value === "over") startGame();
    else if (status.value === "running") pauseGame();
    else resumeGame();
  }
}

/** 窗口失焦时自动暂停：人切到别的窗口，蛇不该自己继续爬 */
function onWindowBlur(): void {
  if (status.value === "running") pauseGame();
}

onMounted(() => {
  resetGame();
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("blur", onWindowBlur);
});

// 页面被 KeepAlive 缓存：切到别的菜单页时自动暂停，回来点「继续」接着玩
onDeactivated(() => {
  isActive = false;
  if (status.value === "running") pauseGame();
});

onActivated(() => {
  isActive = true;
});

onBeforeUnmount(() => {
  stopLoop();
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("blur", onWindowBlur);
});
</script>

<template>
  <div class="snake-page">
    <div class="snake-header">
      <div class="score-row">
        <span class="score-label">得分</span>
        <span class="score-value">{{ score }}</span>
        <span class="score-divider">·</span>
        <span class="score-label">长度</span>
        <span class="score-value">{{ snake.length }}</span>
      </div>
      <div class="hint">方向键 / WASD 移动 · 空格 开始或暂停</div>
    </div>

    <div
      class="board"
      :style="{ width: `${boardWidth}px`, height: `${boardHeight}px` }"
    >
      <div
        v-for="(p, i) in snake"
        :key="i"
        class="cell snake-cell"
        :class="{ head: i === 0 }"
        :style="{ left: `${p.x * CELL}px`, top: `${p.y * CELL}px` }"
      />
      <div
        class="cell food-cell"
        :style="{ left: `${food.x * CELL}px`, top: `${food.y * CELL}px` }"
      />

      <div v-if="status === 'idle'" class="overlay">
        <p class="overlay-title">准备好了吗？</p>
        <p class="overlay-sub">吃掉橙色食物会变长，撞墙或撞到自己就结束</p>
        <el-button type="primary" size="large" @click="startGame">开始游戏</el-button>
      </div>

      <div v-if="status === 'paused'" class="overlay">
        <p class="overlay-title">已暂停</p>
        <el-button type="primary" size="large" @click="resumeGame">继续</el-button>
      </div>

      <div v-if="status === 'over'" class="overlay">
        <p class="overlay-title">{{ won ? "🎉 你通关了！" : "游戏结束" }}</p>
        <p class="overlay-sub">本局得分：{{ score }}</p>
        <el-button type="primary" size="large" @click="startGame">再来一局</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snake-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}

.snake-header {
  text-align: center;
  margin-bottom: 16px;
}

.score-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  color: #6b7280;
}

.score-value {
  font-size: 22px;
  font-weight: 700;
  color: #f59e0b;
}

.score-divider {
  color: #d1d5db;
}

.hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 6px;
}

.board {
  position: relative;
  margin: 0 auto;
  background-color: #0f172a;
  /* 用两层渐变画出棋盘网格线，格子大小需与 CELL 保持一致 */
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 22px 22px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
  overflow: hidden;
}

.cell {
  position: absolute;
  width: 22px;
  height: 22px;
}

.snake-cell {
  background: #10b981;
  border-radius: 5px;
  box-shadow: 0 0 0 2px #0f172a;
}

.snake-cell.head {
  background: #34d399;
  border-radius: 7px;
}

.food-cell {
  background: #f59e0b;
  border-radius: 50%;
  animation: food-pulse 0.9s ease-in-out infinite;
}

@keyframes food-pulse {
  0%,
  100% {
    transform: scale(0.75);
  }
  50% {
    transform: scale(1);
  }
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(2px);
}

.overlay-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.overlay-sub {
  margin: 0 0 4px;
  font-size: 14px;
  color: #cbd5e1;
}
</style>
