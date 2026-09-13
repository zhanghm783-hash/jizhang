<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { PAYMENT_METHODS } from "../constants";
import { useAppStore } from "../stores/app";
import type { ExpenseListItem } from "../types";

const props = defineProps<{
  modelValue: boolean;
  expense: ExpenseListItem | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const store = useAppStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const amount = ref<number | null>(null);
const parentId = ref<number | null>(null);
const categoryId = ref<number | null>(null);
const date = ref(todayStr());
const paymentMethod = ref("微信");
const note = ref("");
const saving = ref(false);

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 弹窗打开时初始化表单：编辑则回填，新增则用默认值 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const e = props.expense;
    amount.value = e ? e.amount_cents / 100 : null;
    parentId.value = e ? e.parent_id : null;
    categoryId.value = e ? e.category_id : null;
    date.value = e ? e.date : todayStr();
    paymentMethod.value = e ? e.payment_method : "微信";
    note.value = e ? e.note : "";
  },
);

/** 新增时切换一级分类需要重新选二级；编辑时只有改了一级分类才重置 */
watch(parentId, () => {
  if (!props.expense || parentId.value !== props.expense.parent_id) {
    categoryId.value = null;
  }
});

async function onSave(): Promise<void> {
  if (amount.value === null || amount.value <= 0) {
    ElMessage.warning("请输入正确的金额");
    return;
  }
  if (!categoryId.value) {
    ElMessage.warning("请选择分类");
    return;
  }
  saving.value = true;
  try {
    await store.saveExpense(
      {
        amountCents: Math.round(amount.value * 100),
        date: date.value,
        categoryId: categoryId.value,
        paymentMethod: paymentMethod.value,
        note: note.value.trim(),
      },
      props.expense?.id,
    );
    emit("saved");
  } catch (err) {
    console.error(err);
    ElMessage.error("保存失败，请重试");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="expense ? '编辑账单' : '记一笔'" width="420px" align-center>
    <div class="form">
      <div class="amount-row">
        <span class="currency">¥</span>
        <el-input-number
          v-model="amount"
          :controls="false"
          :precision="2"
          :min="0.01"
          :max="9999999.99"
          placeholder="0.00"
          size="large"
          class="amount-input"
        />
      </div>

      <div class="form-row">
        <el-select v-model="parentId" placeholder="一级分类" style="width: 100%">
          <el-option
            v-for="c in store.topCategories"
            :key="c.id"
            :value="c.id"
            :label="`${c.icon} ${c.name}`"
          />
        </el-select>
        <el-select v-model="categoryId" placeholder="二级分类" style="width: 100%" :disabled="!parentId">
          <el-option v-for="c in store.childrenOf(parentId)" :key="c.id" :value="c.id" :label="c.name" />
        </el-select>
      </div>

      <div class="form-row">
        <el-date-picker
          v-model="date"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY年MM月DD日"
          placeholder="选择日期"
          style="width: 100%"
        />
        <el-select v-model="paymentMethod" placeholder="支付方式" style="width: 100%">
          <el-option v-for="m in PAYMENT_METHODS" :key="m" :value="m" :label="m" />
        </el-select>
      </div>

      <div class="form-row">
        <el-input v-model="note" placeholder="备注（选填），如：请老王吃饭" maxlength="50" show-word-limit />
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
  gap: 14px;
}

.amount-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.currency {
  font-size: 26px;
  font-weight: 700;
  color: #1f2937;
}

.amount-input {
  flex: 1;
}

.amount-input :deep(.el-input__inner) {
  font-size: 26px;
  font-weight: 700;
  height: 52px;
}

.form-row {
  display: flex;
  gap: 12px;
}
</style>
