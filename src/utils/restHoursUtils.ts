// REST HOURS MANAGER — 純函式工具庫
import type { CrewMember, DayData, DisplayRow, GroupDef, TimeShift } from '../types/restHours';

// ─── 日期 / 月份計算 ──────────────────────────────────────────────────────────

/** 取得前一個月的 YYYYMM 字串 */
export const getPrevYearMonth = (yearStr: string, monthStr: string): string => {
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10);
  if (m === 1) {
    y -= 1;
    m = 12;
  } else {
    m -= 1;
  }
  return `${y}${String(m).padStart(2, '0')}`;
};

/** 取得該月份天數 */
export const getDaysInMonth = (year: string, month: string): number => {
  return new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
};

// ─── 時間 ↔ 格位 轉換 ────────────────────────────────────────────────────────

/**
 * 將時間字串（如 "2230"、"22:30"）轉為 0–47 的格位索引
 * @param position 'start' 無條件捨去；'end' 無條件進位
 */
export const parseTimeToSlot = (timeStr: string, position: 'start' | 'end' = 'start'): number => {
  if (!timeStr) return 0;
  let clean = timeStr.replace(':', '').trim();
  if (clean.length < 3) clean = clean.padStart(4, '0');
  const h = parseInt(clean.slice(0, 2), 10);
  const m = parseInt(clean.slice(2, 4), 10);
  const total = h * 60 + m;
  return position === 'start'
    ? Math.max(0, Math.floor(total / 30))
    : Math.max(1, Math.ceil(total / 30));
};

// ─── 班次交集判斷 ─────────────────────────────────────────────────────────────

/** 判斷格位是否落在班次內 */
export const isSlotInShifts = (slotIdx: number, shifts: TimeShift[]): boolean => {
  if (!shifts?.length) return false;
  const slotStart = slotIdx * 30;
  const slotEnd = (slotIdx + 1) * 30;
  return shifts.some(s => {
    const sm = parseInt(s.startHour, 10) * 60 + parseInt(s.startMin, 10);
    const em = parseInt(s.endHour, 10) * 60 + parseInt(s.endMin, 10);
    // 跨夜班次
    if (em < sm) return slotStart >= sm || slotEnd <= em;
    return slotStart >= sm && slotEnd <= em;
  });
};

/** 判斷格位是否在班次的擴充範圍內（前後 extendHours 小時） */
export const isSlotInShiftsExtended = (
  slotIdx: number,
  shifts: TimeShift[],
  extendHours = 2,
): boolean => {
  if (!shifts?.length) return false;
  const ext = Math.round(extendHours * 2);
  return shifts.some(s => {
    const startSlot = Math.floor((parseInt(s.startHour, 10) * 60 + parseInt(s.startMin, 10)) / 30);
    const endSlot = Math.ceil((parseInt(s.endHour, 10) * 60 + parseInt(s.endMin, 10)) / 30);
    const baseSlots: number[] = [];
    if (endSlot <= startSlot) {
      for (let i = startSlot; i < 48; i++) baseSlots.push(i);
      for (let i = 0; i < endSlot; i++) baseSlots.push(i);
    } else {
      for (let i = startSlot; i < endSlot; i++) baseSlots.push(i);
    }
    return baseSlots.some(b => {
      const d = Math.abs(slotIdx - b);
      return Math.min(d, 48 - d) <= ext;
    });
  });
};

// ─── 船員工作格位解析 ─────────────────────────────────────────────────────────

/**
 * 判斷指定日期的指定格位，船員是否已在船（介於上船與下船時間之間）
 */
export const isSlotOnBoard = (crew: CrewMember, dateStr: string, slotIdx: number): boolean => {
  const slotH = String(Math.floor(slotIdx / 2)).padStart(2, '0');
  const slotM = slotIdx % 2 === 0 ? '00' : '30';
  const dt = `${dateStr} ${slotH}:${slotM}`;

  if (crew.hasSignOn && crew.signOnDate) {
    const signOnDt = `${crew.signOnDate} ${crew.signOnHour || '00'}:${crew.signOnMin || '00'}`;
    if (dt < signOnDt) return false;
  }
  if (crew.hasSignOff && crew.signOffDate) {
    const signOffDt = `${crew.signOffDate} ${crew.signOffHour || '00'}:${crew.signOffMin || '00'}`;
    if (dt >= signOffDt) return false;
  }
  return true;
};

