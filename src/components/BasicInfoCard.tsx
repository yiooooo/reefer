import React, { useMemo, useEffect } from 'react';
import { Printer, Ship, FileCheck } from 'lucide-react';
import { ReeferContainer } from '../types/reefer';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useTranslation } from '../i18n/LanguageContext';

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
  const { t } = useTranslation();

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
        <span className="config-card-tag">{t('basicInfo.cardTag')}</span>
        <div className="config-card-body">
          <div className="config-item">
            <Ship size={16} color="#64748b" />
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${vesselStatus === 'own vessel' ? 'active' : ''}`}
                onClick={() => onVesselStatusChange('own vessel')}
              >
                {t('basicInfo.ownVessel')}
              </button>
              <button
                type="button"
                className={`segmented-btn ${vesselStatus === 'chartered vessel' ? 'active' : ''}`}
                onClick={() => onVesselStatusChange('chartered vessel')}
              >
                {t('basicInfo.charteredVessel')}
              </button>
            </div>
          </div>

          <div className="config-item">
            <Label className="whitespace-nowrap">{t('basicInfo.voyage')}</Label>
            <Input
              type="text"
              style={{ width: '150px' }}
              value={voyage}
              onChange={(e) => onVoyageChange(e.target.value)}
              placeholder={t('basicInfo.voyagePlaceholder')}
            />
          </div>
        </div>
      </div>

      {/* 船岸交接單 Card */}
      <div className="config-card">
        <span className="config-card-tag">{t('basicInfo.handoverTag')}</span>
        <div className="config-card-body">
          <div className="config-item">
            <FileCheck size={16} color="#0284c7" />
            <Select
              value={printType}
              onValueChange={(val) => onPrintTypeChange(val as 'LOADPRINT' | 'DISCHARGEPRINT')}
            >
              <SelectTrigger className="w-32.5">
                <SelectValue placeholder={t('basicInfo.selectType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOADPRINT">{t('basicInfo.loadingType')}</SelectItem>
                <SelectItem value="DISCHARGEPRINT">{t('basicInfo.dischargeType')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="config-item">
            <Label className="whitespace-nowrap">{t('basicInfo.handoverPort')}</Label>
            <Select
              value={printPortInput}
              onValueChange={onPrintPortInputChange}
              disabled={availablePorts.length === 0}
            >
              <SelectTrigger className="w-32.5">
                <SelectValue placeholder={availablePorts.length === 0 ? t('basicInfo.noPortData') : t('basicInfo.selectPort')} />
              </SelectTrigger>
              <SelectContent>
                {availablePorts.map((port) => (
                  <SelectItem key={port} value={port}>
                    {port}
                  </SelectItem>
                ))}
                {printPortInput && !availablePorts.includes(printPortInput.trim().toUpperCase()) && (
                  <SelectItem value={printPortInput}>{printPortInput}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={onPrint} title={t('basicInfo.printHandover')}>
            <Printer size={14} />
            {t('basicInfo.printHandover')}
          </Button>
        </div>
      </div>

      {/* 總金額 Badge */}
      {totalCash !== undefined && (
        <div className="badge-total-cash" style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          <span className="amount">{t('basicInfo.totalAmount')} : ${totalCash} NTD</span>
          <span className="subtext">
            {t('basicInfo.longVoyageCount')}: {longCount || 0} ｜ {t('basicInfo.shortVoyageCount')}: {shortCount || 0}
          </span>
        </div>
      )}
    </div>
  );
};
