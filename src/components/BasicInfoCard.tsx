import React from 'react';
import { Printer, Ship, FileCheck } from 'lucide-react';

interface BasicInfoCardProps {
  vesselStatus: 'own vessel' | 'chartered vessel';
  voyage: string;
  printType: 'LOADPRINT' | 'DISCHARGEPRINT';
  printPortInput: string;
  totalCash?: number;
  longCount?: number;
  shortCount?: number;
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
  totalCash,
  longCount,
  shortCount,
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
        <div className="config-card-body">
          <div className="config-item">
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

          <div className="config-item">
            <span className="form-label">航次 (Voyage)：</span>
            <input
              type="text"
              className="input-control"
              style={{ width: '150px' }}
              value={voyage}
              onChange={(e) => onVoyageChange(e.target.value)}
              placeholder="請輸入航次"
            />
          </div>
        </div>
      </div>

      {/* 船岸交接單 Card */}
      <div className="config-card">
        <span className="config-card-tag">船岸交接單 (HANDOVER FORM)</span>
        <div className="config-card-body">
          <div className="config-item">
            <FileCheck size={16} color="#0284c7" />
            <select
              className="input-control"
              style={{ width: '130px' }}
              value={printType}
              onChange={(e) => onPrintTypeChange(e.target.value as 'LOADPRINT' | 'DISCHARGEPRINT')}
            >
              <option value="LOADPRINT">Loading</option>
              <option value="DISCHARGEPRINT">Discharge</option>
            </select>
          </div>

          <div className="config-item">
            <span className="form-label">交接港口：</span>
            <input
              type="text"
              className="input-control"
              style={{ width: '120px' }}
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

      {/* 總金額 Badge Card (位置改移至船岸交接單右側) */}
      {totalCash !== undefined && (
        <div className="badge-total-cash" style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          <span className="amount">總金額 : ${totalCash} NTD</span>
          <span className="subtext">
            長程櫃: {longCount || 0} ｜ 短程櫃: {shortCount || 0}
          </span>
        </div>
      )}
    </div>
  );
};
