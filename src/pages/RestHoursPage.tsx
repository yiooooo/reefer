import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { RestHoursView, CrewMember, DayData, CrewOverrides, GroupDef } from '../types/restHours';
import {
    YEARS,
    MONTHS,
    DEFAULT_CREW_LIST,
    DEFAULT_GROUP_DEFINITIONS,
} from '../utils/restHoursData';
import { loadGroupDefinitions, getPrevYearMonth } from '../utils/restHoursUtils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { PartA } from '../components/restHours/PartA';
import { PartB } from '../components/restHours/PartB';
import { PartC } from '../components/restHours/PartC';
import { PartD } from '../components/restHours/PartD';
import { useToast } from '../context/ToastContext';

export const RestHoursPage: React.FC = () => {
    const { showToast } = useToast();
    const [view, setView] = useState<RestHoursView>('PART_A');
    const [selYear, setSelYear] = useState(() => String(new Date().getFullYear()));
    const [selMonth, setSelMonth] = useState(() =>
        String(new Date().getMonth() + 1).padStart(2, '0'),
    );

    // 清理 2026/08 測試名單與測試動態殘留，確保所有月份恢復系統乾淨預設值
    useEffect(() => {
        try {
            const c = localStorage.getItem('rest_hours_202608');
            if (c && c.includes('李偉安')) {
                localStorage.removeItem('rest_hours_202608');
                localStorage.removeItem('vessel_schedule_202608');
                localStorage.removeItem('all_crew_overrides_202608');
            }
        } catch {
            // ignore
        }
    }, []);

    const [crewList, setCrewList] = useState<CrewMember[]>([]);
    const [groupDefs, setGroupDefs] = useState<GroupDef[]>(() =>
        loadGroupDefinitions(DEFAULT_GROUP_DEFINITIONS),
    );

    const crewStorageKey = `rest_hours_${selYear}${selMonth}`;
    const vesselStorageKey = `vessel_schedule_${selYear}${selMonth}`;
    const overrideStorageKey = `all_crew_overrides_${selYear}${selMonth}`;

    const [vesselData, setVesselData] = useState<Record<string, DayData>>(() => {
        try {
            return JSON.parse(localStorage.getItem(vesselStorageKey) || 'null') ?? {};
        } catch {
            return {};
        }
    });

    const [overrides, setOverrides] = useState<Record<string, CrewOverrides>>(() => {
        try {
            return JSON.parse(localStorage.getItem(overrideStorageKey) || 'null') ?? {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(crewStorageKey) || 'null');
            if (stored && Array.isArray(stored) && stored.length >= 12) {
                setCrewList(stored);
            } else {
                setCrewList(DEFAULT_CREW_LIST);
            }
        } catch {
            setCrewList(DEFAULT_CREW_LIST);
        }

        try {
            setVesselData(
                JSON.parse(localStorage.getItem(vesselStorageKey) || 'null') ?? {},
            );
        } catch {
            setVesselData({});
        }

        try {
            setOverrides(
                JSON.parse(localStorage.getItem(overrideStorageKey) || 'null') ?? {},
            );
        } catch {
            setOverrides({});
        }

        setView('PART_A');
        document.title = 'FLEET FORMs SYSTEM | 船員休息時數紀錄管理';
    }, [selYear, selMonth, crewStorageKey, vesselStorageKey, overrideStorageKey]);

    const prevYearMonth = getPrevYearMonth(selYear, selMonth);

    const handleInheritPrevMonth = () => {
        const raw = localStorage.getItem(`rest_hours_${prevYearMonth}`);
        if (!raw) {
            showToast(`找不到上月 (${prevYearMonth}) 資料！`, 'error');
            return;
        }
        try {
            const arr: CrewMember[] = JSON.parse(raw);
            const inherited = arr
                .filter(c => !(c.hasSignOff && c.signOffDate !== ''))
                .map(c => ({
                    ...c,
                    hasSignOn: false,
                    signOnDate: '',
                    hasSignOff: false,
                    signOffDate: '',
                    shiftChanges: [],
                }));
            setCrewList(inherited);
            localStorage.setItem(crewStorageKey, JSON.stringify(inherited));
            showToast(`已成功延用 (${prevYearMonth}) 人員資料！`);
        } catch {
            showToast('讀取失敗。', 'error');
        }
    };

    return (
        <div className="relative">
            {/* Top sticky navigation bar */}
            <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-700/80 px-3 sm:px-4 py-2 flex items-center justify-between flex-wrap gap-2.5 text-xs shadow-md">
                <div className="flex items-center flex-wrap gap-3">
                    <span className="font-extrabold text-sm sm:text-base tracking-wide bg-gradient-to-r from-sky-400 to-indigo-300 bg-clip-text text-transparent whitespace-nowrap">
                        休息時數管理
                    </span>

                    {/* Year and month selector */}
                    <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 backdrop-blur-xs">
                        <label className="text-slate-400 font-semibold whitespace-nowrap">製作月份:</label>
                        <Select value={selYear} onValueChange={setSelYear}>
                            <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700 text-slate-200 w-24 focus:ring-sky-500">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
                                {YEARS.map(y => (
                                    <SelectItem key={y} value={y} className="text-xs focus:bg-sky-950 focus:text-sky-300">
                                        {y} 年
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selMonth} onValueChange={setSelMonth}>
                            <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700 text-slate-200 w-20 focus:ring-sky-500">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
                                {MONTHS.map(m => (
                                    <SelectItem key={m} value={m} className="text-xs focus:bg-sky-950 focus:text-sky-300">
                                        {m} 月
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={handleInheritPrevMonth}
                            className="h-7 text-xs bg-sky-950/50 hover:bg-sky-900/60 text-sky-300 hover:text-sky-200 border-sky-600/40 hover:border-sky-500 gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title={`延用上月 (${prevYearMonth}) 船員名單`}
                        >
                            <RotateCcw className="size-3 text-sky-400" />
                            <span>延用上月 ({prevYearMonth})</span>
                        </Button>
                    </div>
                </div>

                {/* Stage Tabs (A / B / C / D) */}
                <div className="flex items-center p-1 bg-slate-800/90 border border-slate-700/80 rounded-lg gap-1 shadow-inner">
                    {[
                        { id: 'PART_A', step: 'A', name: '人員設定' },
                        { id: 'PART_B', step: 'B', name: '船舶事件' },
                        { id: 'PART_C', step: 'C', name: '休息時數' },
                        { id: 'PART_D', step: 'D', name: '無職災工時' },
                    ].map((tab) => {
                        const active = view === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setView(tab.id as RestHoursView)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${active
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                    }`}
                            >
                                <span
                                    className={`size-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${active
                                        ? 'bg-white text-sky-700'
                                        : 'bg-slate-700 text-slate-300'
                                        }`}
                                >
                                    {tab.step}
                                </span>
                                <span>{tab.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* View routing */}
            {view === 'PART_A' && (
                <PartA
                    selYear={selYear}
                    selMonth={selMonth}
                    crewList={crewList}
                    setCrewList={setCrewList}
                    groupDefinitions={groupDefs}
                    setGroupDefinitions={setGroupDefs}
                    onGoToB={() => setView('PART_B')}
                />
            )}

            {view === 'PART_B' && (
                <PartB
                    selYear={selYear}
                    selMonth={selMonth}
                    crewList={crewList}
                    groupDefinitions={groupDefs}
                    dailyData={vesselData}
                    setDailyData={setVesselData}
                    onBackToA={() => setView('PART_A')}
                    onGoToC={() => setView('PART_C')}
                />
            )}

            {view === 'PART_C' && (
                <PartC
                    selYear={selYear}
                    selMonth={selMonth}
                    crewList={crewList}
                    dailyData={vesselData}
                    setDailyData={setVesselData}
                    allCrewOverrides={overrides}
                    setAllCrewOverrides={setOverrides}
                    onBackToB={() => setView('PART_B')}
                />
            )}

            {view === 'PART_D' && (
                <PartD
                    selYear={selYear}
                    selMonth={selMonth}
                    crewList={crewList}
                    dailyData={vesselData}
                    allCrewOverrides={overrides}
                    onBackToC={() => setView('PART_C')}
                />
            )}
        </div>
    );
};
