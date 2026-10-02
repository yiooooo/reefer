import React, { useState, useMemo } from 'react';
import { Anchor, Save, Clock, HelpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { CrewMember, DayData, GroupDef } from '../../types/restHours';
import { STATUS_DEFINITIONS, B_STATUS_CYCLE, emptyDay } from '../../utils/restHoursData';
import {
  buildDisplayRows,
  getDaysInMonth,
  parseTimeToSlot,
  appendRemark,
} from '../../utils/restHoursUtils';
import { useToast } from '../../context/ToastContext';

interface PartBProps {
  selYear: string;
  selMonth: string;
  crewList: CrewMember[];
  groupDefinitions: GroupDef[];
  dailyData: Record<string, DayData>;
  setDailyData: React.Dispatch<React.SetStateAction<Record<string, DayData>>>;
  onBackToA: () => void;
  onGoToC: () => void;
}

export const PartB: React.FC<PartBProps> = ({
  selYear,
  selMonth,
  crewList,
  groupDefinitions = [],
  dailyData,
  setDailyData,
  onBackToA,
  onGoToC,
}) => {
  const { showToast } = useToast();
  const daysInMonth = getDaysInMonth(selYear, selMonth);
  const storageKey = `vessel_schedule_${selYear}${selMonth}`;

  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [wizOpen, setWizOpen] = useState(false);

  const [ev, setEv] = useState({
    date: `${selYear}-${selMonth}-01`,
    startTime: '2200',
    endTime: '0300',
    code: 'P',
    targetGroup: '',
    remark: '',
  });

  const [wiz, setWiz] = useState({
    portName: 'KHH',
    arrDate: `${selYear}-${selMonth}-01`,
    arrTugAssist: '2212',
    arrFWE: '2238',
    depDate: `${selYear}-${selMonth}-02`,
    depTugAssist: '0311',
    depTugLeft: '0342',
  });

  const rows = useMemo(
    () => buildDisplayRows(dailyData, daysInMonth, selYear, selMonth),
    [dailyData, daysInMonth, selYear, selMonth],
  );

  const applySlots = (
    ds: string,
    ss: number,
    es: number,
    code: string,
    targetGroup: string = '',
    remark: string | null = null,
  ) => {
    const p = ds.split('-').map(Number);
    if (p.length < 3) return;
    const [y, m, d] = p;
    if (y !== parseInt(selYear) || m !== parseInt(selMonth)) return;
    const rk = `day_${d}`;
    setDailyData(prev => {
      const td = prev[rk] ?? emptyDay();
      const ns = [...td.slots];
      const nso = { ...(td.slotGroupOverrides ?? {}) };
      for (let i = ss; i < Math.min(es, 48); i++) {
        if (targetGroup) {
          const cur = { ...(nso[i] ?? {}) };
          cur[targetGroup] = code;
          nso[i] = cur;
        } else {
          ns[i] = code;
        }
      }
      const mr = remark !== null ? appendRemark(td.remark, remark) : td.remark;
      return { ...prev, [rk]: { ...td, slots: ns, slotGroupOverrides: nso, remark: mr } };
    });
  };

  const handleRemoveGroupOverride = (
    rowKey: string,
    slotIdx: number,
    groupId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    setDailyData(prev => {
      const targetDay = prev[rowKey];
      if (!targetDay || !targetDay.slotGroupOverrides) return prev;

      const newSlotGroupOverrides = { ...targetDay.slotGroupOverrides };
      if (newSlotGroupOverrides[slotIdx] && newSlotGroupOverrides[slotIdx][groupId]) {
        const curSlot = { ...newSlotGroupOverrides[slotIdx] };
        delete curSlot[groupId];

        if (Object.keys(curSlot).length === 0) {
          delete newSlotGroupOverrides[slotIdx];
        } else {
          newSlotGroupOverrides[slotIdx] = curSlot;
        }

        return {
          ...prev,
          [rowKey]: {
            ...targetDay,
            slotGroupOverrides: newSlotGroupOverrides,
          },
        };
      }
      return prev;
    });
  };

  const applyEv = () => {
    const s = parseTimeToSlot(ev.startTime, 'start');
    const e = parseTimeToSlot(ev.endTime, 'end');
    if (e > s) {
      applySlots(ev.date, s, e, ev.code, ev.targetGroup, ev.remark);
    } else {
      applySlots(ev.date, s, 48, ev.code, ev.targetGroup, ev.remark);
      const nd = new Date(ev.date);
      nd.setDate(nd.getDate() + 1);
      applySlots(nd.toISOString().split('T')[0], 0, e, ev.code, ev.targetGroup, ev.remark);
    }
  };

  const applyWiz = () => {
    const aS = parseTimeToSlot(wiz.arrTugAssist, 'start');
    const aE = parseTimeToSlot(wiz.arrFWE, 'end');
    const dS = parseTimeToSlot(wiz.depTugAssist, 'start');
    const dE = parseTimeToSlot(wiz.depTugLeft, 'end');
    const port = wiz.portName.trim().toUpperCase();

    if (wiz.arrDate === wiz.depDate) {
      setDailyData(prev => {
        const d = parseInt(wiz.arrDate.split('-')[2]);
        const rk = `day_${d}`;
        const td = prev[rk] ?? emptyDay();
        const ns = [...td.slots];
        for (let i = aS; i < Math.min(aE, 48); i++) ns[i] = 'W';
        for (let i = aE; i < Math.min(dS, 48); i++) ns[i] = 'P';
        for (let i = dS; i < Math.min(dE, 48); i++) ns[i] = 'W';
        return {
          ...prev,
          [rk]: { ...td, slots: ns, remark: appendRemark(td.remark, `${port} arr&dep`) },
        };
      });
    } else {
      setDailyData(prev => {
        const d = parseInt(wiz.arrDate.split('-')[2]);
        const rk = `day_${d}`;
        const td = prev[rk] ?? emptyDay();
        const ns = [...td.slots];
        for (let i = aS; i < Math.min(aE, 48); i++) ns[i] = 'W';
        for (let i = aE; i < 48; i++) ns[i] = 'P';
        return {
          ...prev,
          [rk]: { ...td, slots: ns, remark: appendRemark(td.remark, `${port} arr`) },
        };
      });
      const s0 = parseInt(wiz.arrDate.split('-')[2]);
      const e0 = parseInt(wiz.depDate.split('-')[2]);
      for (let mid = s0 + 1; mid < e0; mid++) {
        applySlots(`${selYear}-${selMonth}-${String(mid).padStart(2, '0')}`, 0, 48, 'P', null);
      }
      setDailyData(prev => {
        const d = parseInt(wiz.depDate.split('-')[2]);
        const rk = `day_${d}`;
        const td = prev[rk] ?? emptyDay();
        const ns = [...td.slots];
        for (let i = 0; i < Math.min(dS, 48); i++) ns[i] = 'P';
        for (let i = dS; i < Math.min(dE, 48); i++) ns[i] = 'W';
        return {
          ...prev,
          [rk]: { ...td, slots: ns, remark: appendRemark(td.remark, `${port} dep`) },
        };
      });
    }
    setWizOpen(false);
  };

  const clickCell = (rk: string, si: number) => {
    const td = dailyData[rk] ?? emptyDay();
    const cur = td.slots[si] || 'N';
    const ci = B_STATUS_CYCLE.indexOf(cur);
    const nc = B_STATUS_CYCLE[(ci + 1) % B_STATUS_CYCLE.length];
    setDailyData(prev => ({
      ...prev,
      [rk]: { ...td, slots: td.slots.map((s, i) => (i === si ? nc : s)) },
    }));
  };

  const cancelCell = (rk: string, si: number) => {
    setDailyData(prev => {
      const td = prev[rk] ?? emptyDay();
      const newSlots = td.slots.map((s, i) => (i === si ? 'N' : s));
      const newSgo = { ...(td.slotGroupOverrides ?? {}) };
      if (newSgo[si]) {
        delete newSgo[si];
      }
      return {
        ...prev,
        [rk]: { ...td, slots: newSlots, slotGroupOverrides: newSgo },
      };
    });
  };

  const hhov = hoverSlot !== null ? Math.floor(hoverSlot / 2) : null;

  return (
    <div className="min-h-screen p-3 sm:p-4 font-sans bg-slate-50/60 w-full max-w-full space-y-3">
      <header className="bg-white border border-slate-200 rounded-xl shadow-xs px-3.5 sm:px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Part B
          </span>
          <span className="text-slate-900 font-bold text-sm sm:text-base tracking-wide">
            船舶工作時間事件表 | {selYear} 年 {selMonth} 月
          </span>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {/* 靠離港精靈 (Amber Tool) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWizOpen(true)}
            className="border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-semibold shadow-xs cursor-pointer"
          >
            <Anchor className="size-3.5 text-amber-700" />
            <span>靠離港精靈</span>
          </Button>

          {/* 儲存事件表 (Emerald Save) */}
          <Button
            size="sm"
            onClick={() => {
              localStorage.setItem(storageKey, JSON.stringify(dailyData));
              showToast('【儲存成功】船舶工作時間事件表已儲存！');
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
          >
            <Save className="size-3.5" />
            <span>儲存事件表</span>
          </Button>
        </div>
      </header>

      {/* 快速填入列 */}
      <section className="relative bg-white border border-slate-200 rounded-xl shadow-xs p-3.5 pt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <span className="absolute -top-2.5 left-4 bg-gradient-to-r from-slate-900 to-slate-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded shadow-xs tracking-wider">
          時間區段快速填入
        </span>
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-bold text-slate-700 inline-flex items-center gap-1">
            <Clock className="size-3.5 text-slate-500" />
            時間設定：
          </span>
          <Input
            type="date"
            value={ev.date}
            onChange={e => setEv({ ...ev, date: e.target.value })}
            className="h-7 w-32 px-1.5 py-0 text-xs font-mono bg-slate-50 border-slate-300"
          />
          <Input
            type="text"
            placeholder="2200"
            value={ev.startTime}
            onChange={e => setEv({ ...ev, startTime: e.target.value })}
            className="h-7 w-16 px-1 py-0 text-center font-mono text-xs bg-slate-50 border-slate-300"
          />
          <span className="text-slate-400">~</span>
          <Input
            type="text"
            placeholder="0300"
            value={ev.endTime}
            onChange={e => setEv({ ...ev, endTime: e.target.value })}
            className="h-7 w-16 px-1 py-0 text-center font-mono text-xs bg-slate-50 border-slate-300"
          />
          <Select value={ev.code} onValueChange={v => setEv({ ...ev, code: v })}>
            <SelectTrigger className="h-7 w-32 font-bold bg-slate-50 border-slate-300 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_DEFINITIONS.map(st => (
                <SelectItem key={st.code} value={st.code} className="text-xs">
                  {st.code}: {st.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 群組下拉選單 */}
          <div className="flex items-center space-x-1">
            <span className="font-semibold text-slate-600 whitespace-nowrap">群組:</span>
            <Select
              value={ev.targetGroup || 'ALL_CREW'}
              onValueChange={v => setEv({ ...ev, targetGroup: v === 'ALL_CREW' ? '' : v })}
            >
              <SelectTrigger className="h-7 font-bold bg-slate-50 border-slate-300 text-xs text-blue-900 min-w-[90px]">
                <SelectValue placeholder="選擇群組" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_CREW" className="text-xs text-slate-500 font-semibold">
                  (無群組/全體)
                </SelectItem>
                {groupDefinitions.map(g => (
                  <SelectItem key={g.id} value={g.id} className="text-xs font-bold">
                    [{g.code}] {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="text"
            placeholder="說明"
            value={ev.remark}
            onChange={e => setEv({ ...ev, remark: e.target.value })}
            className="h-7 w-28 px-2 py-0 bg-slate-50 border-slate-300 text-xs"
          />
          <Button
            size="xs"
            onClick={applyEv}
            className="h-7 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs cursor-pointer"
          >
            套用
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
          {STATUS_DEFINITIONS.map(st => (
            <span key={st.code} className={`px-2 py-0.5 rounded-md border shadow-2xs ${st.color}`}>
              {st.code}:{st.name}
            </span>
          ))}
        </div>
      </section>

      {/* 靠離港精靈 Dialog */}
      <Dialog open={wizOpen} onOpenChange={setWizOpen}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>⚓ 靠離港排程精靈</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 text-xs">
            <div>
              <label className="font-bold block mb-1">港口代碼:</label>
              <Input
                type="text"
                value={wiz.portName}
                onChange={e => setWiz({ ...wiz, portName: e.target.value })}
                className="h-8 w-full font-bold uppercase bg-white"
              />
            </div>
            <div className="border border-slate-200 p-3 rounded bg-slate-50">
              <div className="font-bold text-rose-800 mb-2">📥 靠港 (Inward)</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] mb-0.5">靠港日期:</label>
                  <Input
                    type="date"
                    value={wiz.arrDate}
                    onChange={e => setWiz({ ...wiz, arrDate: e.target.value })}
                    className="h-8 w-full bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-0.5">Tug Assist:</label>
                  <Input
                    type="text"
                    value={wiz.arrTugAssist}
                    onChange={e => setWiz({ ...wiz, arrTugAssist: e.target.value })}
                    className="h-8 w-full font-mono text-center bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-0.5">FWE:</label>
                  <Input
                    type="text"
                    value={wiz.arrFWE}
                    onChange={e => setWiz({ ...wiz, arrFWE: e.target.value })}
                    className="h-8 w-full font-mono text-center bg-white"
                  />
                </div>
              </div>
            </div>
            <div className="border border-slate-200 p-3 rounded bg-slate-50">
              <div className="font-bold text-blue-800 mb-2">📤 離港 (Outward)</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] mb-0.5">離港日期:</label>
                  <Input
                    type="date"
                    value={wiz.depDate}
                    onChange={e => setWiz({ ...wiz, depDate: e.target.value })}
                    className="h-8 w-full bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-0.5">Tug Assist:</label>
                  <Input
                    type="text"
                    value={wiz.depTugAssist}
                    onChange={e => setWiz({ ...wiz, depTugAssist: e.target.value })}
                    className="h-8 w-full font-mono text-center bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-0.5">Tug Left:</label>
                  <Input
                    type="text"
                    value={wiz.depTugLeft}
                    onChange={e => setWiz({ ...wiz, depTugLeft: e.target.value })}
                    className="h-8 w-full font-mono text-center bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWizOpen(false)}>
              取消
            </Button>
            <Button
              onClick={applyWiz}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
            >
              套用精靈設定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 主表格 */}
      <main
        className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto w-full"
        onMouseLeave={() => {
          setHoverRow(null);
          setHoverSlot(null);
        }}
      >
        <table className="w-full min-w-[1450px] text-center border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold h-8 text-xs">
              <th className="w-10 border-r border-slate-300">國定假</th>
              <th className="w-14 border-r border-slate-300">星期</th>
              <th className="w-24 border-r border-slate-300">日期</th>
              {Array.from({ length: 24 }, (_, h) => (
                <th
                  key={h}
                  colSpan={2}
                  className={`border-r border-slate-300 font-mono text-[11px] ${hhov === h ? 'bg-blue-800 text-white font-black' : 'bg-slate-50 text-slate-800'
                    }`}
                >
                  {String(h).padStart(2, '0')}
                </th>
              ))}
              <th className="w-40 border-r border-slate-300">說明</th>
              <th className="w-14 border-r border-slate-300">碼頭時數</th>
              <th className="w-20 border-r border-slate-300 relative text-center">
                <div
                  className="inline-flex items-center justify-center gap-1 group relative cursor-help"
                  title="撥快: +1 / 撥慢: -1"
                >
                  <span>撥鐘</span>
                  <HelpCircle className="size-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  {/* 滑入提示浮動視窗 */}
                  <div className="pointer-events-none invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 absolute top-full right-0 sm:left-1/2 sm:-translate-x-1/2 mt-1.5 z-50 w-36 p-2 bg-slate-900/95 backdrop-blur-xs text-white text-[11px] rounded-md shadow-xl text-left leading-normal border border-slate-700">
                    <div className="font-bold text-sky-300 pb-1 mb-1 border-b border-slate-700/80 flex items-center gap-1">
                      <Clock className="size-3 text-sky-400" />
                      <span>撥鐘說明</span>
                    </div>
                    <div className="space-y-1 text-slate-200">
                      <div className="flex items-center justify-between">
                        <span>撥快：</span>
                        <span className="font-mono font-bold bg-amber-500/20 text-amber-300 px-1 rounded border border-amber-500/30">+1</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>撥慢：</span>
                        <span className="font-mono font-bold bg-amber-500/20 text-amber-300 px-1 rounded border border-amber-500/30">-1</span>
                      </div>
                    </div>
                    <div className="absolute -top-1 right-3 sm:left-1/2 sm:-translate-x-1/2 border-4 border-transparent border-b-slate-900/95" />
                  </div>
                </div>
              </th>
              <th className="w-20 border-r border-slate-300">撥天</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(row => {
              const dd = dailyData[row.rowKey] ?? emptyDay();
              const isHol = row.isWeekend || dd.isCustomHoliday;
              const isRH = hoverRow === row.rowKey;
              const portH = (dd.slots.filter(s => s === 'P').length * 0.5).toFixed(1);
              return (
                <tr
                  key={row.rowKey}
                  className={`h-6 ${isRH ? 'bg-blue-100/70' : isHol ? 'bg-rose-50/30' : 'hover:bg-slate-50'
                    }`}
                >
                  <td className="border-r border-slate-300">
                    <input
                      type="checkbox"
                      checked={dd.isCustomHoliday}
                      onChange={e =>
                        setDailyData(prev => ({
                          ...prev,
                          [row.rowKey]: {
                            ...(prev[row.rowKey] ?? emptyDay()),
                            isCustomHoliday: e.target.checked,
                          },
                        }))
                      }
                      className="rounded text-rose-600 w-3.5 h-3.5"
                    />
                  </td>
                  <td
                    className={`border-r border-slate-300 font-bold text-xs ${isHol ? 'text-rose-600' : 'text-slate-700'
                      }`}
                  >
                    {row.weekName}
                  </td>
                  <td
                    className={`border-r border-slate-300 font-mono text-xs ${isHol ? 'text-rose-600 font-bold' : 'text-slate-700'
                      }`}
                  >
                    {selYear}/{Number(selMonth)}/{row.displayLabel}
                    {row.dateSuffix && (
                      <span className="ml-1 text-[10px] text-amber-700 font-black">
                        {row.dateSuffix}
                      </span>
                    )}
                  </td>
                  {Array.from({ length: 48 }, (_, s) => {
                    const code = dd.slots[s] || 'N';
                    const st = STATUS_DEFINITIONS.find(x => x.code === code) ?? STATUS_DEFINITIONS[0];
                    const slotOverrides = dd.slotGroupOverrides?.[s] ?? {};
                    const overriddenGroupIds = Object.keys(slotOverrides).slice(0, 3);
                    const isCH = hoverSlot === s;
                    const isCenter = isRH && isCH;
                    return (
                      <td
                        key={s}
                        onClick={() => clickCell(row.rowKey, s)}
                        onContextMenu={e => {
                          e.preventDefault();
                          cancelCell(row.rowKey, s);
                        }}
                        onMouseEnter={() => {
                          setHoverRow(row.rowKey);
                          setHoverSlot(s);
                        }}
                        className={`p-0 cursor-pointer font-extrabold font-mono text-[10px] select-none ${st.color
                          } ${isCenter
                            ? 'ring-2 ring-blue-700 z-20 brightness-95'
                            : isRH || isCH
                              ? 'brightness-95'
                              : ''
                          } ${s % 2 === 1
                            ? 'border-r border-slate-300'
                            : 'border-r border-slate-200/60'
                          }`}
                      >
                        <div className="flex flex-row items-center justify-center h-full px-[1px]">
                          {overriddenGroupIds.length > 0 && (
                            <div className="flex flex-col gap-[1px] mr-0.5 justify-center">
                              {overriddenGroupIds.map(gId => {
                                const gDef = groupDefinitions.find(g => g.id === gId);
                                if (!gDef) return null;
                                return (
                                  <span
                                    key={gId}
                                    onContextMenu={e => handleRemoveGroupOverride(row.rowKey, s, gId, e)}
                                    title={`${gDef.name}: ${slotOverrides[gId]} (右鍵移除)`}
                                    className={`inline-flex items-center justify-center w-[9px] h-[6.5px] rounded-[1.5px] border font-bold text-[5.5px] leading-none cursor-pointer shadow-xs hover:opacity-70 ${gDef.color}`}
                                  >
                                    {gDef.code}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <span className="text-[10px] leading-tight">{code}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="border-r border-slate-300 px-1 text-left">
                    <input
                      type="text"
                      value={dd.remark || ''}
                      onChange={e =>
                        setDailyData(prev => ({
                          ...prev,
                          [row.rowKey]: {
                            ...(prev[row.rowKey] ?? emptyDay()),
                            remark: e.target.value,
                          },
                        }))
                      }
                      className="w-full bg-transparent border-none text-xs px-0 py-0.5 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="border-r border-slate-300 font-mono font-bold text-xs">{portH}</td>
                  <td className="border-r border-slate-300 px-0.5">
                    <select
                      value={dd.clockAdjust || ''}
                      onChange={e =>
                        setDailyData(prev => ({
                          ...prev,
                          [row.rowKey]: {
                            ...(prev[row.rowKey] ?? emptyDay()),
                            clockAdjust: e.target.value,
                          },
                        }))
                      }
                      className="w-full text-[10px] font-bold rounded border py-0.5 px-0 text-center"
                    >
                      <option value=""></option>
                      <option value="+1">+1</option>
                      <option value="-1">-1</option>
                    </select>
                  </td>
                  <td className="border-r border-slate-300 px-0.5">
                    <select
                      value={dd.dayAdjust || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const rk = row.rowKey;
                        setDailyData(prev => {
                          const upd: Record<string, DayData> = {
                            ...prev,
                            [rk]: { ...(prev[rk] ?? emptyDay()), dayAdjust: val },
                          };
                          if (val === '-1' && !prev[`${rk}_repeat`]) upd[`${rk}_repeat`] = emptyDay();
                          return upd;
                        });
                      }}
                      className="w-full text-[10px] font-bold rounded border py-0.5 px-0"
                    >
                      <option value=""></option>
                      <option value="+1">+1</option>
                      <option value="-1">-1</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
    </div>
  );
};