/**
 * 判斷指定整日，船員是否完全未在船（整日都在上船日之前，或整日都在下船日之後）
 */
export const isDayCompletelyOffBoard = (
  crew: CrewMember,
  dateStr: string,
): 'BEFORE_SIGN_ON' | 'AFTER_SIGN_OFF' | null => {
  if (crew.hasSignOn && crew.signOnDate) {
    if (dateStr < crew.signOnDate) return 'BEFORE_SIGN_ON';
  }
  if (crew.hasSignOff && crew.signOffDate) {
    if (dateStr > crew.signOffDate) return 'AFTER_SIGN_OFF';
    if (
      dateStr === crew.signOffDate &&
      (crew.signOffHour === '00' || !crew.signOffHour) &&
      (crew.signOffMin === '00' || !crew.signOffMin)
    ) {
      return 'AFTER_SIGN_OFF';
    }
  }
  return null;
};

/**
 * 根據船員設定、船舶日資料，解析某一格位的工作代碼
 * @returns 工作代碼（'N'/'P'/'W'… 等）或 null（代表休息）
 */
export const resolveCrewWorkSlots = (
  crew: CrewMember,
  dayDataObj: DayData | undefined,
  currentDateStr: string,
  slotIdx: number,
): string | null => {
  const slotH = String(Math.floor(slotIdx / 2)).padStart(2, '0');
  const slotM = slotIdx % 2 === 0 ? '00' : '30';
  const dt = `${currentDateStr} ${slotH}:${slotM}`;

  // 上/下船時間過濾：未在船期間一律回傳 null
  if (!isSlotOnBoard(crew, currentDateStr, slotIdx)) {
    return null;
  }

  const slots = dayDataObj?.slots ?? Array(48).fill('N');
  const sgo = dayDataObj?.slotGroupOverrides ?? {};
  const deckRestAm = !!dayDataObj?.deckRestAm;
  const deckRestPm = !!dayDataObj?.deckRestPm;

  // 解析當前班次（可能被換班記錄覆蓋）
  let duty = crew.dutyShifts;
  let work = crew.workingShifts;
  let wk = crew.watchKeeping;
  let mm = crew.maneuveringMode || 'ALL';
  let grps = crew.groups ?? [];

  if (crew.shiftChanges?.length) {
    const sorted = [...crew.shiftChanges].sort((a, b) =>
      (a.effectiveDate + (a.effectiveHour || '00') + (a.effectiveMin || '00')).localeCompare(
        b.effectiveDate + (b.effectiveHour || '00') + (b.effectiveMin || '00'),
      ),
    );
    const active = sorted.filter(
      sc => dt >= `${sc.effectiveDate} ${sc.effectiveHour || '00'}:${sc.effectiveMin || '00'}`,
    );
    if (active.length) {
      const lat = active[active.length - 1];
      duty = lat.dutyShifts;
      work = lat.workingShifts;
      wk = lat.watchKeeping;
      if (lat.maneuveringMode) mm = lat.maneuveringMode;
      if (lat.groups) grps = lat.groups;
    }
  }

  // 群組作業覆蓋
  const ov = (sgo as Record<number, Record<string, string>>)[slotIdx] ?? {};
  for (const gId of grps) {
    if (ov[gId]) {
      const c = ov[gId];
      if (c === 'W') {
        if (gId === 'g_9') return 'W';
        if (mm === 'NONE') return null;
        if (mm === 'DUTY_ONLY') return isSlotInShifts(slotIdx, work) ? 'W' : null;
        if (mm === 'TWO_TWO') return isSlotInShiftsExtended(slotIdx, work, 2) ? 'W' : null;
        return 'W';
      }
      return c;
    }
  }

  const sc = slots[slotIdx];

  // 判斷是否為廚師（COOK 或隸屬大廚群組 g_9）
  const isCook = crew.rank.toUpperCase().startsWith('COOK') || grps.includes('g_9');

  // COOK 專屬規則：
  // 不論船舶狀態為 P、W、D、N，COOK 均不受進出港全船 W 影響（照常掌廚），
  // 且因無須值班（wk === 'N'），在港口與海上工作時段內皆統一顯示為 'W'
  if (isCook) {
    if (['B', 'T', 'I', 'E', 'O'].includes(sc)) return sc;
    if (crew.seaNoWork) return null;
    return isSlotInShifts(slotIdx, duty) ? 'W' : null;
  }

  // 進出港（W）
  if (sc === 'W') {
    if (mm === 'NONE') return null;
    if (mm === 'DUTY_ONLY') return isSlotInShifts(slotIdx, work) ? 'W' : null;
    if (mm === 'TWO_TWO') return isSlotInShiftsExtended(slotIdx, work, 2) ? 'W' : null;
    return 'W';
  }

  // 其他強制代碼（直接套用）
  if (['B', 'T', 'I', 'E', 'O'].includes(sc)) return sc;

  // 甲板班休息日檢查：只針對群組包含甲板(g_5)且無當值(wk !== 'Y')的人員，在海上工作時間有效
  const isDeck = grps.includes('g_5');
  const isDeckRest = isDeck && wk !== 'Y' && ((slotIdx < 24 && deckRestAm) || (slotIdx >= 24 && deckRestPm));

  if (sc === 'P') {
    // 港口工作狀態：不受甲板休息日影響
    if (crew.portNoWork) return null;
    return isSlotInShifts(slotIdx, work) ? 'P' : null;
  }
  if (sc === 'D') {
    // 錨泊 (D) 狀態：套用海上工作時間 (dutyShifts)，當值為 Y 顯示 D，當值為 N 顯示 W，且受甲板休息日影響
    if (crew.seaNoWork) return null;
    if (isDeckRest) return null;
    if (isSlotInShifts(slotIdx, duty)) return wk === 'Y' ? 'D' : 'W';
    return null;
  }
  if (sc === 'N') {
    if (crew.seaNoWork) return null;
    if (isDeckRest) return null;
    if (isSlotInShifts(slotIdx, duty)) return wk === 'Y' ? 'N' : 'W';
    return null;
  }
  return null;
};

