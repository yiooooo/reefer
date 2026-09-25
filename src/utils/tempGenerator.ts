/**
 * 格式化溫度數字：確保為小數點後一位 (例如 "-20" -> "-20.0", "18" -> "18.0", "0" -> "0.0")
 * 若為空值、全空白或無法解析的文字則傳回原值/空白
 */
export const formatTempNumber = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';

  const num = Number(str);
  if (isNaN(num)) return str;

  return num.toFixed(1);
};
