import React, { useState, useMemo, useEffect } from 'react';
import { RotateCcw, Save, Printer } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { PrintRestHoursModal } from './PrintRestHoursModal';
import { PrintOvertimeModal } from './PrintOvertimeModal';
import type { CrewMember, DayData, CrewOverrides } from '../../types/restHours';
import { STATUS_DEFINITIONS, C_STATUS_CYCLE, emptyDay } from '../../utils/restHoursData';
import {
  buildDisplayRows,
  getDaysInMonth,
  getLookbackMonthSlots,
  evaluateMLCWithLookback,
  get24hRestPeriods,
  resolveCrewWorkSlots,
  calculateOvertimeHours,
  isSlotOnBoard,
  isDayCompletelyOffBoard,
} from '../../utils/restHoursUtils';
import { useToast } from '../../context/ToastContext';

export interface PartCProps {
  selYear: string;
  selMonth: string;
  crewList: CrewMember[];
  dailyData: Record<string, DayData>;
  setDailyData: React.Dispatch<React.SetStateAction<Record<string, DayData>>>;
  allCrewOverrides: Record<string, CrewOverrides>;
  setAllCrewOverrides: React.Dispatch<React.SetStateAction<Record<string, CrewOverrides>>>;
  onBackToB: () => void;
}

interface DRow {
  rowKey: string;
  displayLabel: string;
  dateSuffix: string;
  weekName: string;
  isWeekend: boolean;
  isCustomHoliday: boolean;
  deckRestAm: boolean;
  deckRestPm: boolean;
  base: (string | null)[];
  final: (string | null)[];
  isCustom: boolean[];
  workH: string;
  otH: string;
  remark: string;
  hasCustomRemark: boolean;
  hasViolation: boolean;
  slotV: string[][];
  min24: string;
  min7: string;
  offBoardType: 'BEFORE_SIGN_ON' | 'AFTER_SIGN_OFF' | null;
  slotOnBoard: boolean[];
}