// ─── 跨月回溯 ────────────────────────────────────────────────────────────────

/**
 * 讀取上個月末幾天的休息格位陣列（供 MLC 跨月驗證用）
 * @param lookbackDays 回溯天數（預設 6 天）
 * @param fallbackCrew 當找不到上月資料時，用來推算常態班次的當前船員資料
 */
export const getLookbackMonthSlots = (
  selYear: string,
  selMonth: string,
  crewId: string,
  lookbackDays = 6,
  fallbackCrew?: CrewMember | null,
): number[] => {
  const pym = getPrevYearMonth(selYear, selMonth);
  const py = pym.slice(0, 4);
  const pm = pym.slice(4);
  const days = getDaysInMonth(py, pm);

  let pvd: Record<string, DayData> | null = null;
  let pc: CrewMember | null = null;
  try {
    pvd = JSON.parse(localStorage.getItem(`vessel_schedule_${pym}`) || 'null');
  } catch {
    /* ignore */
  }
  try {
    const arr = JSON.parse(localStorage.getItem(`rest_hours_${pym}`) || 'null');
    if (arr) pc = (arr as CrewMember[]).find(c => c.id === crewId) ?? null;
  } catch {
    /* ignore */
  }

  // 若上月紀錄不存在，優先採用傳入的當前船員資料（或從當前月份儲存中取得），以該員自身班次推算
  if (!pc) {
    if (fallbackCrew) {
      pc = fallbackCrew;
    } else {
      try {
        const curArr = JSON.parse(localStorage.getItem(`rest_hours_${selYear}${selMonth}`) || 'null');
        if (curArr) pc = (curArr as CrewMember[]).find(c => c.id === crewId) ?? null;
      } catch {
        /* ignore */
      }
    }
  }

  const result: number[] = [];
  for (let d = Math.max(1, days - lookbackDays + 1); d <= days; d++) {
    const ds = `${py}-${pm}-${String(d).padStart(2, '0')}`;
    const dd = pvd?.[`day_${d}`] ?? ({ slots: Array(48).fill('N') } as DayData);
    for (let s = 0; s < 48; s++) {
      if (pc) {
        // 依據該人員自身班次（00~04、04~08 或 08~12 等）推算上月末狀態
        result.push(resolveCrewWorkSlots(pc, dd, ds, s) ? 0 : 1);
      } else {
        // 若完全無法取得人員班次，預設休息(1)，避免虛構工作時間造成跨月誤判違規
        result.push(1);
      }
    }
  }
  return result;
};

