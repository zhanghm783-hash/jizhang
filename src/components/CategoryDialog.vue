<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { CATEGORY_ICONS } from "../constants";
import { useAppStore } from "../stores/app";
import type { Category } from "../types";

const store = useAppStore();

const props = defineProps<{
  modelValue: boolean;
  /** null = 新增；有值 = 编辑（模式由 parent_id 推导） */
  category: Category | null;
  /** 新增时的模式：一级 or 二级（编辑时忽略） */
  mode: "top" | "child";
  /** 新增二级时的默认所属一级分类 id */
  initialParentId?: number | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

/** 当前是编辑还是一级分类（一级分类才显示 emoji 选择器） */
const isEdit = computed(() => props.category !== null);
const isTop = computed(() => (props.category ? props.category.parent_id === null : props.mode === "top"));

const name = ref("");
const icon = ref("🗂️");
const parentId = ref<number | null>(null);
const saving = ref(false);

/** 打开时回填（编辑）或重置（新增） */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.category) {
      name.value = props.category.name;
      icon.value = props.category.icon ?? "🗂️";
      parentId.value = props.category.parent_id;
    } else {
      name.value = "";
      icon.value = "🗂️";
      parentId.value = props.mode === "child" ? (props.initialParentId ?? null) : null;
    }
  },
);

/** 搬家选择器分组：预置 / 我的 */
const presetTops = computed(() => store.topCategories.filter((c) => c.builtin === 1));
const customTops = computed(() => store.topCategories.filter((c) => c.builtin === 0));

async function onSave(): Promise<void> {
  const trimmed = name.value.trim();
  if (!trimmed) {
    ElMessage.warning("请输入分类名称");
    return;
  }
  if (!isTop.value && parentId.value === null) {
    ElMessage.warning("请选择所属一级分类");
    return;
  }

  // 同级重名校验（不同父级下同名允许；编辑时排除自己）
  const dup = store.categories.some(
    (c) =>
      c.id !== props.category?.id &&
      (isTop.value ? c.parent_id === null : c.parent_id === parentId.value) &&
      c.name === trimmed,
  );
  if (dup) {
    ElMessage.warning("同一层级下已存在同名分类");
    return;
  }

  saving.value = true;
  try {
    if (props.category) {
      await store.updateCategory(props.category.id, {
        name: trimmed,
        icon: isTop.value ? icon.value : undefined,
        parentId: isTop.value ? undefined : parentId.value,
      });
    } else {
      await store.addCategory({
        name: trimmed,
        parentId: isTop.value ? null : parentId.value,
        icon: isTop.value ? icon.value : null,
      });
    }
    visible.value = false;
    ElMessage.success(isEdit.value ? "已保存" : "已新增分类");
    emit("saved");
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "保存失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑分类' : isTop ? '新增一级分类' : '新增二级分类'"
    width="420px"
    align-center
  >
    <div class="form">
      <el-input
        v-model="name"
        placeholder="分类名称"
        maxlength="10"
        show-word-limit
        @keyup.enter="onSave"
      />

      <!-- 一级分类：选 emoji 图标 -->
      <div v-if="isTop" class="icon-field">
        <div class="field-label">图标</div>
        <div class="icon-grid">
          <div
            v-for="ic in CATEGORY_ICONS"
            :key="ic"
            class="icon-cell"
            :class="{ selected: icon === ic }"
            @click="icon = ic"
          >
            {{ ic }}
          </div>
        </div>
      </div>

      <!-- 二级分类：选所属一级分类（编辑时即「搬家」） -->
      <div v-else class="field">
        <div class="field-label">所属一级分类</div>
        <el-select v-model="parentId" placeholder="请选择" style="width: 100%">
          <el-option-group v-if="presetTops.length > 0" label="预置分类">
            <el-option v-for="c in presetTops" :key="c.id" :value="c.id" :label="`${c.icon} ${c.name}`" />
          </el-option-group>
          <el-option-group v-if="customTops.length > 0" label="我的分类">
            <el-option v-for="c in customTops" :key="c.id" :value="c.id" :label="`${c.icon} ${c.name}`" />
          </el-option-group>
        </el-select>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}

.icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-cell {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  background: #f3f4f6;
  transition: all 0.12s;
}

.icon-cell:hover {
  background: #fef3c7;
}

.icon-cell.selected {
  border-color: #f59e0b;
  background: #fef3c7;
}
</style>
