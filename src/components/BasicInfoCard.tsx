import React, { useMemo, useEffect } from 'react';
import { Printer, Ship, FileCheck } from 'lucide-react';
import { ReeferContainer } from '../types/reefer';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';

interface BasicInfoCardProps {
  vesselStatus: 'own vessel' | 'chartered vessel';
  voyage: string;
  printType: 'LOADPRINT' | 'DISCHARGEPRINT';
  printPortInput: string;
  containers?: ReeferContainer[];
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
  containers = [],
  totalCash,
  longCount,
  shortCount,
  onVesselStatusChange,
  onVoyageChange,
  onPrintTypeChange,
  onPrintPortInputChange,
  onPrint,
}) => {
  // 自動從冷櫃資料判讀不重複的「裝貨港」
  const loadingPorts = useMemo(() => {
    const ports = new Set<string>();
    containers.forEach((c) => {
      if (c.loadingPort && c.loadingPort.trim()) {
        ports.add(c.loadingPort.trim().toUpperCase());
      }
    });
    return Array.from(ports).sort();
  }, [containers]);

  // 自動從冷櫃資料判讀不重複的「卸貨港」
  const dischargePorts = useMemo(() => {
    const ports = new Set<string>();
    containers.forEach((c) => {
      if (c.dischargePort && c.dischargePort.trim()) {
        ports.add(c.dischargePort.trim().toUpperCase());
      }
    });
    return Array.from(ports).sort();
  }, [containers]);

  // 依據目前交接單模式 (Loading 裝船 / Discharge 卸船) 決定可用的港口清單
  const availablePorts = printType === 'LOADPRINT' ? loadingPorts : dischargePorts;

  // 當交接單模式切換 或 港口清單變化時，自動預設第一筆可用港口
  useEffect(() => {
    if (availablePorts.length > 0) {
      const currentUpper = printPortInput ? printPortInput.trim().toUpperCase() : '';
      if (!currentUpper || !availablePorts.includes(currentUpper)) {
        onPrintPortInputChange(availablePorts[0]);
      }
    }
  }, [availablePorts, printPortInput, onPrintPortInputChange]);

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
            <Label className="whitespace-nowrap">航次 (Voyage)：</Label>
            <Input
              type="text"
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
              className="h-8.5 px-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
              style={{ width: '130px' }}
              value={printType}
              onChange={(e) => onPrintTypeChange(e.target.value as 'LOADPRINT' | 'DISCHARGEPRINT')}
            >
              <option value="LOADPRINT">Loading</option>
              <option value="DISCHARGEPRINT">Discharge</option>
            </select>
          </div>

          <div className="config-item">
            <Label className="whitespace-nowrap">交接港口：</Label>
            <select
              className="h-8.5 px-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
              style={{ width: '130px' }}
              value={printPortInput}
              onChange={(e) => onPrintPortInputChange(e.target.value)}
            >
              {availablePorts.length === 0 && (
                <option value="">無港口資料</option>
              )}
              {availablePorts.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
              {printPortInput && !availablePorts.includes(printPortInput.trim().toUpperCase()) && (
                <option value={printPortInput}>{printPortInput}</option>
              )}
            </select>
          </div>

          <Button onClick={onPrint} title="列印船岸交接單">
            <Printer size={14} />
            列印交接單
          </Button>
        </div>
      </div>

      {/* 總金額 Badge */}
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