// ─── MLC 違規評估 ─────────────────────────────────────────────────────────────

/**
 * 取得 48 格（24小時）視窗中，休息時段（連續 1 的區間）的統計：
 * - max1: 最長的一段連續休息時數（小時）
 * - top2Sum: 最長最多兩段連續休息時數合計（小時）
 * - totalRest: 視窗內所有休息時數合計（小時）
 *
 * 符合 MLC 2006 / STCW 規範：
 * 任意 24 小時內之休息時間可分成數段，但「最多兩段加起來需達 10 小時以上」，且「其中一段需達 6 小時以上」。
 */
export const get24hRestPeriods = (
  full: number[],
  start: number,
): {
  max1: number;
  top2Sum: number;
  totalRest: number;
} => {
  let m1 = 0; // 最長一段格數
  let m2 = 0; // 次長一段格數
  let cur = 0;
  let totalSlots = 0;

  for (let s = 0; s < 48; s++) {
    if (full[start + s] === 1) {
      cur++;
      totalSlots++;
    } else {
      if (cur > 0) {
        if (cur > m1) {
          m2 = m1;
          m1 = cur;
        } else if (cur > m2) {
          m2 = cur;
        }
        cur = 0;
      }
    }
  }
  if (cur > 0) {
    if (cur > m1) {
      m2 = m1;
      m1 = cur;
    } else if (cur > m2) {
      m2 = cur;
    }
  }

  return {
    max1: m1 * 0.5,
    top2Sum: (m1 + m2) * 0.5,
    totalRest: totalSlots * 0.5,
  };
};

/**
 * 評估 MLC 2006 休息時數違規
 * @param full  完整格位陣列（0=工作, 1=休息），包含 lookback 部分
 * @param offset lookback 的格位數量（從 offset 起才計入當月違規）
 * @returns 每格位的違規訊息陣列
 */
export const evaluateMLCWithLookback = (full: number[], offset: number): string[][] => {
  const len = full.length - offset;
  const v: string[][] = Array.from({ length: len }, () => []);

  // 預先計算前綴和 (Prefix Sums)，將 7d 視窗內的休息時數查詢加速為 O(1)
  const prefixRest = new Int16Array(full.length + 1);
  for (let i = 0; i < full.length; i++) {
    prefixRest[i + 1] = prefixRest[i] + (full[i] === 1 ? 1 : 0);
  }

  // 任意 24h（= 48 格）視窗掃描
  for (let i = 0; i <= full.length - 48; i++) {
    const we = i + 47;
    if (we >= offset) {
      const rs = Math.max(0, i - offset);
      const re = Math.min(len - 1, we - offset);

      const { max1, top2Sum, totalRest } = get24hRestPeriods(full, i);

      // 規則 1：任意 24h 內最多兩段休息合計不足 10h（例：6+4=10 合格，6+2+2 最多兩段僅 8h 違規）
      if (top2Sum < 10) {
        for (let k = rs; k <= re; k++) v[k].push('Any 24h 休息不足 10h');
      }

      // 規則 2：任意 24h 內無單段連續 6h 休息 (最長一段需達 6h 以上)
      if (max1 < 6 && totalRest > 0) {
        for (let k = rs; k <= re; k++) v[k].push('Any 24h 內無單段連續 6h 休息');
      }

      // 規則 3：連續工作超過 14h（28 格）
      let streak = 0;
      for (let s = 0; s < 48; s++) {
        if (full[i + s] === 0) {
          streak++;
          if (streak > 28) {
            const ti = i + s - offset;
            if (ti >= 0 && ti < len) v[ti].push('連續工作區間超過 14h');
          }
        } else {
          streak = 0;
        }
      }
    }
  }

  // 規則 4：任意 7 天（= 336 格）休息不足 77h
  for (let i = 0; i <= full.length - 336; i++) {
    const we = i + 335;
    if (we >= offset) {
      const r7 = (prefixRest[i + 336] - prefixRest[i]) * 0.5;
      if (r7 < 77) {
        const rs = Math.max(0, i - offset);
        const re = Math.min(len - 1, we - offset);
        for (let k = rs; k <= re; k++) v[k].push('Any 7 days 休息不足 77h');
      }
    }
  }

  return v;
};

