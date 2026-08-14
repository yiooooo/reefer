import React from 'react';
import { Printer, Ship, FileCheck } from 'lucide-react';

interface BasicInfoCardProps {
  vesselStatus: 'own vessel' | 'chartered vessel';
  voyage: string;
  printType: 'LOADPRINT' | 'DISCHARGEPRINT';
  printPortInput: string;
  onVesselStatusChange: (status: 'own vessel' | 'chartered vessel') => void;
  onVoyageChange: (voyage: string) => void;
  onPrintTypeChange: (type: 'LOADPRINT' | 'DISCHARGEPRINT') => void;
  onPrintPortInputChange: (port: string) => void;
  onPrint: () => void;
}

export const BasicInfoCard: React.FC<BasicInfoCardProps> = ({
  vesselStatus,
  voyage,
  printType,
  printPortInput,
  onVesselStatusChange,
  onVoyageChange,
  onPrintTypeChange,
  onPrintPortInputChange,
  onPrint,
}) => {
  return (
    <div className="top-config-bar">
      {/* 基本資訊 Card */}
      <div className="config-card">
        <span className="config-card-tag">基本資訊 (BASIC INFO)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Ship size={16} color="#64748b" />
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${vesselStatus === 'own vessel' ? 'active' : ''}`}
              onClick={() => onVesselStatusChange('own vessel')}
            >
              自有船
            </button>
            <button
              type="button"
              className={`segmented-btn ${vesselStatus === 'chartered vessel' ? 'active' : ''}`}
              onClick={() => onVesselStatusChange('chartered vessel')}
            >
              出租船
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
          <span className="form-label">航次 (Voyage)：</span>
          <input
            type="text"
            className="input-control"
            style={{ width: '160px' }}
            value={voyage}
            onChange={(e) => onVoyageChange(e.target.value)}
            placeholder="請輸入航次"
          />
        </div>
      </div>

      {/* 船岸交接單 Card (With Input Box!) */}
      <div className="config-card">
        <span className="config-card-tag">船岸交接單 (HANDOVER FORM)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileCheck size={16} color="#0284c7" />
          <select
            className="input-control"
            style={{ width: '130px' }}
            value={printType}
            onChange={(e) => onPrintTypeChange(e.target.value as 'LOADPRINT' | 'DISCHARGEPRINT')}
          >
            <option value="LOADPRINT">Loading (裝船)</option>
            <option value="DISCHARGEPRINT">Discharge (卸船)</option>
          </select>
        </div>

        {/* 交接港口輸入框 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="form-label">交接港口：</span>
          <input
            type="text"
            className="input-control"
            style={{ width: '130px' }}
            value={printPortInput}
            onChange={(e) => onPrintPortInputChange(e.target.value)}
            placeholder="e.g. KHH / NGO"
          />
        </div>

        <button className="btn btn-primary" onClick={onPrint} title="列印船岸交接單">
          <Printer size={15} />
          列印交接單
        </button>
      </div>
    </div>
  );
};
