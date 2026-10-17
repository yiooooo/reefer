import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, Trash2, Ship, RefreshCw, Printer, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { CrewMember, GroupDef, ShipInfo, EngineCrewDutyType, ShiftChange, TimeShift } from '../../types/restHours';
import { HOURS, MINUTES, MANEUVERING_MODES, DEFAULT_SHIP_INFO, DEFAULT_CREW_LIST, DEFAULT_GROUP_DEFINITIONS } from '../../utils/restHoursData';
import { getShiftTheme, newCrewMember, getDaysInMonth } from '../../utils/restHoursUtils';
import { TimeSelect } from './TimeSelect';
import { useToast } from '../../context/ToastContext';

export type PresetKey = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'custom';

const PRESET_OPTIONS = [
  {
    key: 'p1' as const,
    title: '大副班（4-8 班）',
    timeText: '#1 04~08 ｜ #2 16~20',
    shifts: [
      { startHour: '04', startMin: '00', endHour: '08', endMin: '00' },
      { startHour: '16', startMin: '00', endHour: '20', endMin: '00' },
    ],
  },
  {
    key: 'p2' as const,
    title: '二副班（0~4 班）',
    timeText: '#1 00~04 ｜ #2 12~16',
    shifts: [
      { startHour: '00', startMin: '00', endHour: '04', endMin: '00' },
      { startHour: '12', startMin: '00', endHour: '16', endMin: '00' },
    ],
  },
  {
    key: 'p3' as const,
    title: '三副班（8-12 班）',
    timeText: '#1 08~12 ｜ #2 20~24',
    shifts: [
      { startHour: '08', startMin: '00', endHour: '12', endMin: '00' },
      { startHour: '20', startMin: '00', endHour: '24', endMin: '00' },
    ],
  },
  {
    key: 'p4' as const,
    title: '日班',
    timeText: '#1 08~12 ｜ #2 13.5~17.5',
    shifts: [
      { startHour: '08', startMin: '00', endHour: '12', endMin: '00' },
      { startHour: '13', startMin: '30', endHour: '17', endMin: '30' },
    ],
  },
  {
    key: 'p5' as const,
    title: '廚師班',
    timeText: '#1 06~08 ｜ #2 10~13 ｜ #3 15.5~18.5',
    shifts: [
      { startHour: '06', startMin: '00', endHour: '08', endMin: '00' },
      { startHour: '10', startMin: '00', endHour: '13', endMin: '00' },
      { startHour: '15', startMin: '30', endHour: '18', endMin: '30' },
    ],
  },
  {
    key: 'custom' as const,
    title: '其他（自訂調整）',
    timeText: '手動自訂 #1、#2 時間',
    shifts: [] as TimeShift[],
  },
];

interface PartAProps {
  selYear: string;
  selMonth: string;
  crewList: CrewMember[];
  setCrewList: React.Dispatch<React.SetStateAction<CrewMember[]>>;
  groupDefinitions: GroupDef[];
  setGroupDefinitions: React.Dispatch<React.SetStateAction<GroupDef[]>>;
  onGoToB: () => void;
}

