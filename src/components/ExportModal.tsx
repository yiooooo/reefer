import React from 'react';
import { Download, FileCheck2 } from 'lucide-react';
import { ReeferFormState } from '../types/reefer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { useTranslation } from '../i18n/LanguageContext';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  formState: ReeferFormState;
}

const formatIsoDatetime = (str: string, fallbackIfEmpty = 'null'): string => {
  if (!str || !str.trim()) return fallbackIfEmpty;
  if (str.trim().toLowerCase() === 'null') return 'null';
  const normalized = str.trim().replace(/\//g, '-').replace(' ', 'T');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return str;
  return d.toISOString();
};

export const getShortVesselName = (name?: string, fallback = ''): string => {
  const trimmed = (name || '').trim();
  if (!trimmed) return fallback;
  return trimmed.length >= 2 ? trimmed.slice(-2) : trimmed;
};

export const buildExportXml = (formState: ReeferFormState): string => {
  const totalContainers = formState.containers.length;
  const totalCash = formState.containers.reduce((acc, c) => acc + (c.cash || 0), 0);
  const countLong = formState.containers.filter((c) => c.cash === 800).length;
  const countShort = formState.containers.filter((c) => c.cash === 400).length;
  const vesselName = getShortVesselName(formState.vesselName);

  const group1Xml = formState.containers
    .map((cnt) => {
      const group2Xml = (cnt.tempRecords || [])
        .map(
          (tr) => `<GROUP2><DF_1>${tr.df1 ?? ''}</DF_1><DF_2>${tr.df2 ?? ''}</DF_2><DF_3>${tr.df3 ?? ''}</DF_3><DATE_LOG>${formatIsoDatetime(tr.dateLog, '')}</DATE_LOG><REMARK>${tr.remark ?? ''}</REMARK></GROUP2>`
        )
        .join('');

      const crewList =
        cnt.crewRecords && cnt.crewRecords.length > 0
          ? cnt.crewRecords
          : [
              { id: '1', role: 'CO' },
              { id: '2', role: '2O' },
              { id: '3', role: '3O' },
              { id: '4', role: '3E' },
            ];

      const group3Xml = crewList
        .map((cr) => {
          const roleStr = (cr.role || '').replace(/\//g, '');
          return `<GROUP3><RECORD>${roleStr}</RECORD></GROUP3>`;
        })
        .join('');

      const loadingDt = formatIsoDatetime(cnt.loadingDatetime, 'null');
      const dischargeDt = formatIsoDatetime(cnt.dischargeDatetime, 'null');

      return `<GROUP1><CONTAINER_NUMBER>${cnt.containerNumber ?? ''}</CONTAINER_NUMBER><SETTING_TEMP>${cnt.settingTemp ?? ''}</SETTING_TEMP><COMMODITY>${cnt.commodity ?? ''}</COMMODITY><LOADING_LOCATION>${cnt.loadingLocation ?? ''}</LOADING_LOCATION><LOADING_PORT>${cnt.loadingPort ?? ''}</LOADING_PORT><LOADING_DATETIME>${loadingDt}</LOADING_DATETIME><LOADING_TEMP>${cnt.loadingTemp ?? ''}</LOADING_TEMP><DISCHARGE_PORT>${cnt.dischargePort ?? ''}</DISCHARGE_PORT><DISCHARGE_DATETIME>${dischargeDt}</DISCHARGE_DATETIME><DISCHARGE_TEMP>${cnt.dischargeTemp ?? ''}</DISCHARGE_TEMP><REMARK_1>${cnt.remark1 ?? ''}</REMARK_1><DAYS>${cnt.days ?? 0}</DAYS><CASH>${cnt.cash ?? 400}</CASH><ISHIDDEN>${cnt.isHidden ? 'true' : 'false'}</ISHIDDEN>${group2Xml}${group3Xml}</GROUP1>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><form><CATEGORY>${formState.category || 'WEB_FFS'}</CATEGORY><FORM_TYPE>${formState.formType || 'reefer_bonus'}</FORM_TYPE><IMO>${formState.imo || '9319131'}</IMO><SHIP_NAME>${vesselName}</SHIP_NAME><VESSEL_STATUS>${formState.vesselStatus || 'own vessel'}</VESSEL_STATUS><VOYAGE>${formState.voyage || ''}</VOYAGE><COUNT>${totalContainers}</COUNT><TOTALCASH>${totalCash}</TOTALCASH><COUNT_LONG>${countLong}</COUNT_LONG><COUNT_SHORT>${countShort}</COUNT_SHORT><PRINT_PORT>${formState.printPortInput || ''}</PRINT_PORT><QUERY_TYPE>${formState.queryType || 'DISCHARGE'}</QUERY_TYPE><PRINT_TYPE>${formState.printType || 'LOADPRINT'}</PRINT_TYPE><IMPORT_TYPE>${formState.importType || 'SUPERCARGO'}</IMPORT_TYPE>${group1Xml}</form>`;
};

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  formState,
}) => {
  const { t } = useTranslation();
  const xmlContent = buildExportXml(formState);

  const handleDownload = () => {
    const blob = new Blob(['\uFEFF' + xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const vesselStr = getShortVesselName(formState.vesselName);
    const voyageStr = (formState.voyage || '').trim();

    a.download = `${vesselStr}V_${voyageStr}_Reefer.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download size={16} className="text-sky-600" />
            {t('exportModal.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <FileCheck2 size={28} />
          </div>
          <div className="text-sm font-bold text-slate-800">{t('exportModal.title')}</div>
          <div className="text-slate-500 leading-relaxed">
            {t('exportModal.instruction')}<br />
            ({t('exportModal.totalCount')} {formState.containers.length})
          </div>
        </div>

        <DialogFooter className="justify-center gap-2.5">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDownload} className="min-w-[130px]">
            <Download size={14} />
            {t('exportModal.exportBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
