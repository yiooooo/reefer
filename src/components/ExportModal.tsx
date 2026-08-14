import React, { useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { ReeferFormState } from '../types/reefer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  formState: ReeferFormState;
}

export const buildExportXml = (formState: ReeferFormState): string => {
  const totalCash = formState.containers.reduce((acc, c) => acc + (c.cash || 0), 0);
  const countLong = formState.containers.filter((c) => c.cash === 800).length;
  const countShort = formState.containers.filter((c) => c.cash === 400).length;

  const group1Xml = formState.containers
    .map((cnt) => {
      const group2Xml = (cnt.tempRecords || [])
        .map(
          (tr) => `    <GROUP2>
      <DF_1>${tr.df1 ?? ''}</DF_1>
      <DF_2>${tr.df2 ?? ''}</DF_2>
      <DF_3>${tr.df3 ?? ''}</DF_3>
      <DATE_LOG>${tr.dateLog ?? ''}</DATE_LOG>
      <REMARK>${tr.remark ?? ''}</REMARK>
    </GROUP2>`
        )
        .join('\n');

      const crewList =
        cnt.crewRecords && cnt.crewRecords.length > 0
          ? cnt.crewRecords
          : [
              { id: '1', role: 'C/O' },
              { id: '2', role: '2/O' },
              { id: '3', role: '3/O' },
              { id: '4', role: '3/E' },
            ];

      const group3Xml = crewList
        .map((cr) => {
          let roleStr = cr.role;
          if (roleStr === 'C/O') roleStr = 'CO';
          else if (roleStr === '2/O') roleStr = '2O';
          else if (roleStr === '3/O') roleStr = '3O';
          else if (roleStr === '3E') roleStr = '3E';
          return `    <GROUP3><RECORD>${roleStr}</RECORD></GROUP3>`;
        })
        .join('\n');

      const loadingDt = cnt.loadingDatetime ? cnt.loadingDatetime : 'null';
      const dischargeDt = cnt.dischargeDatetime ? cnt.dischargeDatetime : 'null';

      return `  <GROUP1>
    <CONTAINER_NUMBER>${cnt.containerNumber ?? ''}</CONTAINER_NUMBER>
    <SETTING_TEMP>${cnt.settingTemp ?? ''}</SETTING_TEMP>
    <COMMODITY>${cnt.commodity ?? ''}</COMMODITY>
    <LOADING_LOCATION>${cnt.loadingLocation ?? ''}</LOADING_LOCATION>
    <LOADING_PORT>${cnt.loadingPort ?? ''}</LOADING_PORT>
    <LOADING_DATETIME>${loadingDt}</LOADING_DATETIME>
    <LOADING_TEMP>${cnt.loadingTemp ?? ''}</LOADING_TEMP>
    <DISCHARGE_PORT>${cnt.dischargePort ?? ''}</DISCHARGE_PORT>
    <DISCHARGE_DATETIME>${dischargeDt}</DISCHARGE_DATETIME>
    <DISCHARGE_TEMP>${cnt.dischargeTemp ?? ''}</DISCHARGE_TEMP>
    <REMARK_1>${cnt.remark1 ?? ''}</REMARK_1>
    <DAYS>${cnt.days ?? 0}</DAYS>
    <CASH>${cnt.cash ?? 400}</CASH>
    <ISHIDDEN>${cnt.isHidden ? 'true' : 'false'}</ISHIDDEN>
${group2Xml ? group2Xml + '\n' : ''}${group3Xml}
  </GROUP1>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<form>
  <CATEGORY>${formState.category || 'WEB_FFS'}</CATEGORY>
  <FORM_TYPE>${formState.formType || 'reefer_bonus'}</FORM_TYPE>
  <IMO>${formState.imo || '9319131'}</IMO>
  <SHIP_NAME>${formState.vesselName || ''}</SHIP_NAME>
  <VESSEL_STATUS>${formState.vesselStatus || 'own vessel'}</VESSEL_STATUS>
  <VOYAGE>${formState.voyage || ''}</VOYAGE>
  <COUNT>null</COUNT>
  <TOTALCASH>${totalCash}</TOTALCASH>
  <COUNT_LONG>${countLong}</COUNT_LONG>
  <COUNT_SHORT>${countShort}</COUNT_SHORT>
  <PRINT_PORT>${formState.printPortInput || ''}</PRINT_PORT>
  <QUERY_TYPE>${formState.queryType || 'DISCHARGE'}</QUERY_TYPE>
  <PRINT_TYPE>${formState.printType || 'LOADPRINT'}</PRINT_TYPE>
  <IMPORT_TYPE>${formState.importType || 'SUPERCARGO'}</IMPORT_TYPE>
${group1Xml}
</form>`;
};

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  formState,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const xmlContent = buildExportXml(formState);

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
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
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} color="#1890ff" />
            Export Data 匯出 XML 報表
          </span>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">XML 報表內容預覽 (舊專案格式)</label>
            <textarea
              className="textarea-control"
              readOnly
              value={xmlContent}
              style={{ minHeight: '260px', background: '#f8fafc', fontFamily: 'monospace', fontSize: '11px' }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={handleCopy}>
            {copied ? <Check size={14} color="#52c41a" /> : <Copy size={14} />}
            {copied ? '已複製' : '複製內容'}
          </button>
          <button className="btn btn-primary" onClick={handleDownload}>
            <Download size={14} />
            下載 XML 檔案
          </button>
        </div>
      </div>
    </div>
  );
};
