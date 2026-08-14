import { TempRecord } from '../types/reefer';

export const generateAutoTempRecords = (
  settingTempStr: string,
  loadingDatetimeStr: string,
  dischargeDatetimeStr: string
): TempRecord[] => {
  // 必須提供有效的卸船日期時間，否則不進行自動生成
  if (!dischargeDatetimeStr) return [];

  const parsedEnd = new Date(dischargeDatetimeStr);
  if (isNaN(parsedEnd.getTime())) return [];

  const baseTemp = parseFloat(settingTempStr) || 0.0;

  // 解析裝船開始日期與時間（若未填寫則預設使用當前時間）
  let startDate = new Date();
  let loadTimeMs = startDate.getTime();
  if (loadingDatetimeStr) {
    const parsed = new Date(loadingDatetimeStr);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
      loadTimeMs = parsed.getTime();
    }
  }

  const endDate = parsedEnd;
  const dischargeTimeMs = endDate.getTime();

  const records: TempRecord[] = [];
  const currDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const finalDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  let idx = 0;
  while (currDate.getTime() <= finalDate.getTime() && idx < 60) { // 上限最多產生 60 天紀錄
    const year = currDate.getFullYear();
    const month = String(currDate.getMonth() + 1).padStart(2, '0');
    const day = String(currDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 當日 08:00、16:00、23:59 的時間戳記
    const t08 = new Date(year, currDate.getMonth(), currDate.getDate(), 8, 0, 0).getTime();
    const t16 = new Date(year, currDate.getMonth(), currDate.getDate(), 16, 0, 0).getTime();
    const t23 = new Date(year, currDate.getMonth(), currDate.getDate(), 23, 59, 0).getTime();

    // 產生帶有 ±0.5°C 浮動值的溫度數值字串
    const genTemp = (slotTimeMs: number): string => {
      // 必須介於裝船時間與卸船時間之間
      if (slotTimeMs < loadTimeMs || slotTimeMs > dischargeTimeMs) {
        return '';
      }
      const offset = (Math.random() * 1.0) - 0.5; // -0.5°C 至 +0.5°C 浮動
      const val = baseTemp + offset;
      return val.toFixed(1);
    };

    records.push({
      id: `auto-tr-${Date.now()}-${idx}`,
      dateLog: dateStr,
      df1: genTemp(t08),
      df2: genTemp(t16),
      df3: genTemp(t23),
      remark: '',
    });

    // 推進至下一天
    currDate.setDate(currDate.getDate() + 1);
    idx++;
  }

  return records;
};