export const PartC: React.FC<PartCProps> = ({
  selYear,
  selMonth,
  crewList,
  dailyData,
  setDailyData,
  allCrewOverrides,
  setAllCrewOverrides,
  onBackToB,
}) => {
  const { showToast } = useToast();
  const daysInMonth = getDaysInMonth(selYear, selMonth);
  const aoKey = `all_crew_overrides_${selYear}${selMonth}`;

  const [selCrew, setSelCrew] = useState<string>(() => crewList[0]?.id || '');
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showPrintOtModal, setShowPrintOtModal] = useState<boolean>(false);

  // Sync selected crew if current selection is invalid
  useEffect(() => {
    if (!crewList.some(c => c.id === selCrew) && crewList.length > 0) {
      setSelCrew(crewList[0].id);
    }
  }, [crewList, selCrew]);

  const rows = useMemo(
    () => buildDisplayRows(dailyData, daysInMonth, selYear, selMonth),
    [dailyData, daysInMonth, selYear, selMonth],
  );

  const deficits = useMemo(() => {
    const s: Record<string, { hasDeficit: boolean; hasCustomTrace: boolean }> = {};
    crewList.forEach(crew => {
      const lb = getLookbackMonthSlots(selYear, selMonth, crew.id, 6, crew);
      const cur: number[] = [];
      const ov = allCrewOverrides[crew.id] || { slots: {}, remarks: {} };
      let hcs = false;
      let hcr = false;

      rows.forEach(row => {
        const ds = `${selYear}-${selMonth}-${String(row.dayNum).padStart(2, '0')}`;
        const dd = dailyData[row.rowKey] || emptyDay();
        const us = ov.slots?.[row.rowKey] || {};
        for (let sIdx = 0; sIdx < 48; sIdx++) {
          const b = resolveCrewWorkSlots(crew, dd, ds, sIdx);
          const f = us[sIdx] !== undefined ? us[sIdx] : b;
          cur.push(f ? 0 : 1);
          if (us[sIdx] !== undefined && us[sIdx] !== b) hcs = true;
        }
        if (ov.remarks?.[row.rowKey] !== undefined && ov.remarks[row.rowKey] !== (dd.remark || '')) {
          hcr = true;
        }
      });

      const v = evaluateMLCWithLookback([...lb, ...cur], lb.length);
      s[crew.id] = {
        hasDeficit: v.some(a => a.length > 0),
        hasCustomTrace: hcs || hcr,
      };
    });
    return s;
  }, [crewList, rows, dailyData, allCrewOverrides, selYear, selMonth]);

  const sim = crewList.find(c => c.id === selCrew);

  const crewData = useMemo((): DRow[] => {
    if (!sim) return [];
    const lb = getLookbackMonthSlots(selYear, selMonth, sim.id, 6, sim);
    const cur: number[] = [];
    const drows: DRow[] = [];
    const ov = allCrewOverrides[sim.id] || { slots: {}, remarks: {} };

    rows.forEach(row => {
      const ds = `${selYear}-${selMonth}-${String(row.dayNum).padStart(2, '0')}`;
      const dd = dailyData[row.rowKey] || emptyDay();
      const os = ov.slots?.[row.rowKey] || {};
      const base: (string | null)[] = [];
      const final: (string | null)[] = [];
      const isC: boolean[] = [];
      const slotOnBoard: boolean[] = [];

      const offType = isDayCompletelyOffBoard(sim, ds);

      for (let sIdx = 0; sIdx < 48; sIdx++) {
        const onBoard = isSlotOnBoard(sim, ds, sIdx);
        slotOnBoard.push(onBoard);

        if (!onBoard) {
          base.push(null);
          final.push(null);
          isC.push(false);
        } else {
          const b = resolveCrewWorkSlots(sim, dd, ds, sIdx);
          base.push(b);
          const f = os[sIdx] !== undefined ? os[sIdx] : b;
          final.push(f);
          isC.push(os[sIdx] !== undefined && os[sIdx] !== b);
        }
      }
      final.forEach(f => cur.push(f ? 0 : 1));

      const wc = final.filter(Boolean).length;
      const wh = wc * 0.5;

      // 若當日整天完全未在船，說明欄與工時均為空白；在船日則顯示備註
      const ar = offType
        ? ''
        : ov.remarks?.[row.rowKey] !== undefined
          ? ov.remarks[row.rowKey]
          : (dd.remark || '');
      const hcr = !offType && ov.remarks?.[row.rowKey] !== undefined && ov.remarks[row.rowKey] !== (dd.remark || '');

      drows.push({
        rowKey: row.rowKey,
        displayLabel: row.displayLabel,
        dateSuffix: row.dateSuffix,
        weekName: row.weekName,
        isWeekend: row.isWeekend,
        isCustomHoliday: !!dd.isCustomHoliday,
        deckRestAm: !!dd.deckRestAm,
        deckRestPm: !!dd.deckRestPm,
        base,
        final,
        isCustom: isC,
        workH: offType ? '' : wh.toFixed(1),
        otH: offType ? '' : calculateOvertimeHours(wh, row.weekName, !!dd.isCustomHoliday).toFixed(1),
        remark: ar,
        hasCustomRemark: hcr,
        hasViolation: false,
        slotV: Array.from({ length: 48 }, () => []),
        min24: '',
        min7: '',
        offBoardType: offType,
        slotOnBoard,
      });
    });

    const full = [...lb, ...cur];
    const viol = evaluateMLCWithLookback(full, lb.length);

    // 建立整段資料的前綴和，消除迴圈中大量的 slice() 與 filter() 記憶體配置，實現毫秒級即時點擊反應
    const prefixRest = new Int16Array(full.length + 1);
    for (let i = 0; i < full.length; i++) {
      prefixRest[i + 1] = prefixRest[i] + (full[i] === 1 ? 1 : 0);
    }

    drows.forEach((dr, di) => {
      // 若當日整天完全未在船，各欄位維持空白，不計違規
      if (dr.offBoardType) {
        dr.min24 = '';
        dr.min7 = '';
        dr.workH = '';
        dr.otH = '';
        dr.remark = '';
        dr.hasViolation = false;
        dr.slotV = Array.from({ length: 48 }, () => []);
        return;
      }

      const st = di * 48;
      dr.slotV = viol.slice(st, st + 48);

      // 清除未在船格位的違規訊息
      for (let s = 0; s < 48; s++) {
        if (!dr.slotOnBoard[s]) {
          dr.slotV[s] = [];
        }
      }
      dr.hasViolation = dr.slotV.some(a => a.length > 0);

      // 當日格位於 full 陣列中的真實起始索引（必須計入上月回推 lb.length）
      const dayStart = lb.length + di * 48;

      let minRest24 = 24.0;
      // 掃描涵蓋當日的所有 24 小時（48 格）視窗：依「最多兩段合計」計算各 24h 視窗之有效休息時數
      const k24Min = Math.max(0, dayStart - 47);
      const k24Max = Math.min(full.length - 48, dayStart + 47);
      for (let k = k24Min; k <= k24Max; k++) {
        const { top2Sum } = get24hRestPeriods(full, k);
        if (top2Sum < minRest24) minRest24 = top2Sum;
      }
      dr.min24 = minRest24.toFixed(1);

      let minSlots7 = 336;
      // 掃描涵蓋當日的所有 7 天（336 格）視窗：以 O(1) 前綴和快速計算
      const k7Min = Math.max(0, dayStart - 335);
      const k7Max = Math.min(full.length - 336, dayStart + 47);
      for (let k = k7Min; k <= k7Max; k++) {
        const rSlots = prefixRest[k + 336] - prefixRest[k];
        if (rSlots < minSlots7) minSlots7 = rSlots;
      }
      dr.min7 = (minSlots7 * 0.5).toFixed(1);
    });

    return drows;
  }, [sim, rows, dailyData, allCrewOverrides, selYear, selMonth]);

  const totalWorkHours = useMemo(() => {
    return crewData.reduce((acc, dr) => acc + (dr.workH ? parseFloat(dr.workH) : 0), 0);
  }, [crewData]);

  const totalOtHours = useMemo(() => {
    return crewData.reduce((acc, dr) => acc + (dr.otH ? parseFloat(dr.otH) : 0), 0);
  }, [crewData]);

  const totalMin24 = useMemo(() => {
    return crewData.reduce((acc, dr) => acc + (dr.min24 ? parseFloat(dr.min24) : 0), 0);
  }, [crewData]);

  const totalMin7 = useMemo(() => {
    return crewData.reduce((acc, dr) => acc + (dr.min7 ? parseFloat(dr.min7) : 0), 0);
  }, [crewData]);

  const saveAll = () => {
    localStorage.setItem(aoKey, JSON.stringify(allCrewOverrides));
    showToast(`【儲存成功】${selYear} 年 ${selMonth} 月全船自訂狀態已保存！`);
  };

  const resetAll = () => {
    if (!window.confirm('確定要清除全船所有人員的自訂微調？')) return;
    localStorage.removeItem(aoKey);
    setAllCrewOverrides({});
    showToast('已清除！');
  };

  const chgRemark = (cid: string, rk: string, txt: string) => {
    const def = dailyData[rk]?.remark || '';
    setAllCrewOverrides(prev => {
      const tc = prev[cid] || { slots: {}, remarks: {} };
      const nr = { ...(tc.remarks || {}) };
      if (txt === def) {
        delete nr[rk];
      } else {
        nr[rk] = txt;
      }
      return { ...prev, [cid]: { ...tc, remarks: nr } };
    });
  };

  const cycleSlot = (
    rk: string,
    si: number,
    cur: string | null,
    base: string | null,
  ) => {
    if (!sim) return;
    const i = C_STATUS_CYCLE.indexOf(cur);
    const nc = C_STATUS_CYCLE[(i + 1) % C_STATUS_CYCLE.length];

    setAllCrewOverrides(prev => {
      const tc = prev[sim.id] || { slots: {}, remarks: {} };
      const cs = tc.slots || {};
      const cd: Record<number, string | null> = cs[rk] ? { ...cs[rk] } : {};
      if (nc === base) {
        delete cd[si];
      } else {
        cd[si] = nc;
      }
      if (!Object.keys(cd).length) {
        const ns = { ...cs };
        delete ns[rk];
        return { ...prev, [sim.id]: { ...tc, slots: ns } };
      }
      return { ...prev, [sim.id]: { ...tc, slots: { ...cs, [rk]: cd } } };
    });
  };

  const cancelSlot = (
    rk: string,
    si: number,
    cur: string | null,
    base: string | null,
    isCustom: boolean,
  ) => {
    if (!sim) return;

    setAllCrewOverrides(prev => {
      const tc = prev[sim.id] || { slots: {}, remarks: {} };
      const cs = tc.slots || {};
      const cd: Record<number, string | null> = cs[rk] ? { ...cs[rk] } : {};

      if (isCustom) {
        // 若此格已有自訂微調，右鍵取消即恢復為原始排班 base
        delete cd[si];
      } else {
        // 若尚未自訂：若當前有工時，右鍵取消即設為休息 null
        if (cur !== null) {
          cd[si] = null;
        }
      }

      if (!Object.keys(cd).length) {
        const ns = { ...cs };
        delete ns[rk];
        return { ...prev, [sim.id]: { ...tc, slots: ns } };
      }
      return { ...prev, [sim.id]: { ...tc, slots: { ...cs, [rk]: cd } } };
    });
  };

  const updDeck = (rk: string, f: 'deckRestAm' | 'deckRestPm', v: boolean) => {
    setDailyData(prev => ({
      ...prev,
      [rk]: { ...(prev[rk] || emptyDay()), [f]: v },
    }));
  };

  const hhov = hoverSlot !== null ? Math.floor(hoverSlot / 2) : null;

  return (
    <div className="min-h-screen p-3 sm:p-4 font-sans bg-slate-50/60 w-full max-w-full space-y-3">
      {/* Header */}
      <header className="bg-white border border-slate-200 rounded-xl shadow-xs px-3.5 sm:px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Part C
          </span>
          <span className="text-slate-900 font-bold text-sm sm:text-base tracking-wide">
            船員休息時數表 | {selYear} 年 {selMonth} 月
          </span>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {/* 1. 清除自訂 (Rose Warning Outline) */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetAll}
            className="border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-semibold shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5 text-rose-600" />
            <span>清除自訂</span>
          </Button>

          {/* 2. 儲存自訂 (Emerald Save) */}
          <Button
            size="sm"
            onClick={saveAll}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
          >
            <Save className="size-3.5" />
            <span>儲存自訂</span>
          </Button>

          {/* 3. 列印加班時數表 */}
          <Button
            size="sm"
            onClick={() => setShowPrintOtModal(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="size-3.5" />
            <span>列印加班時數表</span>
          </Button>

          {/* 4. 列印船員休息時數紀錄表 */}
          <Button
            size="sm"
            onClick={() => setShowPrintModal(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="size-3.5" />
            <span>列印船員休息時數紀錄表</span>
          </Button>
        </div>
      </header>

      {/* Crew Overview Bar */}
      <section className="relative bg-white border border-slate-200 rounded-xl shadow-xs p-3.5 pt-4 text-xs">
        <span className="absolute -top-2.5 left-4 bg-gradient-to-r from-slate-900 to-slate-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded shadow-xs tracking-wider">
          船員工時與 MLC 狀態
        </span>
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">📊 船員切換清單</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              (點擊切換檢視個別船員；鉛筆圖示代表有手動自訂)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              符合規章: {crewList.filter(c => !deficits[c.id]?.hasDeficit).length} 人
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              ⚠️ 違規: {crewList.filter(c => deficits[c.id]?.hasDeficit).length} 人
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {crewList.map(c => {
            const stat = deficits[c.id] || { hasDeficit: false, hasCustomTrace: false };
            const isSel = c.id === selCrew;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelCrew(c.id)}
                className={cn(
                  'relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs',
                  isSel
                    ? 'ring-2 ring-blue-600 ring-offset-1 shadow-xs scale-[1.03]'
                    : 'hover:brightness-95 hover:scale-[1.01]',
                  stat.hasDeficit
                    ? 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100',
                )}
              >
                <span>
                  {c.rank} {c.name || c.engName || '未命名'}
                </span>
                {stat.hasCustomTrace && (
                  <span className="text-[11px] leading-none" title="已有手動微調">✏️</span>
                )}
                {stat.hasDeficit && (
                  <span className="text-rose-600 font-black text-xs leading-none ml-0.5">⚠️</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Crew Monthly Summary */}
        {sim && (
          <div className="mt-3 flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs bg-slate-100/80 border border-slate-200 rounded-lg px-3 py-1.5">
            <span className="font-bold text-slate-800">
              當前船員：<span className="text-blue-700 font-extrabold">{sim.rank} {sim.name || sim.engName || '未命名'}</span>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-slate-600">
              當月總工時：<strong className="font-mono text-slate-900 font-bold">{totalWorkHours.toFixed(1)}</strong> 小時
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-slate-600">
              當月超時工時：<strong className="font-mono text-amber-700 font-bold">{totalOtHours.toFixed(1)}</strong> 小時
            </span>
          </div>
        )}
      </section>

      {/* Main Table */}
      <main
        className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto w-full"
        onMouseLeave={() => {
          setHoverRow(null);
          setHoverSlot(null);
        }}
      >
        <table className="w-full min-w-[1550px] text-center border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold h-8">
              <th rowSpan={2} className="w-10 border-r border-slate-300 text-xs">
                星期
              </th>
              <th
                colSpan={2}
                className="w-14 border-r border-slate-300 bg-sky-50 text-blue-950 font-black text-xs"
              >
                甲板休息日
              </th>
              <th rowSpan={2} className="w-10 border-r border-slate-300 text-xs">
                日期
              </th>
              {Array.from({ length: 24 }, (_, i) => (
                <th
                  key={i}
                  colSpan={2}
                  className={cn(
                    'border-r border-slate-300 font-mono text-xs',
                    hhov === i
                      ? 'bg-blue-800 text-white font-black'
                      : 'bg-slate-50 text-slate-800 font-extrabold',
                  )}
                >
                  {String(i).padStart(2, '0')}
                </th>
              ))}
              <th rowSpan={2} className="w-20 border-r border-slate-300 text-xs">
                24h工時
              </th>
              <th
                rowSpan={2}
                className="w-16 border-r border-slate-300 text-xs cursor-help"
                title="超時工時計算規則：&#10;• 週日與國定假日：有工作全額計入超時工時&#10;• 週六：超過 4 小時之部分計為超時工時&#10;• 平日（週一至週五）：超過 8 小時之部分計為超時工時"
              >
                超時工時
              </th>
              <th rowSpan={2} className="w-20 border-r border-slate-300 text-xs">
                任意24h休息
              </th>
              <th rowSpan={2} className="w-20 border-r border-slate-300 text-xs">
                任意7天休息
              </th>
              <th rowSpan={2} className="w-40 border-r border-slate-300 text-xs">
                說明
              </th>
            </tr>
            <tr className="bg-slate-100 border-b border-slate-300 h-6 text-xs">
              <th className="w-7 border-r border-slate-300 bg-sky-100/60 text-slate-700">上</th>
              <th className="w-7 border-r border-slate-300 bg-sky-100/60 text-slate-700">下</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {crewData.map(dr => {
              const iHol = dr.isWeekend || dr.isCustomHoliday;
              const iRH = hoverRow === dr.rowKey;
              const b24 = dr.min24 !== '' && parseFloat(dr.min24) < 10;
              const b7 = dr.min7 !== '' && parseFloat(dr.min7) < 77;
              const isOff = !!dr.offBoardType;

              return (
                <tr
                  key={dr.rowKey}
                  className={cn(
                    'h-1 transition-colors duration-75',
                    isOff
                      ? 'bg-slate-100/50 text-slate-400'
                      : iRH
                        ? 'bg-blue-100/70'
                        : iHol
                          ? 'bg-rose-50/40'
                          : 'hover:bg-slate-50',
                  )}
                >
                  <td
                    className={cn(
                      'border-r border-slate-300 font-bold text-xs',
                      isOff ? 'text-slate-400' : iHol ? 'text-rose-600' : 'text-slate-700',
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-0.5">
                      {dr.weekName}
                      {dr.isCustomHoliday && (
                        <span
                          className="text-[9px] px-1 py-0 rounded bg-rose-100 text-rose-700 border border-rose-300 font-bold leading-tight"
                          title="國定假日（有工作全額計入超時工時）"
                        >
                          假
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="border-r border-slate-300 p-0 text-center w-7 bg-sky-50/20">
                    <input
                      type="checkbox"
                      disabled={isOff}
                      checked={dr.deckRestAm}
                      onChange={e => updDeck(dr.rowKey, 'deckRestAm', e.target.checked)}
                      className={cn("w-3.5 h-3.5 rounded text-blue-600", isOff ? "cursor-not-allowed opacity-30" : "cursor-pointer")}
                    />
                  </td>
                  <td className="border-r border-slate-300 p-0 text-center w-7 bg-sky-50/20">
                    <input
                      type="checkbox"
                      disabled={isOff}
                      checked={dr.deckRestPm}
                      onChange={e => updDeck(dr.rowKey, 'deckRestPm', e.target.checked)}
                      className={cn("w-3.5 h-3.5 rounded text-blue-600", isOff ? "cursor-not-allowed opacity-30" : "cursor-pointer")}
                    />
                  </td>
                  <td
                    className={cn(
                      'border-r border-slate-300 font-mono text-[11px] font-extrabold px-0.5',
                      isOff ? 'text-slate-400' : iHol ? 'text-rose-600' : 'text-slate-800',
                    )}
                  >
                    {dr.displayLabel}
                    {dr.dateSuffix}
                  </td>
                  {Array.from({ length: 48 }, (_, s) => {
                    const onBoard = dr.slotOnBoard[s];
                    const code = dr.final[s];
                    const base = dr.base[s];
                    const isW = !!code;
                    const isC = dr.isCustom[s];
                    const se = dr.slotV[s] || [];
                    const hasE = se.length > 0;
                    const isCH = hoverSlot === s;
                    const isCenter = iRH && isCH;
                    const st = STATUS_DEFINITIONS.find(x => x.code === code) || {
                      color: 'bg-slate-50 text-slate-300',
                      name: code,
                    };

                    let tip = '';
                    if (!onBoard) {
                      tip = dr.offBoardType === 'BEFORE_SIGN_ON' || (sim?.hasSignOn && s < 24)
                        ? '上船前 (未在船)'
                        : '下船後 (已離船)';
                    } else {
                      tip = [
                        code ? `狀態: ${st.name || code}` : '狀態: 休息',
                        hasE ? `⚠️ ${Array.from(new Set(se)).join(', ')}` : '',
                      ]
                        .filter(Boolean)
                        .join('\n');
                    }

                    return (
                      <td
                        key={s}
                        title={tip}
                        onClick={() => {
                          if (!onBoard) return;
                          cycleSlot(dr.rowKey, s, code, base);
                        }}
                        onContextMenu={e => {
                          e.preventDefault();
                          if (!onBoard) return;
                          cancelSlot(dr.rowKey, s, code, base, isC);
                        }}
                        onMouseEnter={() => {
                          setHoverRow(dr.rowKey);
                          setHoverSlot(s);
                        }}
                        className={cn(
                          'p-0 text-[10px] font-black select-none relative h-4 w-3.5 transition-all duration-75',
                          !onBoard
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : isW
                              ? cn(st.color, 'cursor-pointer')
                              : 'bg-slate-50 text-slate-300 cursor-pointer',
                          isCenter && onBoard
                            ? 'ring-2 ring-blue-700 z-20 brightness-95'
                            : iRH || isCH
                              ? 'brightness-95 bg-blue-50/50'
                              : '',
                          s % 2 === 1
                            ? 'border-r border-slate-300'
                            : 'border-r border-slate-200/50',
                        )}
                      >
                        {hasE && (
                          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-red-600 pointer-events-none z-10" />
                        )}
                        {isC && onBoard && (
                          <span className="absolute -top-1 -right-1 text-[6px] pointer-events-none">
                            ✏️
                          </span>
                        )}
                        <span className="leading-none">{code || ''}</span>
                      </td>
                    );
                  })}
                  <td className="border-r border-slate-300 font-mono font-bold text-slate-800 text-xs">
                    {dr.workH}
                  </td>
                  <td className="border-r border-slate-300 font-mono font-bold text-amber-700 text-xs">
                    {dr.otH}
                  </td>
                  <td
                    className={cn(
                      'border-r border-slate-300 font-mono font-bold text-xs cursor-help',
                      b24 ? 'text-red-600 bg-red-50' : 'text-blue-900 bg-blue-50/30',
                    )}
                  >
                    {dr.min24}
                  </td>
                  <td
                    className={cn(
                      'border-r border-slate-300 font-mono font-bold text-xs cursor-help',
                      b7 ? 'text-red-600 bg-red-50' : 'text-indigo-900 bg-indigo-50/30',
                    )}
                  >
                    {dr.min7}
                  </td>
                  <td className="border-r border-slate-300 px-1 relative">
                    <input
                      type="text"
                      placeholder={isOff ? '' : '說明'}
                      disabled={isOff}
                      value={dr.remark}
                      onChange={e => sim && chgRemark(sim.id, dr.rowKey, e.target.value)}
                      className={cn(
                        "w-full bg-transparent border-none text-xs px-1 py-0 rounded outline-none",
                        isOff ? "cursor-not-allowed text-slate-300" : "focus:bg-white focus:ring-1 focus:ring-blue-400"
                      )}
                    />
                    {dr.hasCustomRemark && !isOff && (
                      <span className="absolute top-0 right-1 text-[9px] text-blue-600 pointer-events-none">
                        ✏️
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-xs">
            <tr className="h-8">
              <td colSpan={4} className="border-r border-slate-300 text-center font-extrabold text-slate-800 bg-slate-200/60">
                當月合計
              </td>
              <td colSpan={48} className="border-r border-slate-300 text-slate-400 font-normal">
                -
              </td>
              <td className="border-r border-slate-300 font-mono font-black text-slate-900 bg-slate-200/40">
                {totalWorkHours.toFixed(1)}
              </td>
              <td className="border-r border-slate-300 font-mono font-black text-amber-700 bg-amber-50">
                {totalOtHours.toFixed(1)}
              </td>
              <td
                className="border-r border-slate-300 font-mono font-black text-blue-900 bg-blue-50/50"
                title={`當月任意 24h 休息加總：${totalMin24.toFixed(1)} 小時`}
              >
                {totalMin24.toFixed(1)}
              </td>
              <td
                className="border-r border-slate-300 font-mono font-black text-indigo-900 bg-indigo-50/50"
                title={`當月任意 7 天休息加總：${totalMin7.toFixed(1)} 小時`}
              >
                {totalMin7.toFixed(1)}
              </td>
              <td className="border-r border-slate-300 text-slate-400 font-normal">-</td>
            </tr>
          </tfoot>
        </table>
      </main>

      {/* 列印船員休息時數紀錄表 (Appendix 98 雙面列印) 模態框 */}
      <PrintRestHoursModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        selYear={selYear}
        selMonth={selMonth}
        crewList={crewList}
        selectedCrewId={selCrew}
        dailyData={dailyData}
        allCrewOverrides={allCrewOverrides}
      />

      {/* 列印加班時數表模態框 */}
      {showPrintOtModal && (
        <PrintOvertimeModal
          selYear={selYear}
          selMonth={selMonth}
          crewList={crewList}
          dailyData={dailyData}
          allCrewOverrides={allCrewOverrides}
          onClose={() => setShowPrintOtModal(false)}
        />
      )}
    </div>
  );
};
