import React, { useState, useMemo } from 'react';
import { ReeferContainer } from '../types/reefer';
import { Plus, Trash2, SlidersHorizontal, PackageSearch, Upload, Thermometer, XCircle } from 'lucide-react';
import { DatetimePicker24h } from './DatetimePicker24h';
import { formatTempNumber } from '../utils/tempGenerator';

type FilterMode = 'all' | 'discharged' | 'not_discharged';

const FIXED_CREW_ROLES = ['C/O', '2/O', '3/O', '3/E'];

interface ReeferListPanelProps {
  containers: ReeferContainer[];
  selectedContainerId: string | null;
  dischargedCount: number;
  onSelectContainer: (id: string) => void;
  onAddContainer: (count: number) => void;
  onDeleteContainer: (id: string) => void;
  onUpdateContainer: (id: string, field: keyof ReeferContainer, value: any) => void;
  onOpenImport: () => void;
  onShowTemp: (id: string) => void;
  showTempContainerId: string | null;
}

export const ReeferListPanel: React.FC<ReeferListPanelProps> = ({
  containers,
  selectedContainerId,
  dischargedCount,
  onSelectContainer,
  onAddContainer,
  onDeleteContainer,
  onUpdateContainer,
  onOpenImport,
  onShowTemp,
  showTempContainerId,
}) => {
  const [quickAddCount, setQuickAddCount] = useState<number>(5);
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
    if (c.dischargeDatetime?.trim()) return 'discharged'; // 已卸櫃 🔴
    if (c.loadingDatetime?.trim()) return 'onboard';     // 已上船未卸 🟡
    return 'waiting';                                     // 未裝船 🟢
  };

  const STATUS_DOT: Record<string, { color: string; title: string }> = {
    discharged: { color: '#ef4444', title: '已卸櫃' },
    onboard: { color: '#f59e0b', title: '已上船未卸櫃' },
    waiting: { color: '#22c55e', title: '未裝船' },
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

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title">
          <span className="icon-accent">❆</span> 冷櫃清單 (Reefer Information)
        </div>
      </div>

      <div className="panel-body">
        {/* KPI Summary Badges & Crew Chips Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          {/* Crew Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
              巡櫃人員：
            </span>
            <div className="crew-chips-container" style={{ display: 'flex', gap: '6px' }}>
              {FIXED_CREW_ROLES.map((role) => (
                <div
                  key={role}
                  className="crew-chip"
                  style={{
                    cursor: 'default',
                    userSelect: 'none',
                    padding: '4px 10px',
                    fontWeight: 700,
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#334155',
                  }}
                >
                  {role}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Tabs: 全部 / 已卸櫃 / 未卸櫃 */}
        <div style={{ display: 'flex', gap: '0', marginTop: '4px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', fontSize: '12px' }}>
          {(
            [
              { key: 'all', label: `全部 (${containers.length})` },
              { key: 'not_discharged', label: `未卸櫃 (${notDischargedCount})` },
              { key: 'discharged', label: `已卸櫃 (${dischargedCount})` },
            ] as { key: FilterMode; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterMode(key)}
              style={{
                flex: 1,
                padding: '6px 4px',
                border: 'none',
                borderRight: key !== 'discharged' ? '1px solid #e2e8f0' : 'none',
                background: filterMode === key ? '#0284c7' : 'transparent',
                color: filterMode === key ? '#ffffff' : '#475569',
                fontWeight: filterMode === key ? 700 : 500,
                cursor: 'pointer',
                fontSize: '11px',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-icon-only"
              onClick={() => selectedContainerId && onDeleteContainer(selectedContainerId)}
              disabled={!selectedContainerId || containers.length === 0}
              title="刪除所選櫃號"
              style={{ color: selectedContainerId ? '#ef4444' : '#cbd5e1' }}
            >
              <Trash2 size={16} />
            </button>

            <span style={{ color: '#e2e8f0' }}>|</span>

            <button
              className="btn btn-primary btn-circle"
              onClick={() => onAddContainer(1)}
              title="新增 1 筆冷櫃"
            >
              <Plus size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
              <span>快速新增 →</span>
              <input
                type="number"
                className="input-control"
                style={{ width: '48px', height: '28px', textAlign: 'center' }}
                value={quickAddCount}
                onChange={(e) => setQuickAddCount(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
              />
              <button
                className="btn btn-primary"
                style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                onClick={() => onAddContainer(quickAddCount)}
              >
                新增
              </button>
            </div>
          </div>

          <button
            className="btn btn-icon-only"
            title="開啟港口與關鍵字篩選"
            onClick={() => setShowFilterPanel((prev) => !prev)}
            style={{
              background: showFilterPanel || hasActiveFilters ? '#0284c7' : 'transparent',
              borderColor: showFilterPanel || hasActiveFilters ? '#0284c7' : '#cbd5e1',
              color: showFilterPanel || hasActiveFilters ? '#ffffff' : '#0284c7',
              position: 'relative',
            }}
          >
            <SlidersHorizontal size={15} />
            {hasActiveFilters && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#ef4444',
                }}
              />
            )}
          </button>
        </div>

        {/* Port & Keyword Filter Toolbar */}
        {(showFilterPanel || hasActiveFilters) && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              padding: '8px 10px',
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: '#0369a1', fontSize: '11px', whiteSpace: 'nowrap' }}>卸船港:</span>
              <select
                className="input-control"
                style={{ height: '26px', fontSize: '12px', padding: '0 4px', minWidth: '85px' }}
                value={selectedDischargePort}
                onChange={(e) => setSelectedDischargePort(e.target.value)}
              >
                <option value="">全部卸船港</option>
                {dischargePortOptions.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: '#0369a1', fontSize: '11px', whiteSpace: 'nowrap' }}>裝船港:</span>
              <select
                className="input-control"
                style={{ height: '26px', fontSize: '12px', padding: '0 4px', minWidth: '85px' }}
                value={selectedLoadingPort}
                onChange={(e) => setSelectedLoadingPort(e.target.value)}
              >
                <option value="">全部裝船港</option>
                {loadingPortOptions.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '120px' }}>
              <span style={{ fontWeight: 600, color: '#0369a1', fontSize: '11px', whiteSpace: 'nowrap' }}>搜尋:</span>
              <input
                type="text"
                className="input-control"
                style={{ height: '26px', fontSize: '12px', padding: '2px 6px', width: '100%' }}
                placeholder="搜尋櫃號、位置或品名..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn"
                style={{
                  height: '26px',
                  fontSize: '11px',
                  padding: '0 8px',
                  color: '#ef4444',
                  borderColor: '#fca5a5',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
                onClick={() => {
                  setSelectedDischargePort('');
                  setSelectedLoadingPort('');
                  setSearchKeyword('');
                }}
                title="清除港口與搜尋條件"
              >
                <XCircle size={12} />
                清除篩選
              </button>
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
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button className="btn btn-primary" onClick={() => onAddContainer(1)}>
                <Plus size={14} />
                新增第一筆冷櫃
              </button>
              <button className="btn" onClick={onOpenImport}>
                <Upload size={14} />
                匯入檔案
              </button>
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
              <button
                className="btn"
                style={{ marginTop: '8px', fontSize: '12px' }}
                onClick={() => {
                  setSelectedDischargePort('');
                  setSelectedLoadingPort('');
                  setSearchKeyword('');
                }}
              >
                清除篩選條件
              </button>
            )}
          </div>
        ) : (
          <div className="data-table-wrapper" style={{ maxHeight: '520px', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '18px', padding: '10px 4px 10px 8px' }}></th>
                  <th style={{ width: '10px' }}>#</th>
                  <th style={{ minWidth: '95px' }}>櫃號</th>
                  <th style={{ minWidth: '65px' }}>裝載位置</th>
                  <th style={{ width: '52px' }}>設定溫℃</th>
                  <th style={{ minWidth: '100px' }}>貨物名稱</th>
                  <th style={{ width: '65px' }}>通風開度%</th>
                  <th style={{ width: '48px' }}>裝船港</th>
                  <th style={{ minWidth: '140px' }}>裝船日期時間</th>
                  <th style={{ width: '50px' }}>裝船溫℃</th>
                  <th style={{ width: '48px' }}>卸船港</th>
                  <th style={{ minWidth: '140px' }}>卸船日期時間</th>
                  <th style={{ width: '50px' }}>卸船溫℃</th>
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
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '100%', minWidth: '95px' }}
                          value={cnt.containerNumber}
                          onChange={(e) => onUpdateContainer(cnt.id, 'containerNumber', e.target.value)}
                          placeholder="請輸入櫃號"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 裝載位置 */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '100%', minWidth: '65px' }}
                          value={cnt.loadingLocation}
                          onChange={(e) => onUpdateContainer(cnt.id, 'loadingLocation', e.target.value)}
                          placeholder="位置"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 設定溫度℃ */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '52px' }}
                          value={cnt.settingTemp}
                          onChange={(e) => onUpdateContainer(cnt.id, 'settingTemp', e.target.value)}
                          onBlur={(e) => onUpdateContainer(cnt.id, 'settingTemp', formatTempNumber(e.target.value))}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 貨物名稱 */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '100%', minWidth: '100px' }}
                          value={cnt.commodity}
                          onChange={(e) => onUpdateContainer(cnt.id, 'commodity', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 通風開度% */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '65px' }}
                          value={cnt.remark1}
                          onChange={(e) => onUpdateContainer(cnt.id, 'remark1', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 裝船港 */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '48px' }}
                          value={cnt.loadingPort}
                          onChange={(e) => onUpdateContainer(cnt.id, 'loadingPort', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 裝船日期時間 */}
                      <td style={{ minWidth: '150px' }} onClick={(e) => { e.stopPropagation(); onSelectContainer(cnt.id); }}>
                        <DatetimePicker24h
                          value={cnt.loadingDatetime}
                          onChange={(val) => onUpdateContainer(cnt.id, 'loadingDatetime', val)}
                        />
                      </td>

                      {/* 裝船溫℃ */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '50px' }}
                          value={cnt.loadingTemp}
                          onChange={(e) => onUpdateContainer(cnt.id, 'loadingTemp', e.target.value)}
                          onBlur={(e) => onUpdateContainer(cnt.id, 'loadingTemp', formatTempNumber(e.target.value))}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 卸船港 */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '48px' }}
                          value={cnt.dischargePort}
                          onChange={(e) => onUpdateContainer(cnt.id, 'dischargePort', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContainer(cnt.id);
                          }}
                        />
                      </td>

                      {/* 卸船日期時間 */}
                      <td style={{ minWidth: '150px' }} onClick={(e) => { e.stopPropagation(); onSelectContainer(cnt.id); }}>
                        <DatetimePicker24h
                          value={cnt.dischargeDatetime}
                          onChange={(val) => onUpdateContainer(cnt.id, 'dischargeDatetime', val)}
                        />
                      </td>

                      {/* 卸船溫℃ */}
                      <td>
                        <input
                          type="text"
                          className="input-control"
                          style={{ height: '28px', fontSize: '12px', padding: '2px 6px', width: '50px' }}
                          value={cnt.dischargeTemp}
                          onChange={(e) => onUpdateContainer(cnt.id, 'dischargeTemp', e.target.value)}
                          onBlur={(e) => onUpdateContainer(cnt.id, 'dischargeTemp', formatTempNumber(e.target.value))}
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
                          style={{
                            border: 'none',
                            background: cnt.id === showTempContainerId ? 'rgba(14,165,233,0.12)' : 'transparent',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            padding: '2px 4px',
                          }}
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