// ─── 超時工時（加班時數）計算 ─────────────────────────────────────────────────

/**
 * 計算單日超時工時（加班時數）
 * 規則：
 * 1. 星期天 或 勾選國定假日的日子：有工作皆屬超時工時（全額計入）
 * 2. 禮拜六（且非國定假日）：超過 4 小時之部分計為超時工時
 * 3. 平日（週一至週五，非國定假日）：超過 8 小時之部分計為超時工時
 *
 * @param workHours 當日總工時
 * @param weekNameOrDow 星期名稱 ('日' | '一' | '二' | '三' | '四' | '五' | '六') 或星期數字 (0=週日, 6=週六)
 * @param isCustomHoliday 是否勾選國定假日
 */
export const calculateOvertimeHours = (
  workHours: number,
  weekNameOrDow: string | number,
  isCustomHoliday: boolean,
): number => {
  if (workHours <= 0) return 0;
  const isSunday = weekNameOrDow === '日' || weekNameOrDow === 0;
  const isSaturday = weekNameOrDow === '六' || weekNameOrDow === 6;

  // 星期天 或 勾選國定假日：有工作全部計為超時工時
  if (isCustomHoliday || isSunday) {
    return workHours;
  }
  // 禮拜六：超過 4 小時的部分才計算為超時工時
  if (isSaturday) {
    return Math.max(0, workHours - 4);
  }
  // 平日（週一至週五）：超過 8 小時的部分計算為超時工時
  return Math.max(0, workHours - 8);
};

// ─── 雜項工具 ─────────────────────────────────────────────────────────────────

/** 合併備註字串（避免重複） */
export const appendRemark = (existing: string, added: string): string => {
  const e = (existing || '').trim();
  const a = (added || '').trim();
  if (!a) return e;
  if (!e) return a;
  if (e.includes(a)) return e;
  return `${e}, ${a}`;
};

/** 根據班次時段識別主題色（供 TimeSelect 色彩提示） */
export const getShiftTheme = (shifts: TimeShift[]): string | null => {
  if (!shifts || shifts.length < 2) return null;
  const [s1, s2] = shifts;
  if (
    s1.startHour === '00' &&
    s1.startMin === '00' &&
    s1.endHour === '04' &&
    s1.endMin === '00' &&
    s2.startHour === '12' &&
    s2.startMin === '00' &&
    s2.endHour === '16' &&
    s2.endMin === '00'
  )
    return 'yellow';
  if (
    s1.startHour === '04' &&
    s1.startMin === '00' &&
    s1.endHour === '08' &&
    s1.endMin === '00' &&
    s2.startHour === '16' &&
    s2.startMin === '00' &&
    s2.endHour === '20' &&
    s2.endMin === '00'
  )
    return 'green';
  if (
    s1.startHour === '08' &&
    s1.startMin === '00' &&
    s1.endHour === '12' &&
    s1.endMin === '00' &&
    s2.startHour === '20' &&
    s2.startMin === '00' &&
    s2.endHour === '24' &&
    s2.endMin === '00'
  )
    return 'blue';
  if (
    s1.startHour === '08' &&
    s1.startMin === '00' &&
    s1.endHour === '12' &&
    s1.endMin === '00' &&
    s2.startHour === '13' &&
    s2.startMin === '30' &&
    s2.endHour === '17' &&
    s2.endMin === '30'
  )
    return 'orange';
  return null;
};

