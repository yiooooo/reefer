import React, { useState, useMemo } from 'react';
import { ReeferContainer } from '../types/reefer';
import { Plus, Trash2, SlidersHorizontal, PackageSearch, Upload, Thermometer, XCircle, AlertTriangle, Snowflake, Package, CheckCircle2 } from 'lucide-react';
import { DatetimePicker24h } from './DatetimePicker24h';
import { formatTempNumber } from '../utils/tempGenerator';
import { Button } from './ui/button';
import { Input } from './ui/input';

type FilterMode = 'all' | 'discharged' | 'not_discharged';

type StatCardDef = {
  key: FilterMode;
  icon: React.ReactNode;
  label: string;
  count: number;
  active: string;   // Tailwind classes when selected
  inactive: string; // Tailwind classes when not selected
  iconActive: string;
  iconInactive: string;
};

const FIXED_CREW_ROLES = ['C/O', '2/O', '3/O', '3/E'];

interface ReeferListPanelProps {
  containers: ReeferContainer[];
  selectedContainerId: string | null;
  dischargedCount: number;
  duplicateCount?: number;
  onOpenDuplicateModal?: () => void;
  onSelectContainer: (id: string) => void;
  onAddContainer: (count: number) => void;
  onDeleteContainer: (id: string) => void;
  onUpdateContainer: <K extends keyof ReeferContainer>(id: string, field: K, value: ReeferContainer[K]) => void;
  onOpenImport: () => void;
  onShowTemp: (id: string) => void;
  showTempContainerId: string | null;
}

