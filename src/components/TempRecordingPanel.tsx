import React from 'react';
import { ReeferContainer, TempRecord } from '../types/reefer';
import { Plus, Trash2, Zap, X } from 'lucide-react';
import { DatetimePicker24h } from './DatetimePicker24h';
import { formatTempNumber } from '../utils/tempGenerator';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface TempRecordingPanelProps {
  selectedContainer: ReeferContainer | null;
  onAddTempRecord: (containerId: string, count: number) => void;
  onDeleteTempRecord: (containerId: string, recordId: string) => void;
  onUpdateTempRecord: <K extends keyof TempRecord>(containerId: string, recordId: string, field: K, value: TempRecord[K]) => void;
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
  if (!selectedContainer) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <span className="icon-accent">📎</span> 每日溫度記錄 (Temperature Recording)
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
  const hasDatetimes = !!selectedContainer.loadingDatetime && !!selectedContainer.dischargeDatetime;

  return (
    <div className="panel-card">
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title">
          <span className="icon-accent">📎</span> 每日溫度記錄 (Temperature Recording)
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          title="關閉溫度記錄"
          className="text-slate-400 hover:text-slate-600"
        >
          <X size={15} />
        </Button>
      </div>

      <div className="panel-body">
        {/* Badges & Auto-Gen Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="success" title={`航程涵蓋 ${selectedContainer.days || daysCount} 天，已紀錄 ${daysCount} 筆巡溫`}>
              紀錄天數: {selectedContainer.days || daysCount} 天 ({daysCount} 筆)
            </Badge>
            <Badge variant="indigo">
              計算獎金: ${bonusCash} NTD
            </Badge>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {/* Single container auto-generate */}
            <Button
              disabled={!hasDatetimes}
              onClick={() => hasDatetimes && onAutoGenerateTemp(selectedContainer.id)}
              title={hasDatetimes
                ? '依設定溫度 (±0.5°C) 及裝卸時間範圍，一鍵自動產生此櫃巡溫紀錄'
                : '請先同時填寫裝船與卸船日期時間方可自動生成溫度'}
              className={hasDatetimes
                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                : ''}
            >
              <Zap size={13} />
              自動生成
            </Button>

            {/* Batch all containers auto-generate */}
            <Button
              onClick={onAutoGenerateAllTemp}
              title="對整筆清單中所有已填寫卸船日期時間的冷櫃，一次批次自動生成巡溫紀錄"
            >
              <Zap size={13} />
              全部清單生成
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="icon-sm"
            onClick={() => onAddTempRecord(selectedContainer.id, 1)}
            title="新增 1 筆空白記錄"
            className="rounded-full"
          >
            <Plus size={15} />
          </Button>
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
              {selectedContainer.tempRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                    尚無巡溫紀錄。可填寫裝卸船時間點擊「自動生成」，或點擊右上方「+」按鈕手動新增。
                  </td>
                </tr>
              ) : (
                selectedContainer.tempRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <DatetimePicker24h
                        value={rec.dateLog}
                        onChange={(val) => onUpdateTempRecord(selectedContainer.id, rec.id, 'dateLog', val)}
                        showTime={false}
                      />
                    </td>
                    <td>
                      <Input
                        type="text"
                        className="w-16"
                        value={rec.df1}
                        onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df1', e.target.value)}
                        onBlur={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df1', formatTempNumber(e.target.value))}
                      />
                    </td>
                    <td>
                      <Input
                        type="text"
                        className="w-16"
                        value={rec.df2}
                        onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df2', e.target.value)}
                        onBlur={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df2', formatTempNumber(e.target.value))}
                      />
                    </td>
                    <td>
                      <Input
                        type="text"
                        className="w-16"
                        value={rec.df3}
                        onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df3', e.target.value)}
                        onBlur={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'df3', formatTempNumber(e.target.value))}
                      />
                    </td>
                    <td>
                      <Input
                        type="text"
                        className="min-w-10"
                        value={rec.remark}
                        onChange={(e) => onUpdateTempRecord(selectedContainer.id, rec.id, 'remark', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onDeleteTempRecord(selectedContainer.id, rec.id)}
                        title="刪除記錄"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
