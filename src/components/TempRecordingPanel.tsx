import React, { useState } from 'react';
import { ReeferContainer, TempRecord } from '../types/reefer';
import { Plus, Trash2, Zap, X } from 'lucide-react';

interface TempRecordingPanelProps {
  selectedContainer: ReeferContainer | null;
  onAddTempRecord: (containerId: string, count: number) => void;
  onDeleteTempRecord: (containerId: string, recordId: string) => void;
  onUpdateTempRecord: (containerId: string, recordId: string, field: keyof TempRecord, value: any) => void;
  onAutoGenerateTemp: (containerId: string) => void;
  onAutoGenerateAllTemp: () => void;
  onClose: () => void;
}

export const TempRecordingPanel: React.FC<TempRecordingPanelProps> = ({
  selectedContainer,
  onAddTempRecord,
  onDeleteTempRecord,
  onUpdateTempRecord,
  onAutoGenerateTemp,
  onAutoGenerateAllTemp,
  onClose,
}) => {
  const [quickAddCount, setQuickAddCount] = useState<number>(5);

  if (!selectedContainer) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <span className="icon-accent">📎</span> 每日溫度記錄 (Temperature Logs)
          </div>
        </div>
        <div className="empty-placeholder">
          <div className="icon-wrapper">
            <Zap size={28} />
          </div>
          <div className="title">尚未選擇冷櫃</div>
          <div className="desc">請先從左側選擇冷櫃，以填寫或一鍵自動生成每日 08:00, 16:00, 23:59 巡櫃溫度紀錄</div>
        </div>
      </div>
    );
  }

  const daysCount = selectedContainer.tempRecords.length;
  const bonusCash = selectedContainer.cash;
  const hasDischargeDate = !!selectedContainer.dischargeDatetime;

  return (
    <div className="panel-card">
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title">
          <span className="icon-accent">📎</span> 每日溫度記錄 (Temperature Logs)
        </div>
        <button
          type="button"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
          onClick={onClose}
          title="關閉溫度記錄"
        >
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        {/* Badges & Auto-Gen Toolbar Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge-pill-cyan">
              紀錄天數: {daysCount} 天
            </span>
            <span className="badge-pill-indigo">
              計算獎金: ${bonusCash} NTD
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {/* Single container auto-generate */}
            <button
              className="btn btn-primary"
              style={{
                background: hasDischargeDate
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#cbd5e1',
                borderColor: hasDischargeDate ? '#10b981' : '#cbd5e1',
                color: '#ffffff',
                boxShadow: hasDischargeDate ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                cursor: hasDischargeDate ? 'pointer' : 'not-allowed',
                opacity: hasDischargeDate ? 1 : 0.6,
              }}
              onClick={() => hasDischargeDate && onAutoGenerateTemp(selectedContainer.id)}
              disabled={!hasDischargeDate}
              title={hasDischargeDate
                ? '依設定溫度 (±0.5°C) 及裝卸時間範圍，一鍵自動產生此櫃巡溫紀錄'
                : '請先填寫卸船日期時間方可自動生成溫度'}
            >
              <Zap size={14} />
              自動生成
            </button>

            {/* Batch all containers auto-generate */}
            <button
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                borderColor: '#0284c7',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              }}
              onClick={onAutoGenerateAllTemp}
              title="對整筆清單中所有已填寫卸船日期時間的冷櫃，一次批次自動生成巡溫紀錄"
            >
              <Zap size={14} />
              全部生成
            </button>
          </div>
        </div>

        {/* Quick Add Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            className="btn btn-primary btn-circle"
            onClick={() => onAddTempRecord(selectedContainer.id, 1)}
            title="新增 1 筆空白記錄"
          >
            <Plus size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' }}>
            <span>快速新增 →</span>
            <input
              type="number"
              className="input-control"
              style={{ width: '48px', height: '28px', textAlign: 'center' }}
              value={quickAddCount}
              onChange={(e) => setQuickAddCount(parseInt(e.target.value) || 1)}
              min={1}
              max={30}
            />
            <button
              className="btn btn-primary"
              style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
              onClick={() => onAddTempRecord(selectedContainer.id, quickAddCount)}
            >
              新增
            </button>
          </div>
        </div>

        {/* Temperature Log Table */}
        <div className="data-table-wrapper" style={{ maxHeight: '380px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>溫度記錄<br />(08:00)</th>
                <th>溫度記錄<br />(16:00)</th>
                <th>溫度記錄<br />(23:59)</th>
                <th>備註</th>
                <th style={{ width: '30px' }}></th>
              </tr>
            </thead>
            <tbody>
              {selectedContainer.tempRecords.map((rec) => (
                <tr key={rec.id}>
                  <td>
                    <input
                      type="date"
                      className="input-control"
                      style={{ height: '28px', fontSize: '11px', padding: '2px 4px', width: '120px' }}
                      value={rec.dateLog}
                      onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'dateLog', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-control"
                      style={{ height: '28px', fontSize: '12px', padding: '2px 4px', width: '48px' }}
                      value={rec.df1}
                      onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df1', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-control"
                      style={{ height: '28px', fontSize: '12px', padding: '2px 4px', width: '48px' }}
                      value={rec.df2}
                      onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df2', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-control"
                      style={{ height: '28px', fontSize: '12px', padding: '2px 4px', width: '48px' }}
                      value={rec.df3}
                      onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df3', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-control"
                      style={{ height: '28px', fontSize: '12px', padding: '2px 4px' }}
                      value={rec.remark}
                      onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'remark', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                      onClick={() => onDeleteTempRecord(selectedContainer.id, rec.id)}
                      title="刪除記錄"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