export const ReeferListPanel: React.FC<ReeferListPanelProps> = ({
  containers,
  selectedContainerId,
  dischargedCount,
  duplicateCount = 0,
  onOpenDuplicateModal,
  onSelectContainer,
  onAddContainer,
  onDeleteContainer,
  onUpdateContainer,
  onOpenImport,
  onShowTemp,
  showTempContainerId,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
  const [selectedDischargePort, setSelectedDischargePort] = useState<string>('');
  const [selectedLoadingPort, setSelectedLoadingPort] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 提取現有冷櫃清單中的所有不重複卸船港口
  const dischargePortOptions = useMemo(() => {
    const ports = new Set<string>();
    containers.forEach((c) => {
      if (c.dischargePort && c.dischargePort.trim()) {
        ports.add(c.dischargePort.trim().toUpperCase());
      }
    });
    return Array.from(ports).sort();
  }, [containers]);

  // 提取現有冷櫃清單中的所有不重複裝船港口
  const loadingPortOptions = useMemo(() => {
    const ports = new Set<string>();
    containers.forEach((c) => {
      if (c.loadingPort && c.loadingPort.trim()) {
        ports.add(c.loadingPort.trim().toUpperCase());
      }
    });
    return Array.from(ports).sort();
  }, [containers]);

  // 計算冷櫃狀態：'discharged' (已卸櫃) | 'onboard' (已上船未卸) | 'waiting' (未裝船)
  const getContainerStatus = (c: ReeferContainer): 'discharged' | 'onboard' | 'waiting' => {
    if (c.dischargeDatetime?.trim()) return 'discharged'; // 已卸櫃 🟢
    if (c.loadingDatetime?.trim()) return 'onboard';     // 已上船未卸 🟡
    return 'waiting';                                     // 未裝船 🔴
  };

  const STATUS_DOT: Record<string, { color: string; title: string }> = {
    discharged: { color: '#22c55e', title: '已卸櫃' },
    onboard: { color: '#f59e0b', title: '已上船未卸櫃' },
    waiting: { color: '#ef4444', title: '未裝船' },
  };

  const isContainerDischarged = (c: ReeferContainer) =>
    !!(c.dischargeDatetime?.trim());

  const filteredContainers = useMemo(() => {
    return containers.filter((c) => {
      // 1. Status Filter Tab
      if (filterMode === 'discharged' && !isContainerDischarged(c)) return false;
      if (filterMode === 'not_discharged' && isContainerDischarged(c)) return false;

      // 2. Discharge Port Filter
      if (selectedDischargePort && c.dischargePort?.trim().toUpperCase() !== selectedDischargePort.toUpperCase()) {
        return false;
      }

      // 3. Loading Port Filter
      if (selectedLoadingPort && c.loadingPort?.trim().toUpperCase() !== selectedLoadingPort.toUpperCase()) {
        return false;
      }

      // 4. Keyword Search (Container Number, Location, or Commodity)
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const matchNo = c.containerNumber?.toLowerCase().includes(kw);
        const matchLoc = c.loadingLocation?.toLowerCase().includes(kw);
        const matchCmd = c.commodity?.toLowerCase().includes(kw);
        if (!matchNo && !matchLoc && !matchCmd) return false;
      }

      return true;
    });
  }, [containers, filterMode, selectedDischargePort, selectedLoadingPort, searchKeyword]);

  const hasActiveFilters = Boolean(selectedDischargePort || selectedLoadingPort || searchKeyword.trim());
  const notDischargedCount = containers.length - dischargedCount;

  const statCards: StatCardDef[] = [
    {
      key: 'all',
      icon: <Snowflake className="w-6 h-6" />,
      label: '全部冷櫃',
      count: containers.length,
      active: 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-200',
      inactive: 'bg-sky-50/80 border-sky-200 text-sky-900 hover:bg-sky-100 hover:border-sky-300',
      iconActive: 'bg-white/20 text-white',
      iconInactive: 'bg-sky-200/70 text-sky-700',
    },
    {
      key: 'not_discharged',
      icon: <Package className="w-6 h-6" />,
      label: '未卸櫃',
      count: notDischargedCount,
      active: 'bg-amber-500 border-amber-400 text-white shadow-md shadow-amber-200',
      inactive: 'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100 hover:border-amber-300',
      iconActive: 'bg-white/20 text-white',
      iconInactive: 'bg-amber-200/70 text-amber-700',
    },
    {
      key: 'discharged',
      icon: <CheckCircle2 className="w-6 h-6" />,
      label: '已卸櫃',
      count: dischargedCount,
      active: 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-200',
      inactive: 'bg-emerald-50/80 border-emerald-200 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300',
      iconActive: 'bg-white/20 text-white',
      iconInactive: 'bg-emerald-200/70 text-emerald-700',
    },
  ];

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const { key, shiftKey } = e;
    const maxCols = 11;

    const focusTargetElement = (targetContainer: HTMLElement | null) => {
      if (!targetContainer) return;
      const targetInput = targetContainer.matches('input, textarea')
        ? targetContainer
        : targetContainer.querySelector<HTMLElement>('input, .MuiInputBase-input, [tabindex="0"]');

      if (targetInput) {
        targetInput.focus();
        if (targetInput instanceof HTMLInputElement || targetInput instanceof HTMLTextAreaElement) {
          targetInput.select();
        }
      } else {
        targetContainer.focus();
      }
    };

    // 1. 上下鍵與 Enter 鍵：固定上下換列
    if (['ArrowUp', 'ArrowDown', 'Enter'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      const card = (e.currentTarget as HTMLElement).closest('.panel-card') || document;
      const targetRow = key === 'ArrowUp' ? rowIndex - 1 : rowIndex + 1;
      const targetContainer = card.querySelector<HTMLElement>(`[data-row="${targetRow}"][data-col="${colIndex}"]`);
      focusTargetElement(targetContainer);
      return;
    }

    // 2. Tab 與 Shift+Tab：前後跳欄
    if (key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      const card = (e.currentTarget as HTMLElement).closest('.panel-card') || document;
      let targetRow = rowIndex;
      let targetCol = shiftKey ? colIndex - 1 : colIndex + 1;

      if (targetCol < 0) {
        targetRow = rowIndex - 1;
        targetCol = maxCols - 1;
      } else if (targetCol >= maxCols) {
        targetRow = rowIndex + 1;
        targetCol = 0;
      }

      const targetContainer = card.querySelector<HTMLElement>(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
      focusTargetElement(targetContainer);
      return;
    }

    // 3. 左右鍵
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const input = e.currentTarget as HTMLInputElement;
      const isMuiSection =
        input.tagName !== 'INPUT' ||
        input.classList?.contains('MuiPickersSectionList-root') ||
        Boolean(input.closest?.('.MuiPickersSectionList-root')) ||
        Boolean(input.closest?.('.MuiInputBase-root'));

      let isAtStart = false;
      let isAtEnd = false;

      if (isMuiSection) {
        isAtStart = true;
        isAtEnd = true;
      } else if ('selectionStart' in input && typeof input.selectionStart === 'number') {
        isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
        isAtEnd = input.selectionStart === (input.value?.length || 0) && input.selectionEnd === (input.value?.length || 0);
      } else {
        isAtStart = true;
        isAtEnd = true;
      }

      if ((key === 'ArrowLeft' && isAtStart) || (key === 'ArrowRight' && isAtEnd)) {
        e.preventDefault();
        e.stopPropagation();
        const card = input.closest('.panel-card') || document;
        const targetCol = key === 'ArrowLeft' ? colIndex - 1 : colIndex + 1;
        const targetContainer = card.querySelector<HTMLElement>(`[data-row="${rowIndex}"][data-col="${targetCol}"]`);
        focusTargetElement(targetContainer);
      }
    }
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title">
          <span className="icon-accent">❆</span> 冷櫃清單 (Reefer Information)
        </div>
      </div>

      <div className="panel-body">
        {/* Crew Chips Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">巡櫃人員：</span>
            <div className="crew-chips-container" style={{ display: 'flex', gap: '6px' }}>
              {FIXED_CREW_ROLES.map((role) => (
                <div
                  key={role}
                  className="inline-flex items-center px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-bold text-slate-600 select-none"
                >
                  {role}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Stat Cards */}
        <div className="grid grid-cols-3 gap-2.5 mt-1">
          {statCards.map(({ key, icon, label, count, active, inactive, iconActive, iconInactive }) => {
            const isActive = filterMode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                className={`relative flex items-center justify-between rounded-xl px-3.5 py-2 text-left border-2 cursor-pointer transition-all ${isActive ? active : inactive}`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-xs font-semibold tracking-wide opacity-90 leading-tight truncate">{label}</span>
                  <span className="text-2xl font-black tracking-tight tabular-nums mt-0.5 leading-none">{count}</span>
                </div>
                <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${isActive ? iconActive : iconInactive}`}>
                  {icon}
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between mt-0.5">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => selectedContainerId && onDeleteContainer(selectedContainerId)}
              disabled={!selectedContainerId || containers.length === 0}
              title="刪除所選櫃號"
              className={selectedContainerId ? 'text-red-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-300'}
            >
              <Trash2 size={15} />
            </Button>

            <span className="text-slate-200">|</span>

            <Button
              size="icon-sm"
              onClick={() => onAddContainer(1)}
              title="新增 1 筆冷櫃"
              className="rounded-full"
            >
              <Plus size={15} />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            {duplicateCount > 0 && (
              <button
                type="button"
                onClick={onOpenDuplicateModal}
                className="h-7 px-2.5 font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-md hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                title="點擊查看裝載位置重複對照詳情"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                位置重複 ({duplicateCount})
              </button>
            )}

            <Button
              variant="outline"
              size="icon-sm"
              title="開啟港口與關鍵字篩選"
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className={[
                'relative',
                showFilterPanel || hasActiveFilters
                  ? 'bg-sky-600 border-sky-600 text-white hover:bg-sky-700 hover:text-white'
                  : 'text-sky-600',
              ].join(' ')}
            >
              <SlidersHorizontal size={14} />
              {hasActiveFilters && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </Button>
          </div>
        </div>

        {/* Port & Keyword Filter Toolbar */}
        {(showFilterPanel || hasActiveFilters) && (
          <div className="bg-slate-50 border border-sky-200 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sky-700 text-[11px] whitespace-nowrap">卸船港:</span>
              <select
                className="h-7 px-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 min-w-21.25"
                value={selectedDischargePort}
                onChange={(e) => setSelectedDischargePort(e.target.value)}
              >
                <option value="">全部卸船港</option>
                {dischargePortOptions.map((port) => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold text-sky-700 text-[11px] whitespace-nowrap">裝船港:</span>
              <select
                className="h-7 px-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 min-w-[85px]"
                value={selectedLoadingPort}
                onChange={(e) => setSelectedLoadingPort(e.target.value)}
              >
                <option value="">全部裝船港</option>
                {loadingPortOptions.map((port) => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 flex-1 min-w-30">
              <span className="font-semibold text-sky-700 text-[11px] whitespace-nowrap">搜尋:</span>
              <Input
                type="text"
                className="h-7 text-xs py-0 px-2"
                placeholder="搜尋櫃號、位置或品名..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-600 px-2"
                onClick={() => {
                  setSelectedDischargePort('');
                  setSelectedLoadingPort('');
                  setSearchKeyword('');
                }}
                title="清除港口與搜尋條件"
              >
                <XCircle size={12} />
                清除篩選
              </Button>
            )}
          </div>
        )}

        {/* Containers Table or Empty State */}
        {containers.length === 0 ? (
          <div className="empty-placeholder">
            <div className="icon-wrapper">
              <PackageSearch size={28} />
            </div>
            <div className="title">目前尚無冷櫃資料</div>
            <div className="desc">請點擊下方按鈕新增冷櫃，或直接匯入 Supercargo / MACS3 文字檔案</div>
            <div className="flex gap-2.5 mt-2">
              <Button size="sm" onClick={() => onAddContainer(1)}>
                <Plus size={14} />
                新增第一筆冷櫃
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenImport}>
                <Upload size={14} />
                匯入檔案
              </Button>
            </div>
          </div>
        ) : filteredContainers.length === 0 ? (
          <div className="empty-placeholder" style={{ minHeight: '120px' }}>
            <div className="title" style={{ fontSize: '13px' }}>
              {hasActiveFilters
                ? `查無符合條件的冷櫃 (${containers.length} 筆資料中無符合者)`
                : filterMode === 'discharged'
                  ? '目前無已卸櫃資料'
                  : '目前無未卸櫃資料'}
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSelectedDischargePort('');
                  setSelectedLoadingPort('');
                  setSearchKeyword('');
                }}
              >
                清除篩選條件
              </Button>
            )}
          </div>
        ) : (
          <div className="data-table-wrapper" style={{ maxHeight: '520px', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '18px', padding: '10px 4px 10px 8px' }}></th>
                  <th style={{ width: '10px' }}>#</th>
                  <th style={{ minWidth: '130px' }}>櫃號</th>
                  <th style={{ minWidth: '80px' }}>裝載位置</th>
                  <th style={{ width: '65px' }}>設定溫℃</th>
                  <th style={{ minWidth: '100px' }}>貨物名稱</th>
                  <th style={{ width: '65px' }}>通風開度%</th>
                  <th style={{ width: '57px' }}>裝船港</th>
                  <th style={{ minWidth: '140px' }}>裝船日期時間</th>
                  <th style={{ width: '65px' }}>裝船溫℃</th>
                  <th style={{ width: '57px' }}>卸船港</th>
                  <th style={{ minWidth: '140px' }}>卸船日期時間</th>
                  <th style={{ width: '65px' }}>卸船溫℃</th>
                  <th style={{ width: '28px', textAlign: 'center' }} title="巡溫記錄">
                    <Thermometer size={13} color="#0ea5e9" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredContainers.map((cnt, index) => {
                  const isSelected = cnt.id === selectedContainerId;
                  const status = getContainerStatus(cnt);
                  const dot = STATUS_DOT[status];

                  return (
                    <tr
                      key={cnt.id}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => onSelectContainer(cnt.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Status Dot */}
                      <td style={{ padding: '8px 4px 8px 8px', textAlign: 'center' }}>
                        <span
                          title={dot.title}
                          style={{
                            display: 'inline-block',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: dot.color,
                            boxShadow: `0 0 4px ${dot.color}88`,
                            flexShrink: 0,
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: '#94a3b8', width: '10px' }}>{index + 1}</td>

                      {/* 櫃號 */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={0}
                          style={{ width: '100%', minWidth: '130px' }}
                          value={cnt.containerNumber}
                          onChange={(e) => onUpdateContainer(cnt.id, 'containerNumber', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 0)}
                          placeholder="請輸入櫃號"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 裝載位置 */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={1}
                          style={{ width: '100%', minWidth: '80px' }}
                          value={cnt.loadingLocation}
                          onChange={(e) => onUpdateContainer(cnt.id, 'loadingLocation', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 1)}
                          placeholder="位置"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 設定溫度℃ */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={2}
                          style={{ width: '65px' }}
                          value={cnt.settingTemp}
                          onChange={(e) => onUpdateContainer(cnt.id, 'settingTemp', e.target.value)}
                          onBlur={(e) => onUpdateContainer(cnt.id, 'settingTemp', formatTempNumber(e.target.value))}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 2)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 貨物名稱 */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={3}
                          style={{ width: '100%', minWidth: '100px' }}
                          value={cnt.commodity}
                          onChange={(e) => onUpdateContainer(cnt.id, 'commodity', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 3)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 通風開度% */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={4}
                          style={{ width: '65px' }}
                          value={cnt.remark1}
                          onChange={(e) => onUpdateContainer(cnt.id, 'remark1', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 4)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 裝船港 */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={5}
                          style={{ width: '57px' }}
                          value={cnt.loadingPort}
                          onChange={(e) => onUpdateContainer(cnt.id, 'loadingPort', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 5)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 裝船日期時間 */}
                      <td style={{ minWidth: '150px' }} onClick={() => onSelectContainer(cnt.id)}>
                        <DatetimePicker24h
                          value={cnt.loadingDatetime}
                          onChange={(val) => onUpdateContainer(cnt.id, 'loadingDatetime', val)}
                          dataRow={index}
                          dataCol={6}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 6)}
                        />
                      </td>

                      {/* 裝船溫℃ */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={7}
                          style={{ width: '65px' }}
                          value={cnt.loadingTemp}
                          onChange={(e) => onUpdateContainer(cnt.id, 'loadingTemp', e.target.value)}
                          onBlur={(e) => onUpdateContainer(cnt.id, 'loadingTemp', formatTempNumber(e.target.value))}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 7)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 卸船港 */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={8}
                          style={{ width: '57px' }}
                          value={cnt.dischargePort}
                          onChange={(e) => onUpdateContainer(cnt.id, 'dischargePort', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 8)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 卸船日期時間 */}
                      <td style={{ minWidth: '150px' }} onClick={() => onSelectContainer(cnt.id)}>
                        <DatetimePicker24h
                          value={cnt.dischargeDatetime}
                          onChange={(val) => onUpdateContainer(cnt.id, 'dischargeDatetime', val)}
                          dataRow={index}
                          dataCol={9}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 9)}
                        />
                      </td>

                      {/* 卸船溫℃ */}
                      <td>
                        <Input
                          type="text"
                          data-row={index}
                          data-col={10}
                          style={{ width: '65px' }}
                          value={cnt.dischargeTemp}
                          onChange={(e) => onUpdateContainer(cnt.id, 'dischargeTemp', e.target.value)}
                          onBlur={(e) => onUpdateContainer(cnt.id, 'dischargeTemp', formatTempNumber(e.target.value))}
                          onKeyDown={(e) => handleInputKeyDown(e, index, 10)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 巡溫紀錄按鈕 */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          title="查看每日溫度記錄"
                          className={[
                            'border-0 cursor-pointer rounded px-1 py-0.5 transition-colors',
                            cnt.id === showTempContainerId ? 'bg-sky-100' : 'bg-transparent hover:bg-slate-100',
                          ].join(' ')}
                          onClick={(e) => {
                            e.stopPropagation();
                            onShowTemp(cnt.id);
                          }}
                        >
                          <Thermometer size={14} color={cnt.id === showTempContainerId ? '#0ea5e9' : '#94a3b8'} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
