import React from 'react';
import { X, Download, FileCheck2 } from 'lucide-react';
import { ReeferFormState } from '../types/reefer';

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

export const buildExportXml = (formState: ReeferFormState): string => {
  const totalContainers = formState.containers.length;
  const totalCash = formState.containers.reduce((acc, c) => acc + (c.cash || 0), 0);
  const countLong = formState.containers.filter((c) => c.cash === 800).length;
  const countShort = formState.containers.filter((c) => c.cash === 400).length;

  const group1Xml = formState.containers
    .map((cnt) => {
      // 巡溫紀錄 DATE_LOG 亦轉為 ISO 8601 格式 (如 2026-08-14T05:46:11.258Z)
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

      // 關鍵修正：職稱代碼除去斜線 (C/O -> CO, 2/O -> 2O, 3/O -> 3O, 3/E -> 3E)
      const group3Xml = crewList
        .map((cr) => {
          const roleStr = (cr.role || '').replace(/\//g, '');
          return `<GROUP3><RECORD>${roleStr}</RECORD></GROUP3>`;
        })
        .join('');

      // 自動轉換裝卸船時間為標準 ISO 8601 格式 (如 2026-08-16T16:00:00.000Z)，若無時間則輸出 'null'
      const loadingDt = formatIsoDatetime(cnt.loadingDatetime, 'null');
      const dischargeDt = formatIsoDatetime(cnt.dischargeDatetime, 'null');

      return `<GROUP1><CONTAINER_NUMBER>${cnt.containerNumber ?? ''}</CONTAINER_NUMBER><SETTING_TEMP>${cnt.settingTemp ?? ''}</SETTING_TEMP><COMMODITY>${cnt.commodity ?? ''}</COMMODITY><LOADING_LOCATION>${cnt.loadingLocation ?? ''}</LOADING_LOCATION><LOADING_PORT>${cnt.loadingPort ?? ''}</LOADING_PORT><LOADING_DATETIME>${loadingDt}</LOADING_DATETIME><LOADING_TEMP>${cnt.loadingTemp ?? ''}</LOADING_TEMP><DISCHARGE_PORT>${cnt.dischargePort ?? ''}</DISCHARGE_PORT><DISCHARGE_DATETIME>${dischargeDt}</DISCHARGE_DATETIME><DISCHARGE_TEMP>${cnt.dischargeTemp ?? ''}</DISCHARGE_TEMP><REMARK_1>${cnt.remark1 ?? ''}</REMARK_1><DAYS>${cnt.days ?? 0}</DAYS><CASH>${cnt.cash ?? 400}</CASH><ISHIDDEN>${cnt.isHidden ? 'true' : 'false'}</ISHIDDEN>${group2Xml}${group3Xml}</GROUP1>`;
    })
    .join('');

  // 公司標準外殼：<form> ... </form> 格式
  return `<?xml version="1.0" encoding="UTF-8"?><form><CATEGORY>${formState.category || 'WEB_FFS'}</CATEGORY><FORM_TYPE>${formState.formType || 'reefer_bonus'}</FORM_TYPE><IMO>${formState.imo || '9319131'}</IMO><SHIP_NAME>${formState.vesselName || ''}</SHIP_NAME><VESSEL_STATUS>${formState.vesselStatus || 'own vessel'}</VESSEL_STATUS><VOYAGE>${formState.voyage || ''}</VOYAGE><COUNT>${totalContainers}</COUNT><TOTALCASH>${totalCash}</TOTALCASH><COUNT_LONG>${countLong}</COUNT_LONG><COUNT_SHORT>${countShort}</COUNT_SHORT><PRINT_PORT>${formState.printPortInput || ''}</PRINT_PORT><QUERY_TYPE>${formState.queryType || 'DISCHARGE'}</QUERY_TYPE><PRINT_TYPE>${formState.printType || 'LOADPRINT'}</PRINT_TYPE><IMPORT_TYPE>${formState.importType || 'SUPERCARGO'}</IMPORT_TYPE>${group1Xml}</form>`;
};

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  formState,
}) => {
  if (!isOpen) return null;

  const xmlContent = buildExportXml(formState);

  const handleDownload = () => {
    // 帶入 UTF-8 BOM (\uFEFF)，確保公司系統讀取中文船名 (如 雲明) 絕對不亂碼
    const blob = new Blob(['\uFEFF' + xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
    const vesselStr = (formState.vesselName || 'SHIP').trim();

    a.download = `${vesselStr}_reefer_bonus_${timestamp}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} color="#0284c7" />
            匯出 XML 報表
          </span>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#f0f9ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              flexShrink: 0,
            }}
          >
            <FileCheck2 size={28} />
          </div>
          <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700, marginBottom: '6px' }}>
            匯出公司標準 XML 檔案
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
            冷櫃資料已準備完畢（共 {formState.containers.length} 筆資料）。<br />
            點擊下方按鈕即可下載 `.xml` 檔案。
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center', gap: '10px' }}>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleDownload} style={{ minWidth: '130px' }}>
            <Download size={14} />
            下載 XML 檔案
          </button>
        </div>
      </div>
    </div>
  );
};
