import React from 'react';
import { ReeferContainer } from '../types/reefer';
import { Edit3 } from 'lucide-react';
import { DatetimePicker24h } from './DatetimePicker24h';

const FIXED_CREW_ROLES = ['C/O', '2/O', '3/O', '3/E'];

interface ReeferDetailPanelProps {
  selectedContainer: ReeferContainer | null;
  onUpdateContainer: (id: string, field: keyof ReeferContainer, value: any) => void;
}

export const ReeferDetailPanel: React.FC<ReeferDetailPanelProps> = ({
  selectedContainer,
  onUpdateContainer,
}) => {
  if (!selectedContainer) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="panel-header">
          <div className="panel-title">
            <span className="icon-accent">✎</span> 冷櫃明細與巡櫃人員 (Details)
          </div>
        </div>
        <div className="empty-placeholder">
          <div className="icon-wrapper"><Edit3 size={28} /></div>
          <div className="title">尚未選擇冷櫃</div>
          <div className="desc">請從左側點擊冷櫃列表以顯示明細與每日溫度記錄</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel Header: Crew chips on left */}
      <div className="panel-header" style={{ gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
            巡櫃人員：
          </span>
          <div className="crew-chips-container">
            {FIXED_CREW_ROLES.map((role) => (
              <div key={role} className="crew-chip"
                style={{ cursor: 'default', userSelect: 'none', padding: '3px 10px', fontWeight: 700 }}
              >
                {role}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Selected Container Badge Header */}
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#0369a1', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7' }}>
              當前櫃號：{selectedContainer.containerNumber || '(尚未填寫櫃號)'}
            </span>
            <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              位置：{selectedContainer.loadingLocation || '未填'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', color: '#334155', marginTop: '2px', borderTop: '1px dashed #bae6fd', paddingTop: '6px' }}>
            <span>裝船港：<strong style={{ color: '#0284c7' }}>{selectedContainer.loadingPort || '未填'}</strong></span>
            <span>卸船港：<strong style={{ color: '#0284c7' }}>{selectedContainer.dischargePort || '未填'}</strong></span>
          </div>
        </div>

        {/* 貨物名稱 & 通風開度 % */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">貨物名稱</label>
            <input
              type="text"
              className="input-control"
              value={selectedContainer.commodity}
              onChange={(e) => onUpdateContainer(selectedContainer.id, 'commodity', e.target.value)}
              placeholder="e.g. FROZEN FISH"
            />
          </div>
          <div className="form-group">
            <label className="form-label">通風開度 %</label>
            <input
              type="text"
              className="input-control"
              value={selectedContainer.remark1}
              onChange={(e) => onUpdateContainer(selectedContainer.id, 'remark1', e.target.value)}
              placeholder="e.g. CLOSE / 15%"
            />
          </div>
        </div>

        {/* 裝船日期時間 & 卸船日期時間 (24小時制: YYYY/MM/DD HH:mm) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">裝船日期時間</label>
            <DatetimePicker24h
              value={selectedContainer.loadingDatetime}
              onChange={(val) => onUpdateContainer(selectedContainer.id, 'loadingDatetime', val)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">卸船日期時間</label>
            <DatetimePicker24h
              value={selectedContainer.dischargeDatetime}
              onChange={(val) => onUpdateContainer(selectedContainer.id, 'dischargeDatetime', val)}
            />
          </div>
        </div>

        {/* 裝船溫度 & 卸船溫度 (RWD Auto-wrap) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">裝船溫度 (°C)</label>
            <input
              type="text"
              className="input-control"
              value={selectedContainer.loadingTemp}
              onChange={(e) => onUpdateContainer(selectedContainer.id, 'loadingTemp', e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
          <div className="form-group">
            <label className="form-label">卸船溫度 (°C)</label>
            <input
              type="text"
              className="input-control"
              value={selectedContainer.dischargeTemp}
              onChange={(e) => onUpdateContainer(selectedContainer.id, 'dischargeTemp', e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
