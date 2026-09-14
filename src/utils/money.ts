/** 分 → 元字符串（固定两位小数）：12345 → "123.45"、5 → "0.05" */
export function formatYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}
