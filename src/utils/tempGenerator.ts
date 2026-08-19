import { TempRecord } from '../types/reefer';

// 強健的日期解析器：同時相容 "YYYY/MM/DD HH:mm" 與 "YYYY-MM-DDTHH:mm"
const parseDatetime = (str: string): Date | null => {
  if (!str || !str.trim()) return null;
  const normalized = str.trim().replace(/\//g, '-').replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

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

export const generateAutoTempRecords = (
  settingTempStr: string,
  loadingDatetimeStr: string,
  dischargeDatetimeStr: string
): TempRecord[] => {
  // 必須同時提供有效的裝船與卸船日期時間，否則不進行自動生成
  if (!loadingDatetimeStr || !dischargeDatetimeStr) return [];

  const parsedStart = parseDatetime(loadingDatetimeStr);
  const parsedEnd = parseDatetime(dischargeDatetimeStr);
  if (!parsedStart || !parsedEnd) return [];

  const baseTemp = parseFloat(settingTempStr) || 0.0;
  const startDate = parsedStart;
  const loadTimeMs = parsedStart.getTime();
  const endDate = parsedEnd;
  const dischargeTimeMs = parsedEnd.getTime();

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

    const df1 = genTemp(t08);
    const df2 = genTemp(t16);
    const df3 = genTemp(t23);

    // 若當天 08:00, 16:00, 23:59 皆不在裝卸時間範圍內（全數為空白），則不保留該日紀錄列
    if (df1 || df2 || df3) {
      records.push({
        id: `auto-tr-${Date.now()}-${idx}`,
        dateLog: dateStr,
        df1,
        df2,
        df3,
        remark: '',
      });
    }

    // 推進至下一天
    currDate.setDate(currDate.getDate() + 1);
    idx++;
  }

  return records;
};

/**
 * 依據裝船日期時間 (loadingDatetime) 與卸船日期時間 (dischargeDatetime) 計算航程涵蓋的日曆天數 (days) 與獎金 (cash)
 * 若有完整的裝卸船日期時間，計算含首尾的實際涵蓋日曆天數 (例如 7/23 裝船 ~ 8/1 卸船 = 10 天，即便凌晨卸貨無當日巡溫點亦計為 10 天)
 * 若無完整的裝卸船日期時間，則 fallback 至溫度紀錄筆數 (tempRecordsLength)
 */
export const calculateReeferDaysAndCash = (
  loadingDatetimeStr?: string,
  dischargeDatetimeStr?: string,
  tempRecordsLength: number = 0
): { days: number; cash: number } => {
  let days = 0;

  if (loadingDatetimeStr && dischargeDatetimeStr) {
    const loadDate = parseDatetime(loadingDatetimeStr);
    const dischDate = parseDatetime(dischargeDatetimeStr);
    if (loadDate && dischDate) {
      const start = new Date(loadDate.getFullYear(), loadDate.getMonth(), loadDate.getDate());
      const end = new Date(dischDate.getFullYear(), dischDate.getMonth(), dischDate.getDate());
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1; // 含首尾天數
      if (diffDays > 0) {
        days = diffDays;
      }
    }
  }

  if (days === 0) {
    days = tempRecordsLength > 0 ? tempRecordsLength : 1;
  }

  const cash = days >= 10 ? 800 : 400;
  return { days, cash };
};
