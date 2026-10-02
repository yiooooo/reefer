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

  // 上/下船時間過濾
  if (crew.hasSignOn && crew.signOnDate) {
    if (dt < `${crew.signOnDate} ${crew.signOnHour || '00'}:${crew.signOnMin || '00'}`) return null;
  }
  if (crew.hasSignOff && crew.signOffDate) {
    if (dt >= `${crew.signOffDate} ${crew.signOffHour || '00'}:${crew.signOffMin || '00'}`) return null;
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
        if (mm === 'NONE') return null;
        if (mm === 'DUTY_ONLY') return isSlotInShifts(slotIdx, work) ? 'W' : null;
        if (mm === 'TWO_TWO') return isSlotInShiftsExtended(slotIdx, work, 2) ? 'W' : null;
        return 'W';
      }
      return c;
    }
  }

  const sc = slots[slotIdx];

  // 進出港（W）
  if (sc === 'W') {
    if (mm === 'NONE') return null;
    if (mm === 'DUTY_ONLY') return isSlotInShifts(slotIdx, work) ? 'W' : null;
    if (mm === 'TWO_TWO') return isSlotInShiftsExtended(slotIdx, work, 2) ? 'W' : null;
    return 'W';
  }

  // 其他強制代碼（直接套用）
  if (['B', 'T', 'I', 'E', 'O'].includes(sc)) return sc;

  // 甲板班休息日
  const isDeck = grps.includes('g_5');
  if (isDeck) {
    if (slotIdx < 24 && deckRestAm) return null;
    if (slotIdx >= 24 && deckRestPm) return null;
  }

  if (sc === 'P') {
    if (crew.portNoWork) return null;
    return isSlotInShifts(slotIdx, work) ? 'P' : null;
  }
  if (sc === 'D') {
    if (wk === 'Y') return !crew.seaNoWork && isSlotInShifts(slotIdx, duty) ? 'D' : null;
    return !crew.portNoWork && isSlotInShifts(slotIdx, work) ? 'D' : null;
  }
  if (sc === 'N') {
    if (crew.seaNoWork) return null;
    if (isSlotInShifts(slotIdx, duty)) return wk === 'Y' ? 'N' : 'W';
    return null;
  }
  return null;
};

// ─── 跨月回溯 ────────────────────────────────────────────────────────────────

/**
 * 讀取上個月末幾天的休息格位陣列（供 MLC 跨月驗證用）
 * @param lookbackDays 回溯天數（預設 6 天）
 */
export const getLookbackMonthSlots = (
  selYear: string,
  selMonth: string,
  crewId: string,
  lookbackDays = 6,
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

  const result: number[] = [];
  for (let d = Math.max(1, days - lookbackDays + 1); d <= days; d++) {
    const ds = `${py}-${pm}-${String(d).padStart(2, '0')}`;
    const dd = pvd?.[`day_${d}`] ?? ({ slots: Array(48).fill('N') } as DayData);
    for (let s = 0; s < 48; s++) {
      if (pc) {
        result.push(resolveCrewWorkSlots(pc, dd, ds, s) ? 0 : 1);
      } else {
        // 無上月資料時的預設：08-12 / 20-24 為工作，其餘休息
        result.push((s >= 16 && s < 24) || (s >= 32 && s < 40) ? 0 : 1);
      }
    }
  }
  return result;
};

// ─── MLC 違規評估 ─────────────────────────────────────────────────────────────

/**
 * 評估 MLC 2006 休息時數違規
 * @param full  完整格位陣列（0=工作, 1=休息），包含 lookback 部分
 * @param offset lookback 的格位數量（從 offset 起才計入當月違規）
 * @returns 每格位的違規訊息陣列
 */
export const evaluateMLCWithLookback = (full: number[], offset: number): string[][] => {
  const len = full.length - offset;
  const v: string[][] = Array.from({ length: len }, () => []);

  // 任意 24h（= 48 格）視窗掃描
  for (let i = 0; i <= full.length - 48; i++) {
    const w = full.slice(i, i + 48);
    const rh = w.filter(x => x === 1).length * 0.5;
    const we = i + 47;
    if (we >= offset) {
      const rs = Math.max(0, i - offset);
      const re = Math.min(len - 1, we - offset);

      // 規則 1：任意 24h 內休息不足 10h
      if (rh < 10) {
        for (let k = rs; k <= re; k++) v[k].push('Any 24h 休息不足 10h');
      }

      // 規則 2：任意 24h 內無單段連續 6h 休息
      const blocks: number[] = [];
      let cur = 0;
      for (let s = 0; s < 48; s++) {
        if (w[s] === 1) {
          cur++;
        } else {
          if (cur > 0) {
            blocks.push(cur * 0.5);
            cur = 0;
          }
        }
      }
      if (cur > 0) blocks.push(cur * 0.5);
      if (!blocks.some(b => b >= 6) && w.some(x => x === 1)) {
        for (let k = rs; k <= re; k++) v[k].push('Any 24h 內無單段連續 6h 休息');
      }

      // 規則 3：連續工作超過 14h（28 格）
      let streak = 0;
      for (let s = 0; s < 48; s++) {
        if (w[s] === 0) {
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
    const w7 = full.slice(i, i + 336);
    const r7 = w7.filter(x => x === 1).length * 0.5;
    const we = i + 335;
    if (we >= offset && r7 < 77) {
      const rs = Math.max(0, i - offset);
      const re = Math.min(len - 1, we - offset);
      for (let k = rs; k <= re; k++) v[k].push('Any 7 days 休息不足 77h');
    }
  }

  return v;
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
      });
      list.push({
        rowKey: `day_${day}_repeat`,
        displayLabel: `${day}`,
        dateSuffix: ' (+24)',
        weekName: wn,
        isWeekend: iw,
        dayNum: day,
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

/** 取得 localStorage 群組定義（帶預設值） */
export const loadGroupDefinitions = (defaultGroups: GroupDef[]): GroupDef[] => {
  try {
    return (
      JSON.parse(localStorage.getItem('custom_group_definitions_v2') || 'null') || defaultGroups
    );
  } catch {
    return defaultGroups;
  }
};