export const PartA: React.FC<PartAProps> = ({
  selYear,
  selMonth,
  crewList,
  setCrewList,
  groupDefinitions,
  setGroupDefinitions,
  onGoToB,
}) => {
  const { showToast } = useToast();
  const storageKey = `rest_hours_${selYear}${selMonth}`;

  const [selIds, setSelIds] = useState<string[]>([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState<PresetKey>('p1');
  const [bs1, setBs1] = useState({ sH: '04', sM: '00', eH: '08', eM: '00' });
  const [bs2, setBs2] = useState({ sH: '16', sM: '00', eH: '20', eM: '00' });

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [canDragIdx, setCanDragIdx] = useState<number | null>(null);

  const [isEditingShipInfo, setIsEditingShipInfo] = useState(false);
  const [showGroupManagerModal, setShowGroupManagerModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFilterDate, setPrintFilterDate] = useState(`${selYear}-${selMonth}-01`);
  const [monthlyDayOneRow, setMonthlyDayOneRow] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('monthly_dayone_rows_exact') || '{}');
    } catch {
      return {};
    }
  });
  const [expandedCrewIds, setExpandedCrewIds] = useState<string[]>([]);

  const handlePrintPartA = () => {
    const origTitle = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  };

  const [shipInfo, setShipInfo] = useState<ShipInfo>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('ship_working_arrangement_info') || 'null') ??
        DEFAULT_SHIP_INFO
      );
    } catch {
      return DEFAULT_SHIP_INFO;
    }
  });

  const onboardCount = crewList.filter(c => !(c.hasSignOff && c.signOffDate !== '')).length;
  const offboardCount = crewList.filter(c => c.hasSignOff && c.signOffDate !== '').length;
  const totalCount = onboardCount + offboardCount;

  const calcDurationHours = (sh: string, sm: string, eh: string, em: string) => {
    let start = parseInt(sh, 10) + parseInt(sm, 10) / 60;
    let end = parseInt(eh, 10) + parseInt(em, 10) / 60;
    if (end < start) end += 24;
    return end - start;
  };

  const filteredPrintDeckCrew = crewList.filter(c => {
    if (c.hasSignOn && c.signOnDate) {
      if (printFilterDate < c.signOnDate) return false;
    }
    if (c.hasSignOff && c.signOffDate) {
      if (printFilterDate >= c.signOffDate) return false;
    }
    return true;
  });

  const masterCrew =
    crewList.find(c => c.rank.toUpperCase().includes('CAPT') || c.rank.toUpperCase().includes('MASTER')) ||
    crewList[0];
  const signerDisplay = masterCrew
    ? masterCrew.engName
      ? `${masterCrew.engName}`
      : masterCrew.name
    : '';

  const engRanks =
    shipInfo.engineersOnCallRanks && shipInfo.engineersOnCallRanks.length > 0
      ? shipInfo.engineersOnCallRanks
      : ['2E', '3E', '4/E'];
  const cycleLen = engRanks.length;
  const currentMonthKey = `${selYear}${selMonth}`;
  const rawStartRow =
    monthlyDayOneRow[currentMonthKey] !== undefined ? monthlyDayOneRow[currentMonthKey] : 0;
  const startRow = rawStartRow >= cycleLen ? 0 : rawStartRow;

  const handleSetDayOneRow = (rIdx: number) => {
    const updatedRows = { ...monthlyDayOneRow, [currentMonthKey]: rIdx };
    setMonthlyDayOneRow(updatedRows);
    localStorage.setItem('monthly_dayone_rows_exact', JSON.stringify(updatedRows));
  };

  const daysCount = getDaysInMonth(selYear, selMonth);
  const totalColsNeeded = Math.ceil((daysCount + startRow) / cycleLen);
  const matrix: (number | null)[][] = Array.from({ length: cycleLen }, () =>
    Array(totalColsNeeded).fill(null),
  );

  let curCol = 0;
  let curRow = startRow;

  for (let day = 1; day <= daysCount; day++) {
    if (curCol < totalColsNeeded) {
      matrix[curRow][curCol] = day;
    }
    curRow++;
    if (curRow >= cycleLen) {
      curRow = 0;
      curCol++;
    }
  }

  const handleSaveShipInfo = () => {
    localStorage.setItem('ship_working_arrangement_info', JSON.stringify(shipInfo));
    showToast('【儲存成功】船舶基本資訊與機艙輪值設定已儲存！');
    setIsEditingShipInfo(false);
  };

  const handleAddEngineCrew = () => {
    const newRank = window.prompt('請輸入新增的機艙職級 (例如: 4/E, MM):', '4/E');
    if (newRank?.trim()) {
      setShipInfo(prev => ({
        ...prev,
        engineCrewRoster: [
          ...prev.engineCrewRoster,
          { id: `ec_${Date.now()}`, rank: newRank.trim(), type: 'DAY_WORK' },
        ],
      }));
    }
  };

  const handleAddOnCallRank = () => {
    const newRank = window.prompt('請輸入要加入待命輪值的管輪職級 (如: 4/E):', '4/E');
    if (newRank?.trim()) {
      setShipInfo(prev => ({
        ...prev,
        engineersOnCallRanks: [...prev.engineersOnCallRanks, newRank.trim()],
      }));
    }
  };

  // ─── 群組設定儲存 ────────────────────────────────────────────────────────
  const handleSaveGroupDefinitions = () => {
    localStorage.setItem('custom_group_definitions_v2', JSON.stringify(groupDefinitions));
    showToast('【儲存成功】群組設定已儲存！');
    setShowGroupManagerModal(false);
  };

  // ─── 船員群組操作 ────────────────────────────────────────────────────────
  const handleAddGroupSlot = (crewId: string, targetShiftChangeId: string | null = null) => {
    setCrewList(prev =>
      prev.map(c => {
        if (c.id !== crewId) return c;

        const assignToGroups = (curGroups: string[]) => {
          if (curGroups.length >= 6) {
            showToast('每位船員最多隸屬 6 個群組！', 'error');
            return curGroups;
          }
          const available = groupDefinitions.filter(g => !curGroups.includes(g.id));
          if (available.length === 0) return curGroups;
          return [...curGroups, available[0].id];
        };

        if (targetShiftChangeId) {
          const updatedSC = (c.shiftChanges || []).map(sc => {
            if (sc.id !== targetShiftChangeId) return sc;
            return { ...sc, groups: assignToGroups(sc.groups || []) };
          });
          return { ...c, shiftChanges: updatedSC };
        } else {
          return { ...c, groups: assignToGroups(c.groups || []) };
        }
      }),
    );
  };

  const handleCycleGroupSlot = (
    crewId: string,
    groupIndex: number,
    targetShiftChangeId: string | null = null,
  ) => {
    setCrewList(prev =>
      prev.map(c => {
        if (c.id !== crewId) return c;

        const cycleGroups = (curGroups: string[]) => {
          const currentGId = curGroups[groupIndex];
          const otherGroups = curGroups.filter((_, idx) => idx !== groupIndex);
          const curIdxInDef = groupDefinitions.findIndex(g => g.id === currentGId);

          for (let i = 1; i <= groupDefinitions.length; i++) {
            const nextIdx = (curIdxInDef + i) % groupDefinitions.length;
            const candidate = groupDefinitions[nextIdx];
            if (!otherGroups.includes(candidate.id)) {
              const nextList = [...curGroups];
              nextList[groupIndex] = candidate.id;
              return nextList;
            }
          }
          return curGroups;
        };

        if (targetShiftChangeId) {
          const updatedSC = (c.shiftChanges || []).map(sc => {
            if (sc.id !== targetShiftChangeId) return sc;
            return { ...sc, groups: cycleGroups(sc.groups || []) };
          });
          return { ...c, shiftChanges: updatedSC };
        } else {
          return { ...c, groups: cycleGroups(c.groups || []) };
        }
      }),
    );
  };

  const handleRemoveGroupSlot = (
    crewId: string,
    groupIndex: number,
    e: React.MouseEvent,
    targetShiftChangeId: string | null = null,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setCrewList(prev =>
      prev.map(c => {
        if (c.id !== crewId) return c;

        const removeGroup = (curGroups: string[]) =>
          curGroups.filter((_, idx) => idx !== groupIndex);

        if (targetShiftChangeId) {
          const updatedSC = (c.shiftChanges || []).map(sc => {
            if (sc.id !== targetShiftChangeId) return sc;
            return { ...sc, groups: removeGroup(sc.groups || []) };
          });
          return { ...c, shiftChanges: updatedSC };
        } else {
          return { ...c, groups: removeGroup(c.groups || []) };
        }
      }),
    );
  };

  const renderGroupGrid = (
    groups: string[] = [],
    crewId: string,
    targetShiftChangeId: string | null = null,
  ) => {
    const col1 = groups.slice(0, 3);
    const col2 = groups.slice(3, 6);

    return (
      <div className="inline-flex items-center space-x-0.5">
        <div className="flex flex-col gap-0.5">
          {col1.map((gId, idx) => {
            const gDef = groupDefinitions.find(g => g.id === gId);
            if (!gDef) return null;
            const globalIdx = idx;
            return (
              <span
                key={gId + '_' + idx}
                onClick={e => {
                  e.stopPropagation();
                  handleCycleGroupSlot(crewId, globalIdx, targetShiftChangeId);
                }}
                onContextMenu={e =>
                  handleRemoveGroupSlot(crewId, globalIdx, e, targetShiftChangeId)
                }
                title={`${gDef.name} (左鍵切換 / 右鍵移除)`}
                className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border font-bold text-[8px] leading-tight cursor-pointer select-none shadow-xs hover:opacity-80 transition ${gDef.color}`}
              >
                {gDef.code}
              </span>
            );
          })}
        </div>

        <div className="flex flex-col gap-0.5">
          {col2.map((gId, idx) => {
            const gDef = groupDefinitions.find(g => g.id === gId);
            if (!gDef) return null;
            const globalIdx = idx + 3;
            return (
              <span
                key={gId + '_' + idx}
                onClick={e => {
                  e.stopPropagation();
                  handleCycleGroupSlot(crewId, globalIdx, targetShiftChangeId);
                }}
                onContextMenu={e =>
                  handleRemoveGroupSlot(crewId, globalIdx, e, targetShiftChangeId)
                }
                title={`${gDef.name} (左鍵切換 / 右鍵移除)`}
                className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border font-bold text-[8px] leading-tight cursor-pointer select-none shadow-xs hover:opacity-80 transition ${gDef.color}`}
              >
                {gDef.code}
              </span>
            );
          })}
        </div>

        {groups.length < 6 && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              handleAddGroupSlot(crewId, targetShiftChangeId);
            }}
            title="新增群組 (最多6組)"
            className="w-3.5 h-3.5 rounded-[3px] border border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-700 flex items-center justify-center text-[9px] font-bold"
          >
            ＋
          </button>
        )}
      </div>
    );
  };

  // ─── 換班設定操作 ────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedCrewIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const handleAddShiftChange = (crewId: string) => {
    setCrewList(prev =>
      prev.map(c => {
        if (c.id !== crewId) return c;
        const newShiftChange: ShiftChange = {
          id: 'sc_' + Date.now(),
          groups: [...(c.groups || [])],
          effectiveDate: `${selYear}-${selMonth}-11`,
          effectiveHour: '18',
          effectiveMin: '00',
          watchKeeping: c.watchKeeping,
          maneuveringMode: c.maneuveringMode || 'ALL',
          dutyShifts: JSON.parse(JSON.stringify(c.dutyShifts)),
          workingShifts: JSON.parse(JSON.stringify(c.workingShifts)),
        };
        return { ...c, shiftChanges: [...(c.shiftChanges || []), newShiftChange] };
      }),
    );
  };

  const handleUpdateShiftChange = (
    crewId: string,
    scId: string,
    field: keyof ShiftChange,
    value: unknown,
    subField: keyof TimeShift | null = null,
    subIdx: number | null = null,
  ) => {
    setCrewList(prev =>
      prev.map(c => {
        if (c.id !== crewId) return c;
        const newShiftChanges = (c.shiftChanges || []).map(sc => {
          if (sc.id !== scId) return sc;
          if (subField !== null && subIdx !== null) {
            const updatedArray = [...(sc[field] as TimeShift[])];
            updatedArray[subIdx] = { ...updatedArray[subIdx], [subField]: value as string };
            return { ...sc, [field]: updatedArray };
          }
          return { ...sc, [field]: value };
        });
        return { ...c, shiftChanges: newShiftChanges };
      }),
    );
  };

  const handleDeleteShiftChange = (crewId: string, scId: string) => {
    setCrewList(prev =>
      prev.map(c => {
        if (c.id !== crewId) return c;
        return { ...c, shiftChanges: (c.shiftChanges || []).filter(sc => sc.id !== scId) };
      }),
    );
  };

  // ─── 船員資料管理 ────────────────────────────────────────────────────────
  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(crewList));
    showToast('【儲存成功】船員名單資料已儲存！');
  };

  const handleResetToDefault = () => {
    if (!window.confirm('確定要將人員名單與排班班次重設為系統預設值嗎？（目前的修改將被覆蓋）')) return;
    setCrewList(DEFAULT_CREW_LIST);
    localStorage.setItem(storageKey, JSON.stringify(DEFAULT_CREW_LIST));
    setGroupDefinitions(prev => prev.map(g => g.id === 'g_9' ? { ...g, code: '廚', name: '大廚專用' } : g));
    showToast('已重設為系統預設船員名單與班次！');
  };


  const addRow = () => {
    setCrewList(p => [...p, newCrewMember()]);
  };

  const upd = (id: string, field: keyof CrewMember, value: unknown) => {
    setCrewList(p => p.map(c => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const batch = (field: 'dutyShifts' | 'workingShifts') => {
    if (!selIds.length) return;
    const currentPreset = PRESET_OPTIONS.find(p => p.key === selectedPresetKey);
    let targetShifts: TimeShift[] = [];
    if (selectedPresetKey === 'custom') {
      targetShifts = [
        { startHour: bs1.sH, startMin: bs1.sM, endHour: bs1.eH, endMin: bs1.eM },
        { startHour: bs2.sH, startMin: bs2.sM, endHour: bs2.eH, endMin: bs2.eM },
      ];
    } else if (currentPreset) {
      targetShifts = currentPreset.shifts.map(s => ({ ...s }));
    }
    if (!targetShifts.length) return;

    setCrewList(p =>
      p.map(c => {
        if (!selIds.includes(c.id)) return c;
        return { ...c, [field]: targetShifts.map(s => ({ ...s })) };
      }),
    );
    showToast(
      `已為選取的 ${selIds.length} 位人員套用${field === 'dutyShifts' ? '海上' : '港口'}工作時間設定`
    );
  };

  const toggleThird = (id: string, field: 'dutyShifts' | 'workingShifts') => {
    setCrewList(p =>
      p.map(c => {
        if (c.id !== id) return c;
        const sh = [...c[field]];
        if (sh.length >= 3) {
          sh.splice(2, 1);
        } else {
          sh.push({ startHour: '15', startMin: '30', endHour: '18', endMin: '30' });
        }
        return { ...c, [field]: sh };
      }),
    );
  };

  const renderShifts = (
    crew: CrewMember,
    field: 'dutyShifts' | 'workingShifts',
    noWorkField: 'seaNoWork' | 'portNoWork',
  ) => {
    const nw = crew[noWorkField];
    const theme = getShiftTheme(crew[field]);
    return (
      <div className="flex items-start space-x-2">
        <div className="flex flex-col space-y-1 shrink-0">
          <label
            className="flex items-center justify-center space-x-0.5 cursor-pointer bg-slate-50 border border-slate-300 px-1 rounded hover:bg-slate-100 h-5 w-8"
            title="無工作時間"
          >
            <input
              type="checkbox"
              checked={nw}
              onChange={e => upd(crew.id, noWorkField, e.target.checked)}
              className="w-2.5 h-2.5 rounded text-slate-600"
            />
            <span className="font-bold text-[9px] text-slate-600">N</span>
          </label>
          {!nw && (
            <label
              className="flex items-center justify-center space-x-0.5 cursor-pointer bg-slate-50 border border-slate-300 px-1 rounded hover:bg-slate-100 h-5 w-8"
              title="第3段"
            >
              <input
                type="checkbox"
                checked={crew[field].length >= 3}
                onChange={() => toggleThird(crew.id, field)}
                className="w-2.5 h-2.5 rounded text-blue-600"
              />
              <span
                className={`font-bold text-[9px] ${crew[field].length >= 3 ? 'text-blue-700' : 'text-slate-600'
                  }`}
              >
                #3
              </span>
            </label>
          )}
        </div>
        {nw ? (
          <div className="font-bold text-slate-400 text-sm py-1 pl-2 tracking-widest leading-none shrink-0">- (On call)</div>
        ) : (
          <div className="flex flex-col space-y-1 shrink-0">
            {crew[field].map((sh, i) => (
              <div key={i} className="flex items-center space-x-1 h-5 whitespace-nowrap">
                <span className="text-slate-400 font-mono text-[10px] w-3.5">#{i + 1}</span>
                <TimeSelect
                  val={sh.startHour}
                  type="hour"
                  onChange={v => {
                    const u = [...crew[field]];
                    u[i] = { ...u[i], startHour: v };
                    upd(crew.id, field, u);
                  }}
                  theme={theme}
                />
                <span>:</span>
                <TimeSelect
                  val={sh.startMin}
                  type="min"
                  onChange={v => {
                    const u = [...crew[field]];
                    u[i] = { ...u[i], startMin: v };
                    upd(crew.id, field, u);
                  }}
                  theme={theme}
                />
                <span className="text-slate-400 font-mono px-0.5">~</span>
                <TimeSelect
                  val={sh.endHour}
                  type="hour"
                  onChange={v => {
                    const u = [...crew[field]];
                    u[i] = { ...u[i], endHour: v };
                    upd(crew.id, field, u);
                  }}
                  theme={theme}
                />
                <span>:</span>
                <TimeSelect
                  val={sh.endMin}
                  type="min"
                  onChange={v => {
                    const u = [...crew[field]];
                    u[i] = { ...u[i], endMin: v };
                    upd(crew.id, field, u);
                  }}
                  theme={theme}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 font-sans bg-slate-50/60 w-full max-w-full space-y-3">
      <header className="bg-white border border-slate-200 rounded-xl shadow-xs px-3.5 sm:px-4 py-2.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Part A
            </span>
            <span className="text-slate-900 font-bold text-sm sm:text-base tracking-wide">
              船員名單與工作安排表 | {selYear} 年 {selMonth} 月
            </span>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* 1. 編輯船舶資訊 (Amber) */}
          <Button
            variant={isEditingShipInfo ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsEditingShipInfo(!isEditingShipInfo)}
            className={
              isEditingShipInfo
                ? 'bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs border-amber-600'
                : 'border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-semibold shadow-xs'
            }
          >
            <Ship className="size-3.5" />
            <span className="hidden sm:inline">{isEditingShipInfo ? '收合船舶/機艙設定' : '編輯船舶資訊與機艙輪值'}</span>
            <span className="sm:hidden">{isEditingShipInfo ? '收合' : '船舶/機艙'}</span>
          </Button>

          {/* 列印工作安排表 (Neutral Slate Outline) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrintModal(true)}
            className="border-slate-300 bg-white hover:bg-slate-100 hover:text-slate-900 text-slate-700 font-semibold shadow-xs"
          >
            <Printer className="size-3.5 text-slate-600" />
            <span className="hidden sm:inline">列印工作安排表</span>
            <span className="sm:hidden">列印</span>
          </Button>


          {/* 重設預設名單 (Rose Outline) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            className="border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-semibold shadow-xs cursor-pointer"
            title="將船員名單與排班班次恢復為系統預設值（王建國船長 12 人名單）"
          >
            <RefreshCw className="size-3.5 text-rose-600" />
            <span className="hidden sm:inline">重設預設</span>
            <span className="sm:hidden">重設</span>
          </Button>

          {/* 儲存人員資料 (Emerald Save) */}
          <Button
            size="sm"
            onClick={save}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
          >
            <Save className="size-3.5" />
            <span>儲存人員資料</span>
          </Button>
        </div>
      </header>

      {/* 編輯船舶資訊與機艙輪值面板 */}
      {isEditingShipInfo && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 text-xs font-sans shadow-xs">
          <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-amber-200">
            <span className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
              <Ship className="size-4 text-amber-800" />
              編輯船舶基本資訊與機艙輪值
            </span>
            <Button
              size="sm"
              onClick={handleSaveShipInfo}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
            >
              <Save className="size-3.5" />
              保存船舶與機艙設定
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                船名 (Name):
              </label>
              <Input
                type="text"
                value={shipInfo.vesselName}
                onChange={e => setShipInfo({ ...shipInfo, vesselName: e.target.value })}
                className="h-7 text-xs font-bold text-blue-950 bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                呼號 (Call Letters):
              </label>
              <Input
                type="text"
                value={shipInfo.callSign}
                onChange={e => setShipInfo({ ...shipInfo, callSign: e.target.value })}
                className="h-7 text-xs font-bold bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                IMO 號碼:
              </label>
              <Input
                type="text"
                value={shipInfo.imoNo}
                onChange={e => setShipInfo({ ...shipInfo, imoNo: e.target.value })}
                className="h-7 text-xs font-bold bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                船籍港 (Port):
              </label>
              <Input
                type="text"
                value={shipInfo.portOfRegistry}
                onChange={e => setShipInfo({ ...shipInfo, portOfRegistry: e.target.value })}
                className="h-7 text-xs font-bold bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                總噸位 (GT):
              </label>
              <Input
                type="text"
                value={shipInfo.grossTonnage}
                onChange={e => setShipInfo({ ...shipInfo, grossTonnage: e.target.value })}
                className="h-7 text-xs bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                螺旋槳推進力 (Power):
              </label>
              <Input
                type="text"
                value={shipInfo.propellingPower}
                onChange={e => setShipInfo({ ...shipInfo, propellingPower: e.target.value })}
                className="h-7 text-xs bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                船舶種類 (Type):
              </label>
              <Input
                type="text"
                value={shipInfo.vesselType}
                onChange={e => setShipInfo({ ...shipInfo, vesselType: e.target.value })}
                className="h-7 text-xs bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block text-[11px] mb-0.5">
                服務航線 (Service Route):
              </label>
              <Input
                type="text"
                value={shipInfo.serviceRoute}
                onChange={e => setShipInfo({ ...shipInfo, serviceRoute: e.target.value })}
                className="h-7 text-xs bg-white"
              />
            </div>
          </div>

          {/* 機艙名單與值班類型 */}
          <div className="border-t border-amber-200 pt-2 mb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-bold text-amber-950 text-xs">🔴 機艙名單與值班類型：</span>
              <Button variant="outline" size="xs" onClick={handleAddEngineCrew}>
                <Plus className="size-3" />
                新增機艙職級
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {shipInfo.engineCrewRoster.map((ec, ecIdx) => (
                <div
                  key={ec.id}
                  className="bg-white p-1 border border-slate-200 rounded flex items-center justify-between shadow-xs gap-1"
                >
                  <Input
                    type="text"
                    value={ec.rank}
                    onChange={e => {
                      const val = e.target.value;
                      setShipInfo(prev => {
                        const updated = [...prev.engineCrewRoster];
                        updated[ecIdx].rank = val;
                        return { ...prev, engineCrewRoster: updated };
                      });
                    }}
                    className="h-7 w-16 px-1.5 font-bold text-blue-900 text-xs bg-white"
                  />
                  <Select
                    value={ec.type}
                    onValueChange={(val: EngineCrewDutyType) => {
                      setShipInfo(prev => {
                        const updated = [...prev.engineCrewRoster];
                        updated[ecIdx].type = val;
                        return { ...prev, engineCrewRoster: updated };
                      });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-slate-50 border-slate-200 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAN_ZERO" className="text-xs">Man zero (值班)</SelectItem>
                      <SelectItem value="DAY_WORK" className="text-xs">常日班</SelectItem>
                      <SelectItem value="ON_CALL" className="text-xs">全天 ON CALL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      setShipInfo(prev => ({
                        ...prev,
                        engineCrewRoster: prev.engineCrewRoster.filter(item => item.id !== ec.id),
                      }));
                    }}
                  >
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* 機艙無人當值管輪待命人員清單 */}
          <div className="border-t border-amber-200 pt-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-bold text-amber-950 text-xs">
                🔵 機艙無人當值管輪待命人員清單：
              </span>
              <Button variant="outline" size="xs" onClick={handleAddOnCallRank}>
                <Plus className="size-3" />
                新增待命管輪
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shipInfo.engineersOnCallRanks.map((rank, rIdx) => (
                <div
                  key={rIdx}
                  className="flex items-center space-x-1 bg-white px-2 py-0.5 rounded border border-blue-300 shadow-xs text-xs"
                >
                  <span className="font-bold text-blue-900">
                    {rIdx + 1}. {rank}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      if (shipInfo.engineersOnCallRanks.length <= 1) {
                        showToast('至少需保留一位待命管輪！', 'error');
                        return;
                      }
                      setShipInfo(prev => ({
                        ...prev,
                        engineersOnCallRanks: prev.engineersOnCallRanks.filter(
                          (_, idx) => idx !== rIdx,
                        ),
                      }));
                    }}
                  >
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 批次操作列 */}
      <section className="relative mt-3 pt-1.5">
        <span className="absolute -top-1.5 left-4 z-10 bg-gradient-to-r from-slate-900 to-slate-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded shadow-xs tracking-wider select-none">
          批次工作時段操作
        </span>

        <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 border border-blue-200/90 rounded-xl shadow-xs px-3.5 py-2.5 pt-3.5 flex items-center justify-between gap-3 flex-nowrap overflow-x-auto text-xs">
          {/* 左側：選取人數、時段範本選單、與時段顯示/自訂調整（全部單行） */}
          <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
            <Badge variant="secondary" className="bg-blue-100/90 text-blue-900 border-blue-300 text-xs font-semibold whitespace-nowrap px-2.5 py-1 shrink-0">
              已選取: {selIds.length} 人
          </Badge>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-600 font-bold whitespace-nowrap text-xs">時段設定：</span>
            <Select
              value={selectedPresetKey}
              onValueChange={(v: PresetKey) => {
                setSelectedPresetKey(v);
                const p = PRESET_OPTIONS.find(o => o.key === v);
                if (p && p.shifts.length >= 2) {
                  setBs1({ sH: p.shifts[0].startHour, sM: p.shifts[0].startMin, eH: p.shifts[0].endHour, eM: p.shifts[0].endMin });
                  setBs2({ sH: p.shifts[1].startHour, sM: p.shifts[1].startMin, eH: p.shifts[1].endHour, eM: p.shifts[1].endMin });
                }
              }}
            >
              <SelectTrigger className="h-7.5 w-[190px] text-xs bg-white border-slate-300 font-semibold shadow-2xs shrink-0">
                <SelectValue>
                  {PRESET_OPTIONS.find(p => p.key === selectedPresetKey)?.title || '選擇時段'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[340px]">
                {PRESET_OPTIONS.map(opt => (
                  <SelectItem key={opt.key} value={opt.key} className="py-2 px-2.5 cursor-pointer">
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="font-bold text-slate-800 text-xs shrink-0">{opt.title}</span>
                      <span className="text-[11px] text-blue-700 bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200/60 font-mono whitespace-nowrap">
                        {opt.timeText}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 若為固定班別：直觀展示該班別之各時段預覽標籤 */}
          {selectedPresetKey !== 'custom' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {PRESET_OPTIONS.find(p => p.key === selectedPresetKey)?.shifts.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs shadow-2xs shrink-0"
                >
                  <span className="px-1 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    #{idx + 1}
                  </span>
                  <span className="font-mono text-slate-800 font-semibold text-[11px]">
                    {s.startHour}:{s.startMin} ~ {s.endHour}:{s.endMin}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 若為自訂調整（其他）：在同行直接提供 #1 與 #2 微調下拉框 */}
          {selectedPresetKey === 'custom' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {([
                { label: '#1', bs: bs1, set: setBs1, badgeCls: 'bg-blue-100 text-blue-800 border-blue-200' },
                { label: '#2', bs: bs2, set: setBs2, badgeCls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
              ] as const).map(({ label, bs, set, badgeCls }) => (
                <div
                  key={label}
                  className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs shadow-2xs shrink-0"
                >
                  <span className={`px-1 py-0.2 rounded text-[10px] font-bold border ${badgeCls} shrink-0`}>
                    {label}
                  </span>
                  <Select value={bs.sH} onValueChange={v => set({ ...bs, sH: v })}>
                    <SelectTrigger className="h-6 w-11 px-1 text-xs bg-white border-slate-300 text-center font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {HOURS.slice(0, 24).map(h => (
                        <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="font-bold text-slate-400">:</span>
                  <Select value={bs.sM} onValueChange={v => set({ ...bs, sM: v })}>
                    <SelectTrigger className="h-6 w-11 px-1 text-xs bg-white border-slate-300 text-center font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {MINUTES.map(m => (
                        <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-slate-400 font-bold mx-0.5">~</span>
                  <Select value={bs.eH} onValueChange={v => set({ ...bs, eH: v })}>
                    <SelectTrigger className="h-6 w-11 px-1 text-xs bg-white border-slate-300 text-center font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {HOURS.map(h => (
                        <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="font-bold text-slate-400">:</span>
                  <Select value={bs.eM} onValueChange={v => set({ ...bs, eM: v })}>
                    <SelectTrigger className="h-6 w-11 px-1 text-xs bg-white border-slate-300 text-center font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {MINUTES.map(m => (
                        <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右側：批次套用操作按鈕 */}
        <div className="flex items-center gap-2 ml-auto shrink-0 flex-nowrap">
          <Button
            size="xs"
            disabled={!selIds.length}
            onClick={() => batch('dutyShifts')}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs disabled:opacity-40 cursor-pointer h-7.5 px-3 whitespace-nowrap shrink-0"
          >
            <span>批次設定海上工作時間</span>
          </Button>
          <Button
            size="xs"
            disabled={!selIds.length}
            onClick={() => batch('workingShifts')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs disabled:opacity-40 cursor-pointer h-7.5 px-3 whitespace-nowrap shrink-0"
          >
            <span>批次設定港口工作時間</span>
          </Button>
        </div>
        </div>
      </section>

      {/* 人員表格 */}
      <main className="bg-white border border-slate-200 rounded-xl shadow-xs w-full overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[1480px] text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold text-xs tracking-wider h-9">
                <th className="w-8 text-center">序</th>
                <th className="w-8 text-center">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      onChange={e => setSelIds(e.target.checked ? crewList.map(c => c.id) : [])}
                      checked={selIds.length === crewList.length && crewList.length > 0}
                      className="rounded w-4 h-4 cursor-pointer"
                    />
                  </div>
                </th>
                <th className="w-14 text-center">狀態</th>
                <th className="w-14 text-center">
                  <div className="flex items-center justify-center space-x-0.5">
                    <span>群組</span>
                    <button
                      type="button"
                      onClick={() => setShowGroupManagerModal(true)}
                      title="群組管理設定"
                      className="text-slate-400 hover:text-blue-700 text-xs p-0.5 rounded hover:bg-slate-200 transition"
                    >
                      ⚙
                    </button>
                  </div>
                </th>
                <th className="w-20 text-left">級職</th>
                <th className="w-20 text-left">中文名</th>
                <th className="w-32 text-left">英文名</th>
                <th className="w-24 text-left">航行當值</th>
                <th className="w-32 text-left">上/下船</th>
                <th className="w-[300px] text-left px-3">海上工作時間</th>
                <th className="w-[300px] text-left px-3">港口工作時間</th>
                <th className="w-[195px] text-left px-3">進出港工作模式 (W)</th>
                <th className="w-24 text-center">換班設定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {crewList.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-slate-400 font-medium">
                    目前尚無人員資料，請點擊下方「新增船員 / 欄位」或使用「延用上月資料」按鈕。
                  </td>
                </tr>
              ) : (
                crewList.map((crew, idx) => {
                  const isOff = crew.hasSignOff && crew.signOffDate !== '';
                  const isExpanded = expandedCrewIds.includes(crew.id);
                  const hasShiftChanges = crew.shiftChanges && crew.shiftChanges.length > 0;

                  return (
                    <React.Fragment key={crew.id}>
                      <tr
                        draggable={canDragIdx === idx}
                        onDragStart={e => {
                          setDraggedIdx(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={e => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverIdx !== idx) {
                            setDragOverIdx(idx);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverIdx === idx) {
                            setDragOverIdx(null);
                          }
                        }}
                        onDrop={e => {
                          e.preventDefault();
                          if (draggedIdx !== null && draggedIdx !== idx) {
                            setCrewList(prev => {
                              const next = [...prev];
                              const [moved] = next.splice(draggedIdx, 1);
                              next.splice(idx, 0, moved);
                              return next;
                            });
                          }
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                          setCanDragIdx(null);
                        }}
                        onDragEnd={() => {
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                          setCanDragIdx(null);
                        }}
                        className={`hover:bg-slate-50 transition-colors ${draggedIdx === idx ? 'opacity-40 bg-blue-50' : ''
                          } ${dragOverIdx === idx && draggedIdx !== idx
                            ? 'border-t-2 border-t-blue-500 bg-blue-50/60'
                            : ''
                          }`}
                      >
                        <td className="text-center py-2 text-slate-400">
                          <div
                            className="flex items-center justify-center cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-blue-600 transition-colors select-none"
                            title={`拖曳調整第 ${idx + 1} 位人員順序`}
                            onMouseDown={() => setCanDragIdx(idx)}
                            onMouseUp={() => setCanDragIdx(null)}
                          >
                            <GripVertical className="size-4" />
                          </div>
                        </td>
                        <td className="text-center py-2">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selIds.includes(crew.id)}
                              onChange={() =>
                                setSelIds(p =>
                                  p.includes(crew.id) ? p.filter(i => i !== crew.id) : [...p, crew.id],
                                )
                              }
                              className="rounded w-4 h-4 text-blue-600 cursor-pointer"
                            />
                          </div>
                        </td>
                        <td className="text-center py-2">
                          {isOff ? (
                            <span className="bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded font-bold text-[11px]">
                              離船
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-bold text-[11px]">
                              在船
                            </span>
                          )}
                        </td>
                        <td className="text-center py-1">
                          {renderGroupGrid(crew.groups || [], crew.id)}
                        </td>
                        <td className="text-left py-2">
                          <Input
                            type="text"
                            value={crew.rank}
                            onChange={e => upd(crew.id, 'rank', e.target.value)}
                            className="h-7 w-16 px-1.5 font-bold text-xs bg-transparent hover:bg-white focus:bg-white border-transparent hover:border-input focus:border-input"
                          />
                        </td>
                        <td className="text-left py-2">
                          <Input
                            type="text"
                            value={crew.name}
                            placeholder="中文名"
                            onChange={e => upd(crew.id, 'name', e.target.value)}
                            className="h-7 w-16 px-1.5 font-bold text-sm bg-transparent hover:bg-white focus:bg-white border-transparent hover:border-input focus:border-input"
                          />
                        </td>
                        <td className="text-left py-2">
                          <Input
                            type="text"
                            value={crew.engName}
                            placeholder="英文名"
                            onChange={e => upd(crew.id, 'engName', e.target.value)}
                            className="h-7 w-28 px-1.5 font-mono text-sm bg-transparent hover:bg-white focus:bg-white border-transparent hover:border-input focus:border-input"
                          />
                        </td>
                        <td className="text-left py-2">
                          <div className="inline-flex items-center space-x-2 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            {(['Y', 'N'] as const).map(v => (
                              <label key={v} className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={crew.watchKeeping === v}
                                  onChange={() => upd(crew.id, 'watchKeeping', v)}
                                  className="rounded w-3.5 h-3.5 text-blue-600"
                                />
                                <span
                                  className={`font-bold text-xs ${crew.watchKeeping === v ? 'text-blue-700' : 'text-slate-500'
                                    }`}
                                >
                                  {v}
                                </span>
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="text-left py-2 pr-1">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-2">
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={crew.hasSignOn}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setCrewList(prev =>
                                      prev.map(c =>
                                        c.id === crew.id
                                          ? {
                                            ...c,
                                            hasSignOn: checked,
                                            signOnDate: checked
                                              ? c.signOnDate || `${selYear}-${selMonth}-01`
                                              : '',
                                          }
                                          : c,
                                      ),
                                    );
                                  }}
                                  className="rounded w-3.5 h-3.5 text-blue-600"
                                />
                                <span className="font-semibold text-slate-700 text-xs">上船</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={crew.hasSignOff}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setCrewList(prev =>
                                      prev.map(c =>
                                        c.id === crew.id
                                          ? {
                                            ...c,
                                            hasSignOff: checked,
                                            signOffDate: checked
                                              ? c.signOffDate || `${selYear}-${selMonth}-28`
                                              : '',
                                          }
                                          : c,
                                      ),
                                    );
                                  }}
                                  className="rounded w-3.5 h-3.5 text-rose-600"
                                />
                                <span className="font-semibold text-slate-700 text-xs">下船</span>
                              </label>
                            </div>
                            {crew.hasSignOn && (
                              <div className="flex items-center space-x-0.5 bg-blue-50/60 p-0.5 rounded border border-blue-200 w-fit flex-wrap">
                                <span className="text-[10px] text-blue-800 font-bold mr-0.5">上:</span>
                                <input
                                  type="date"
                                  value={crew.signOnDate}
                                  onChange={e => upd(crew.id, 'signOnDate', e.target.value)}
                                  className="border border-slate-300 rounded px-1 py-0 bg-white text-[11px] h-5 w-[82px] font-mono"
                                />
                                <TimeSelect
                                  val={crew.signOnHour}
                                  type="hour"
                                  onChange={v => upd(crew.id, 'signOnHour', v)}
                                />
                                <span className="font-bold">:</span>
                                <TimeSelect
                                  val={crew.signOnMin}
                                  type="min"
                                  onChange={v => upd(crew.id, 'signOnMin', v)}
                                />
                              </div>
                            )}
                            {crew.hasSignOff && (
                              <div className="flex items-center space-x-0.5 bg-rose-50/60 p-0.5 rounded border border-rose-200 w-fit flex-wrap">
                                <span className="text-[10px] text-rose-800 font-bold mr-0.5">下:</span>
                                <input
                                  type="date"
                                  value={crew.signOffDate}
                                  onChange={e => upd(crew.id, 'signOffDate', e.target.value)}
                                  className="border border-slate-300 rounded px-1 py-0 bg-white text-[11px] h-5 w-[82px] font-mono"
                                />
                                <TimeSelect
                                  val={crew.signOffHour}
                                  type="hour"
                                  onChange={v => upd(crew.id, 'signOffHour', v)}
                                />
                                <span className="font-bold">:</span>
                                <TimeSelect
                                  val={crew.signOffMin}
                                  type="min"
                                  onChange={v => upd(crew.id, 'signOffMin', v)}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-left py-2 px-3">{renderShifts(crew, 'dutyShifts', 'seaNoWork')}</td>
                        <td className="text-left py-2 px-3">{renderShifts(crew, 'workingShifts', 'portNoWork')}</td>
                        <td className="text-left py-2 px-3">
                          <Select
                            value={crew.maneuveringMode || 'ALL'}
                            onValueChange={v => upd(crew.id, 'maneuveringMode', v)}
                          >
                            <SelectTrigger className="h-7 text-[11px] font-bold bg-white w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MANEUVERING_MODES.map(m => (
                                <SelectItem key={m.code} value={m.code} className="text-xs">
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="text-center py-2">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                toggleExpand(crew.id);
                              }}
                              className={`px-2 py-0.5 rounded font-bold transition text-xs flex items-center space-x-0.5 cursor-pointer ${hasShiftChanges
                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200'
                                }`}
                              title="換班異動設定"
                            >
                              <RefreshCw className="size-3" />
                              <span>換班</span>
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setCrewList(p => p.filter(c => c.id !== crew.id));
                              }}
                              className="text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 text-xs cursor-pointer"
                              title="刪除此船員"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 換班異動展開區塊 */}
                      {isExpanded && (
                        <tr className="bg-amber-50/40 border-b border-amber-200">
                          <td colSpan={13} className="px-4 py-2.5 border-l-4 border-l-amber-500">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-amber-950 text-sm flex items-center space-x-1.5">
                                <RefreshCw className="size-4 text-amber-700" />
                                <span>
                                  {crew.rank} {crew.name} ({crew.engName}) 的換班異動排程
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddShiftChange(crew.id)}
                                className="bg-white border border-amber-400 text-amber-800 hover:bg-amber-100 px-2.5 py-1 rounded text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="size-3" />
                                新增換班異動
                              </button>
                            </div>

                            {(!crew.shiftChanges || crew.shiftChanges.length === 0) ? (
                              <div className="text-slate-500 text-center py-2 text-xs bg-white border border-dashed border-amber-200 rounded">
                                目前無換班設定（整月皆沿用上方主班表）。
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {crew.shiftChanges.map(sc => {
                                  const scSeaTheme = getShiftTheme(sc.dutyShifts);
                                  const scPortTheme = getShiftTheme(sc.workingShifts);

                                  return (
                                    <div
                                      key={sc.id}
                                      className="bg-white border border-amber-300 p-2 rounded flex items-center justify-between shadow-xs gap-2 flex-wrap"
                                    >
                                      <div className="flex items-center space-x-1 border-r border-slate-200 pr-3 mr-2">
                                        <label className="text-[11px] font-bold text-slate-600">
                                          生效起點:
                                        </label>
                                        <input
                                          type="date"
                                          value={sc.effectiveDate}
                                          onChange={e =>
                                            handleUpdateShiftChange(
                                              crew.id,
                                              sc.id,
                                              'effectiveDate',
                                              e.target.value,
                                            )
                                          }
                                          className="border border-slate-300 rounded px-1 py-0 bg-white text-[11px] h-5 w-24"
                                        />
                                        <TimeSelect
                                          val={sc.effectiveHour}
                                          type="hour"
                                          onChange={v =>
                                            handleUpdateShiftChange(
                                              crew.id,
                                              sc.id,
                                              'effectiveHour',
                                              v,
                                            )
                                          }
                                        />
                                        <span className="font-bold">:</span>
                                        <TimeSelect
                                          val={sc.effectiveMin}
                                          type="min"
                                          onChange={v =>
                                            handleUpdateShiftChange(
                                              crew.id,
                                              sc.id,
                                              'effectiveMin',
                                              v,
                                            )
                                          }
                                        />
                                      </div>

                                      <div className="flex items-center space-x-1 border-r border-slate-200 pr-3 mr-2">
                                        <label className="text-[11px] font-bold text-slate-600">
                                          換班群組:
                                        </label>
                                        {renderGroupGrid(sc.groups || [], crew.id, sc.id)}
                                      </div>

                                      <div className="flex items-center space-x-1 border-r border-slate-200 pr-3 mr-2">
                                        <label className="text-[11px] font-bold text-slate-600">
                                          航行當值:
                                        </label>
                                        <div className="flex space-x-1.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                          <label className="flex items-center space-x-0.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={sc.watchKeeping === 'Y'}
                                              onChange={() =>
                                                handleUpdateShiftChange(
                                                  crew.id,
                                                  sc.id,
                                                  'watchKeeping',
                                                  'Y',
                                                )
                                              }
                                              className="w-3.5 h-3.5 text-blue-600 rounded"
                                            />
                                            <span
                                              className={
                                                sc.watchKeeping === 'Y'
                                                  ? 'font-bold text-blue-700 text-xs'
                                                  : 'text-slate-500 text-xs'
                                              }
                                            >
                                              Y
                                            </span>
                                          </label>
                                          <label className="flex items-center space-x-0.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={sc.watchKeeping === 'N'}
                                              onChange={() =>
                                                handleUpdateShiftChange(
                                                  crew.id,
                                                  sc.id,
                                                  'watchKeeping',
                                                  'N',
                                                )
                                              }
                                              className="w-3.5 h-3.5 text-slate-600 rounded"
                                            />
                                            <span
                                              className={
                                                sc.watchKeeping === 'N'
                                                  ? 'font-bold text-slate-700 text-xs'
                                                  : 'text-slate-500 text-xs'
                                              }
                                            >
                                              N
                                            </span>
                                          </label>
                                        </div>
                                      </div>

                                      <div className="flex items-center space-x-1 border-r border-slate-200 pr-3 mr-2">
                                        <label className="text-[11px] font-bold text-slate-600">
                                          海上工作時間:
                                        </label>
                                        <div className="space-y-0.5">
                                          {sc.dutyShifts.map((shift, sIdx) => (
                                            <div key={sIdx} className="flex items-center space-x-0.5">
                                              <span className="text-slate-400 font-mono text-[9px] w-3">
                                                #{sIdx + 1}
                                              </span>
                                              <TimeSelect
                                                val={shift.startHour}
                                                type="hour"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'dutyShifts',
                                                    v,
                                                    'startHour',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scSeaTheme}
                                              />
                                              <span>:</span>
                                              <TimeSelect
                                                val={shift.startMin}
                                                type="min"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'dutyShifts',
                                                    v,
                                                    'startMin',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scSeaTheme}
                                              />
                                              <span className="text-slate-400 font-mono px-0.5">~</span>
                                              <TimeSelect
                                                val={shift.endHour}
                                                type="hour"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'dutyShifts',
                                                    v,
                                                    'endHour',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scSeaTheme}
                                              />
                                              <span>:</span>
                                              <TimeSelect
                                                val={shift.endMin}
                                                type="min"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'dutyShifts',
                                                    v,
                                                    'endMin',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scSeaTheme}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="flex items-center space-x-1 border-r border-slate-200 pr-3 mr-2">
                                        <label className="text-[11px] font-bold text-slate-600">
                                          港口工作時間:
                                        </label>
                                        <div className="space-y-0.5">
                                          {sc.workingShifts.map((shift, sIdx) => (
                                            <div key={sIdx} className="flex items-center space-x-0.5">
                                              <span className="text-slate-400 font-mono text-[9px] w-3">
                                                #{sIdx + 1}
                                              </span>
                                              <TimeSelect
                                                val={shift.startHour}
                                                type="hour"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'workingShifts',
                                                    v,
                                                    'startHour',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scPortTheme}
                                              />
                                              <span>:</span>
                                              <TimeSelect
                                                val={shift.startMin}
                                                type="min"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'workingShifts',
                                                    v,
                                                    'startMin',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scPortTheme}
                                              />
                                              <span className="text-slate-400 font-mono px-0.5">~</span>
                                              <TimeSelect
                                                val={shift.endHour}
                                                type="hour"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'workingShifts',
                                                    v,
                                                    'endHour',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scPortTheme}
                                              />
                                              <span>:</span>
                                              <TimeSelect
                                                val={shift.endMin}
                                                type="min"
                                                onChange={v =>
                                                  handleUpdateShiftChange(
                                                    crew.id,
                                                    sc.id,
                                                    'workingShifts',
                                                    v,
                                                    'endMin',
                                                    sIdx,
                                                  )
                                                }
                                                theme={scPortTheme}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="flex items-center space-x-1 flex-1 pr-2 min-w-36">
                                        <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                          模式(W):
                                        </label>
                                        <select
                                          value={sc.maneuveringMode || 'ALL'}
                                          onChange={e =>
                                            handleUpdateShiftChange(
                                              crew.id,
                                              sc.id,
                                              'maneuveringMode',
                                              e.target.value,
                                            )
                                          }
                                          className="border border-slate-300 rounded px-1 py-0.5 text-xs font-bold bg-white text-slate-800 w-full"
                                        >
                                          {MANEUVERING_MODES.map(m => (
                                            <option key={m.code} value={m.code}>
                                              {m.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteShiftChange(crew.id, sc.id)}
                                        className="text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded font-bold border border-slate-200 text-xs cursor-pointer"
                                        title="刪除此換班異動"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/70 border-t border-slate-200">
                <td colSpan={13} className="p-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-600 hover:text-blue-700 font-bold rounded-lg flex items-center justify-center space-x-1.5 transition text-xs cursor-pointer shadow-2xs"
                  >
                    <Plus className="size-3.5 text-blue-600" />
                    <span>新增船員 / 欄位</span>
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 底部統計列 */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center text-slate-700 font-medium text-xs">
          <div className="flex space-x-3 sm:space-x-5 items-center flex-wrap gap-y-1">
            <span>
              總人數: <strong className="text-slate-900 text-sm font-bold">{totalCount}</strong> 人
            </span>
            <span className="text-slate-300">|</span>
            <span>
              在船人數: <strong className="text-emerald-700 text-sm font-bold">{onboardCount}</strong> 人
            </span>
            <span>
              離船人數: <strong className="text-rose-700 text-sm font-bold">{offboardCount}</strong> 人
            </span>
            <span>
              航行當值 (Y):{' '}
              <strong className="text-blue-700 text-sm font-bold">
                {crewList.filter(c => c.watchKeeping === 'Y').length}
              </strong>{' '}
              人
            </span>
            <span>
              非航行當值 (N):{' '}
              <strong className="text-slate-800 text-sm font-bold">
                {crewList.filter(c => c.watchKeeping === 'N').length}
              </strong>{' '}
              人
            </span>
          </div>
        </div>
      </main>

      {/* 群組管理彈出視窗 (GroupManagerModal) */}
      {showGroupManagerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-4 text-slate-900 border border-slate-200">
            <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-200">
              <span className="font-bold text-sm text-blue-950 flex items-center space-x-1.5">
                <span className="text-base">⚙️</span>
                <span>群組管理設定 (上限 10 組)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowGroupManagerModal(false)}
                className="text-slate-400 hover:text-rose-600 font-bold text-sm p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto pr-1">
              {groupDefinitions.map((gDef, gIdx) => (
                <div
                  key={gDef.id}
                  className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center space-x-2"
                >
                  <span className="font-mono font-bold text-slate-400 w-5 text-xs">
                    #{gIdx + 1}
                  </span>
                  <div className="flex items-center space-x-1">
                    <label className="text-[11px] text-slate-600 whitespace-nowrap">顯示:</label>
                    <Input
                      type="text"
                      maxLength={2}
                      value={gDef.code}
                      onChange={e => {
                        const val = e.target.value;
                        setGroupDefinitions(prev =>
                          prev.map(item => (item.id === gDef.id ? { ...item, code: val } : item)),
                        );
                      }}
                      className="h-6 w-12 text-center font-bold bg-white text-xs px-1"
                    />
                  </div>
                  <div className="flex-1 flex items-center space-x-1">
                    <label className="text-[11px] text-slate-600 whitespace-nowrap">說明:</label>
                    <Input
                      type="text"
                      value={gDef.name}
                      onChange={e => {
                        const val = e.target.value;
                        setGroupDefinitions(prev =>
                          prev.map(item => (item.id === gDef.id ? { ...item, name: val } : item)),
                        );
                      }}
                      className="h-6 w-full bg-white text-xs px-1.5"
                    />
                  </div>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-[3px] border font-bold text-[9px] ${gDef.color}`}
                  >
                    {gDef.code || '預覽'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  if (!window.confirm('確定要將群組設定恢復為系統預設值嗎？')) return;
                  setGroupDefinitions(DEFAULT_GROUP_DEFINITIONS);
                  localStorage.setItem('custom_group_definitions_v2', JSON.stringify(DEFAULT_GROUP_DEFINITIONS));
                  showToast('已重設為系統預設群組！');
                }}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                重設預設群組
              </Button>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGroupManagerModal(false)}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveGroupDefinitions}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  <Save className="size-3.5" />
                  保存群組設定
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 船上工作安排表列印預覽彈出視窗 (showPrintModal) */}
      {showPrintModal && createPortal(
        <div id="print-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 overflow-y-auto">
          {/* 專屬 A4 直向 1 頁列印樣式，消除邊距隱藏瀏覽器標題與日期 */}
          <style>{`
            @page {
              size: A4 portrait;
              margin: 0;
            }
            @media print {
              html, body {
                width: 210mm !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                overflow: visible !important;
              }
              /* 完全移除網頁其他內容(含 #root)，不佔用高度 */
              body > *:not(#print-modal) {
                display: none !important;
              }
              #print-modal {
                position: static !important;
                display: block !important;
                padding: 0 !important;
                background: transparent !important;
                backdrop-filter: none !important;
                overflow: visible !important;
              }
              #part-a-print-sheet {
                position: static !important;
                width: 210mm !important;
                max-width: none !important;
                height: 296mm !important;
                max-height: 296mm !important;
                margin: 0 !important;
                padding: 6mm 8mm !important;
                box-sizing: border-box !important;
                background: #fff !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                overflow: hidden !important;
              }
              .no-print, .print\\:hidden {
                display: none !important;
              }
            }
          `}</style>
          <div id="part-a-print-sheet" className="bg-white rounded shadow-2xl max-w-[850px] w-full p-2.5 text-slate-900 my-auto text-xs">
            <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-200 print:hidden font-sans no-print">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-blue-950">船上工作安排表列印預覽</span>
              </div>
              <div className="space-x-2 flex items-center">
                <Button size="xs" onClick={handlePrintPartA} className="bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1 cursor-pointer">
                  <Printer className="size-3.5" />
                  <span>列印此表單 (Print)</span>
                </Button>
                <Button variant="outline" size="xs" onClick={() => setShowPrintModal(false)}>
                  關閉 (Close)
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center mb-1 leading-none select-none text-[13px] text-slate-900 font-normal">
              <div className="flex items-center gap-2">
                <span>資料分級：</span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 border border-black bg-white shrink-0" />
                  <span>一般</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 bg-black border border-black shrink-0 [print-color-adjust:exact]" />
                  <span>內部</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 border border-black bg-white shrink-0" />
                  <span>限閱</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 border border-black bg-white shrink-0" />
                  <span>機密</span>
                </span>
              </div>
              <div>
                (2900A900)附件/Appendix 97
              </div>
            </div>

            <div className="text-center font-bold text-[14px] py-1 tracking-wide">
              <span className="mr-1">Shipboard Working Arrangement</span>
              <span>船上工作安排</span>
            </div>

            <div className="border border-black grid grid-cols-4 text-[9.5px] mb-1.5">
              <div className="border-r border-black p-0.5 pl-1.5 leading-tight">
                <span>Name of the vessel 船名</span>:<br />
                <strong className="text-[10.5px]">{shipInfo.vesselName}</strong>
              </div>
              <div className="border-r border-black p-0.5 pl-1.5 leading-tight">
                <span>Call Letters 呼號</span>:<br />
                <strong className="text-[10.5px]">{shipInfo.callSign}</strong>
              </div>
              <div className="border-r border-black p-0.5 pl-1.5 leading-tight">
                <span>IMO Number 國際海事組織號碼</span>:<br />
                <strong className="text-[10.5px]">{shipInfo.imoNo}</strong>
              </div>
              <div className="p-0.5 pl-1.5 leading-tight">
                <span>Registration Port 船籍港</span>:<br />
                <strong className="text-[10.5px]">{shipInfo.portOfRegistry}</strong>
              </div>
            </div>

            <div className="border border-black grid grid-cols-3 text-[9.5px] mb-1.5">
              <div className="border-r border-black p-0.5 pl-1.5">
                <span>Gross Tonnage 總噸位</span>: <strong className="text-[10px]">{shipInfo.grossTonnage}</strong>
              </div>
              <div className="border-r border-black p-0.5 pl-1.5">
                <span>Propelling Power 螺旋槳推進力</span>: <strong className="text-[10px]">{shipInfo.propellingPower}</strong>
              </div>
              <div className="p-0.5 pl-1.5">
                <span>Type of Vessel 船舶種類</span>: <strong className="text-[10px]">{shipInfo.vesselType}</strong>
              </div>
            </div>

            <div className="border border-black py-1 px-1.5 text-[9.5px] font-semibold mb-1.5">
              <span>Service to which the vessel is engaged in : {shipInfo.serviceRoute} 船舶服務航線</span>
            </div>

            <div className="border border-black text-[9.5px]">
              <table className="w-full text-center border-collapse border-b border-black">
                <thead>
                  <tr className="border-b border-black bg-slate-100 text-[9px] font-bold">
                    <th rowSpan={2} className="border-r border-black p-0.5 w-20">
                      <span className="block leading-tight">Position/Grade</span>
                      <span className="block leading-tight">職稱/級別</span>
                    </th>
                    <th colSpan={2} className="border-r border-black p-0.5">
                      <span className="block leading-tight">Hours of work scheduled at sea</span>
                      <span className="block leading-tight">海上工作時數</span>
                    </th>
                    <th colSpan={2} className="border-r border-black p-0.5">
                      <span className="block leading-tight">Hours of work scheduled on port</span>
                      <span className="block leading-tight">港口工作時數</span>
                    </th>
                    <th rowSpan={2} className="border-r border-black p-0.5 w-10">
                      <span className="block leading-tight">Remark</span>
                      <span className="block leading-tight">備註</span>
                    </th>
                    <th colSpan={2} className="p-0.5 w-24">
                      <span className="block leading-tight">Total number of daily</span>
                      <span className="block leading-tight">hours of <del className="decoration-black decoration-1">work</del>/rest</span>
                      <span className="block leading-tight">每日<del className="decoration-black decoration-1">工作</del>/休息 總時數</span>
                    </th>
                  </tr>
                  <tr className="border-b border-black bg-slate-50 text-[8px] font-bold">
                    <th className="border-r border-black p-0.5 w-28">
                      <span className="block leading-tight">Watchkeeping periods (from-until)</span>
                      <span className="block leading-tight">當值時段</span>
                    </th>
                    <th className="border-r border-black p-0.5 w-28">
                      <span className="block leading-tight">Duties not related to watchkeeping periods(from-until)</span>
                      <span className="block leading-tight">非當值工作時段</span>
                    </th>
                    <th className="border-r border-black p-0.5 w-28">
                      <span className="block leading-tight">Watchkeeping periods (from-until)</span>
                      <span className="block leading-tight">當值時段</span>
                    </th>
                    <th className="border-r border-black p-0.5 w-28">
                      <span className="block leading-tight">Duties not related to watchkeeping periods(from-until)</span>
                      <span className="block leading-tight">非當值工作時段</span>
                    </th>
                    <th className="border-r border-black p-0.5">
                      <span className="block leading-tight">At sea</span>
                      <span className="block leading-tight">在海上</span>
                    </th>
                    <th className="p-0.5">
                      <span className="block leading-tight">At port</span>
                      <span className="block leading-tight">在港口</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-[9px]">
                  {filteredPrintDeckCrew.map(crew => {
                    let activeWatchKeeping = crew.watchKeeping;
                    let activeDutyShifts = crew.dutyShifts;
                    let activeWorkingShifts = crew.workingShifts;

                    if (crew.shiftChanges && crew.shiftChanges.length > 0) {
                      const applicableShifts = crew.shiftChanges
                        .filter(sc => sc.effectiveDate <= printFilterDate)
                        .sort((a, b) => (a.effectiveDate + a.effectiveHour + a.effectiveMin).localeCompare(b.effectiveDate + b.effectiveHour + b.effectiveMin));
                      if (applicableShifts.length > 0) {
                        const latestShift = applicableShifts[applicableShifts.length - 1];
                        activeWatchKeeping = latestShift.watchKeeping;
                        activeDutyShifts = latestShift.dutyShifts;
                        activeWorkingShifts = latestShift.workingShifts;
                      }
                    }

                    let seaWatch = 'On call';
                    let seaNonWatch = 'On call';
                    let seaWorkHours = 0;

                    if (!crew.seaNoWork) {
                      const shiftText = activeDutyShifts.map(s => `${s.startHour}${s.startMin}-${s.endHour}${s.endMin}`).join('\n');
                      activeDutyShifts.forEach(s => { seaWorkHours += calcDurationHours(s.startHour, s.startMin, s.endHour, s.endMin); });

                      if (activeWatchKeeping === 'Y') {
                        seaWatch = shiftText;
                        seaNonWatch = 'On call';
                      } else {
                        seaWatch = 'On call';
                        seaNonWatch = shiftText;
                      }
                    }

                    let portWatch = 'On call';
                    let portNonWatch = 'On call';
                    let portWorkHours = 0;

                    if (!crew.portNoWork) {
                      const shiftText = activeWorkingShifts.map(s => `${s.startHour}${s.startMin}-${s.endHour}${s.endMin}`).join('\n');
                      activeWorkingShifts.forEach(s => { portWorkHours += calcDurationHours(s.startHour, s.startMin, s.endHour, s.endMin); });

                      if (activeWatchKeeping === 'Y') {
                        portWatch = shiftText;
                        portNonWatch = 'On call';
                      } else {
                        portWatch = 'On call';
                        portNonWatch = shiftText;
                      }
                    }

                    const seaRestHours = Math.max(0, 24 - seaWorkHours);
                    const portRestHours = Math.max(0, 24 - portWorkHours);

                    return (
                      <tr key={crew.id} className="h-4">
                        <td className="border-r border-black p-0.5 font-bold text-left pl-1.5 text-[10px]">
                          {crew.rank}
                        </td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{seaWatch}</td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{seaNonWatch}</td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{portWatch}</td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{portNonWatch}</td>
                        <td className="border-r border-black p-0.5 text-slate-400"></td>
                        <td className="border-r border-black p-0.5 font-bold">{seaRestHours}</td>
                        <td className="p-0.5 font-bold">{portRestHours}</td>
                      </tr>
                    );
                  })}

                  {shipInfo.engineCrewRoster.map(ec => {
                    let seaWatch = 'On call';
                    let seaNonWatch = 'On call';
                    let portWatch = 'On call';
                    let portNonWatch = 'On call';
                    let restH = 16;

                    if (ec.type === 'ON_CALL') {
                      seaWatch = 'On call'; seaNonWatch = 'On call';
                      portWatch = 'On call'; portNonWatch = 'On call';
                      restH = 24;
                    } else if (ec.type === 'MAN_ZERO') {
                      seaWatch = 'Man zero';
                      seaNonWatch = '0800-1200\n1300-1700';
                      portWatch = 'Man zero';
                      portNonWatch = '0800-1200\n1300-1700';
                      restH = 16;
                    } else {
                      seaWatch = 'On call';
                      seaNonWatch = '0800-1200\n1300-1700';
                      portWatch = 'On call';
                      portNonWatch = '0800-1200\n1300-1700';
                      restH = 16;
                    }

                    return (
                      <tr key={ec.id} className="h-4 bg-slate-50/40">
                        <td className="border-r border-black p-0.5 font-bold text-left pl-1.5 text-[10px]">
                          {ec.rank}
                        </td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{seaWatch}</td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{seaNonWatch}</td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{portWatch}</td>
                        <td className="border-r border-black p-0.5 whitespace-pre-line leading-tight">{portNonWatch}</td>
                        <td className="border-r border-black p-0.5 text-slate-400"></td>
                        <td className="border-r border-black p-0.5 font-bold">{restH}</td>
                        <td className="p-0.5 font-bold">{restH}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-b border-black">
                <div className="bg-slate-100 p-0.5 font-bold text-[8.5px] border-b border-black text-left pl-1.5">
                  <span className="mr-1">Engineers on call for engine room men-zero on the date in the calendar months.</span>
                  <span>機艙無人當值時管輪當月待命日期</span>
                </div>
                <table className="w-full text-center border-collapse text-[8.5px] table-fixed">
                  <tbody>
                    {engRanks.map((engRank, engIdx) => {
                      const rowCells = matrix[engIdx];
                      return (
                        <tr key={engIdx} className="border-b border-black last:border-b-0 h-4">
                          <td className="border-r border-black font-bold p-0.5 w-12 bg-slate-50 text-left pl-1.5 text-[9.5px]">
                            {engRank}
                          </td>
                          {rowCells.map((val, cellIdx) => {
                            const isFirstCol = cellIdx === 0;
                            return (
                              <td
                                key={cellIdx}
                                onClick={() => {
                                  if (isFirstCol) handleSetDayOneRow(engIdx);
                                }}
                                className={`border-r border-black last:border-r-0 p-0.5 ${isFirstCol
                                  ? 'bg-yellow-200 font-extrabold text-blue-950 underline cursor-pointer'
                                  : val
                                    ? 'font-bold text-black'
                                    : 'text-slate-300'
                                  }`}
                              >
                                {val || ''}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-1 text-[8.5px] leading-tight space-y-1 bg-white">
                <div className="flex items-start">
                  <span className="font-bold w-3 flex-shrink-0">1.</span>
                  <div className="flex-1">
                    <span className="block">The shipboard working arrangement to contain for every position at least the schedule of service at sea and service in port shall be updated to reflect the fact onboard when seafarer or working hours changed and posted in an easily accessible place.</span>
                    <span className="block">船上工作安排包含至少每一職務在海上和在港內的服務時程,當船員或工作時數有變動必須更新本表反映船上現況並且張貼在容易接近的場所</span>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="font-bold w-3 flex-shrink-0">2.</span>
                  <div className="flex-1">
                    <span className="block">The minimum hours of rest shall not be less than ten hours in any 24-hour period and 77 hours in any seven-day period. Hours of rest may be divided into no more than two periods, one of which shall be at least six hours in length, and the interval between consecutive periods of rest shall not exceed 14 hours.</span>
                    <span className="block">每任何24小時應有10小時休息，休息時間可分兩段，其中一段至少要有6小時，相連的兩段休息時間的間隔，不得超過14小時，任何7天內不得少於77小時。</span>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="font-bold w-3 flex-shrink-0">3.</span>
                  <div className="flex-1">
                    <span>Meal breaks for all seafarers are defined as follow 船員用餐時間規定: 1) 07:30 breakfast早餐 2) 12:00 lunch中餐 3) 17:30 dinner晚餐</span>
                  </div>
                </div>

                <div className="pl-3 space-y-0.5 pt-0.5">
                  <div className="flex items-center space-x-1 leading-tight">
                    <span className="inline-block border border-black px-1 font-bold text-[8px]">X</span>
                    <span>Manning level onboard is confirmed to satisfy the Certificate of Minimum Safe Manning. 船上人員配置需確定能滿足最低人員安全配置證書</span>
                  </div>
                  <div className="flex items-center space-x-1 leading-tight">
                    <span className="inline-block border border-black px-1 font-bold text-[8px]">X</span>
                    <span>Seafarers listed are confirmed at age of 18 above. 確認船員名單內年齡在18歲以上</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 items-center border-t border-black p-2 text-[9.5px] font-bold bg-slate-50">
                <div className="col-span-6 flex items-center space-x-1">
                  <span className="whitespace-nowrap">
                    <span>Issued by Master 船長簽名</span>:
                  </span>
                  <span className="inline-flex items-center justify-center border-b border-black w-48 h-6 text-center text-blue-900 text-[10.5px]">
                    {signerDisplay}
                  </span>
                </div>

                <div className="col-span-6 flex items-center space-x-1 pl-4">
                  <span className="whitespace-nowrap">
                    <span>Date 日期</span>:
                  </span>
                  <input
                    type="date"
                    value={printFilterDate}
                    onChange={e => setPrintFilterDate(e.target.value)}
                    className="border-b border-black border-t-0 border-l-0 border-r-0 rounded-none px-1 h-6 bg-transparent font-medium text-[10.5px] text-center w-36 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="text-right mt-1 select-none text-[12px] leading-none text-slate-500">
              <span>(表單編號 Form No. : 4M-951-06) (2025.11)</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