/** 建立月份中每一列的顯示資料（處理撥天 ±1 的邏輯） */
export const buildDisplayRows = (
  dailyData: Record<string, DayData>,
  daysInMonth: number,
  selYear: string,
  selMonth: string,
): DisplayRow[] => {
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  const list: DisplayRow[] = [];
  let day = 1;
  while (day <= daysInMonth) {
    const key = `day_${day}`;
    const cfg = (dailyData[key] ?? {}) as DayData;
    const dt = new Date(parseInt(selYear), parseInt(selMonth) - 1, day);
    const dow = dt.getDay();
    const wn = names[dow];
    const iw = dow === 0 || dow === 6;
    if (cfg.dayAdjust === '-1') {
      list.push({
        rowKey: key,
        displayLabel: `${day}`,
        dateSuffix: '',
        weekName: wn,
        isWeekend: iw,
        dayNum: day,
        dayOfWeek: dow,
      });
      list.push({
        rowKey: `day_${day}_repeat`,
        displayLabel: `${day}`,
        dateSuffix: ' (+24)',
        weekName: wn,
        isWeekend: iw,
        dayNum: day,
        dayOfWeek: dow,
      });
      day++;
    } else if (cfg.dayAdjust === '+1') {
      list.push({
        rowKey: key,
        displayLabel: `${day}`,
        dateSuffix: '',
        weekName: wn,
        isWeekend: iw,
        dayNum: day,
        dayOfWeek: dow,
      });
      day += 2;
    } else {
      list.push({
        rowKey: key,
        displayLabel: `${day}`,
        dateSuffix: '',
        weekName: wn,
        isWeekend: iw,
        dayNum: day,
        dayOfWeek: dow,
      });
      day++;
    }
  }
  return list;
};

/** 計算新船員預設物件（供 PartA 新增列使用） */
export const newCrewMember = (): CrewMember => ({
  id: String(Date.now()),
  groups: [],
  rank: 'AB',
  name: '',
  engName: '',
  watchKeeping: 'Y',
  maneuveringMode: 'ALL',
  hasSignOn: false,
  signOnDate: '',
  signOnHour: '08',
  signOnMin: '00',
  hasSignOff: false,
  signOffDate: '',
  signOffHour: '12',
  signOffMin: '00',
  seaNoWork: false,
  portNoWork: false,
  dutyShifts: [
    { startHour: '08', startMin: '00', endHour: '12', endMin: '00' },
    { startHour: '20', startMin: '00', endHour: '24', endMin: '00' },
  ],
  workingShifts: [
    { startHour: '08', startMin: '00', endHour: '12', endMin: '00' },
    { startHour: '13', startMin: '30', endHour: '17', endMin: '30' },
  ],
  shiftChanges: [],
});

/** 取得 localStorage 群組定義（帶預設值與舊版自動遷移） */
export const loadGroupDefinitions = (defaultGroups: GroupDef[]): GroupDef[] => {
  try {
    const raw = localStorage.getItem('custom_group_definitions_v2');
    if (!raw) return defaultGroups;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return defaultGroups;
    return defaultGroups.map(dg => {
      const found = saved.find((s: GroupDef) => s.id === dg.id);
      if (!found) return dg;
      // 若原先為舊版預設的 '自1' / '自訂作業1'，自動遷移為新的 '廚' / '大廚專用'
      if (found.id === 'g_9' && (found.code === '自1' || found.name === '自訂作業1')) {
        return dg;
      }
      return found;
    });
  } catch {
    return defaultGroups;
  }
};
