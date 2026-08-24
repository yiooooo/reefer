import React from 'react';
import { ReeferContainer, TempRecord } from '../types/reefer';
import { Plus, Trash2, Zap, X } from 'lucide-react';
import { DatetimePicker24h } from './DatetimePicker24h';
import { formatTempNumber } from '../utils/tempGenerator';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useTranslation } from '../i18n/LanguageContext';

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
  const { t } = useTranslation();

  if (!selectedContainer) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <span className="icon-accent">📎</span> {t('tempRecord.panelTitle')}
          </div>
        </div>
        <div className="empty-placeholder">
          <div className="icon-wrapper">
            <Zap size={28} />
          </div>
          <div className="title">{t('tempRecord.emptyTitle')}</div>
          <div className="desc">{t('tempRecord.emptyDesc')}</div>
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
          <span className="icon-accent">📎</span> {t('tempRecord.panelTitle')}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          title={t('tempRecord.closeTitle')}
          className="text-slate-400 hover:text-slate-600"
        >
          <X size={15} />
        </Button>
      </div>

      <div className="panel-body">
        {/* Badges & Auto-Gen Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="success">
              {t('tempRecord.recordDays')}: {selectedContainer.days || daysCount} ({daysCount} {t('tempRecord.recordsCount')})
            </Badge>
            <Badge variant="indigo">
              {t('tempRecord.bonusAmount')}: ${bonusCash} NTD
            </Badge>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {/* Single container auto-generate */}
            <Button
              disabled={!hasDatetimes}
              onClick={() => hasDatetimes && onAutoGenerateTemp(selectedContainer.id)}
              title={hasDatetimes ? t('tempRecord.autoGenSingleTitle') : t('tempRecord.autoGenSingleDisabledTitle')}
              className={hasDatetimes
                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                : ''}
            >
              <Zap size={13} />
              {t('tempRecord.autoGenSingle')}
            </Button>

            {/* Batch all containers auto-generate */}
            <Button
              onClick={onAutoGenerateAllTemp}
              title={t('tempRecord.autoGenAllTitle')}
            >
              <Zap size={13} />
              {t('tempRecord.autoGenAll')}
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="icon-sm"
            onClick={() => onAddTempRecord(selectedContainer.id, 1)}
            title={t('tempRecord.addRecordTitle')}
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
                <th>{t('tempRecord.recordDate')}</th>
                <th>{t('tempRecord.df1')}<br /><span className="text-[10px] opacity-75 font-normal">({t('tempRecord.time8')})</span></th>
                <th>{t('tempRecord.df2')}<br /><span className="text-[10px] opacity-75 font-normal">({t('tempRecord.time16')})</span></th>
                <th>{t('tempRecord.df3')}<br /><span className="text-[10px] opacity-75 font-normal">({t('tempRecord.time24')})</span></th>
                <th>{t('table.commodity')}</th>
                <th style={{ width: '30px' }}></th>
              </tr>
            </thead>
            <tbody>
              {selectedContainer.tempRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                    {t('tempRecord.noRecordsPrompt')}
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
                        title={t('tempRecord.deleteRecordTitle')}
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
