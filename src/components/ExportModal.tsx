import React, { useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { ReeferFormState } from '../types/reefer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  formState: ReeferFormState;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  formState,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<REEFER_BONUS_FORM>
  <CATEGORY>${formState.category}</CATEGORY>
  <FORM_TYPE>${formState.formType}</FORM_TYPE>
  <IMO>${formState.imo}</IMO>
  <VESSEL_NAME>${formState.vesselName}</VESSEL_NAME>
  <VESSEL_STATUS>${formState.vesselStatus}</VESSEL_STATUS>
  <VOYAGE>${formState.voyage}</VOYAGE>
  <TOTALCASH>${formState.containers.reduce((acc, c) => acc + c.cash, 0)}</TOTALCASH>
  <CONTAINERS_COUNT>${formState.containers.length}</CONTAINERS_COUNT>
  <GROUP1>
${formState.containers
  .map(
    (cnt) => `    <GROUP1_ITEM>
      <CONTAINER_NUMBER>${cnt.containerNumber}</CONTAINER_NUMBER>
      <SETTING_TEMP>${cnt.settingTemp}</SETTING_TEMP>
      <COMMODITY>${cnt.commodity}</COMMODITY>
      <LOADING_LOCATION>${cnt.loadingLocation}</LOADING_LOCATION>
      <LOADING_PORT>${cnt.loadingPort}</LOADING_PORT>
      <LOADING_DATETIME>${cnt.loadingDatetime}</LOADING_DATETIME>
      <LOADING_TEMP>${cnt.loadingTemp}</LOADING_TEMP>
      <DISCHARGE_PORT>${cnt.dischargePort}</DISCHARGE_PORT>
      <DISCHARGE_DATETIME>${cnt.dischargeDatetime}</DISCHARGE_DATETIME>
      <DISCHARGE_TEMP>${cnt.dischargeTemp}</DISCHARGE_TEMP>
      <DAYS>${cnt.days}</DAYS>
      <CASH>${cnt.cash}</CASH>
    </GROUP1_ITEM>`
  )
  .join('\n')}
  </GROUP1>
</REEFER_BONUS_FORM>`;

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
    a.download = `Reefer_Bonus_${formState.voyage || 'Draft'}.xml`;
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
            <label className="form-label">XML 報表內容預覽</label>
            <textarea
              className="textarea-control"
              readOnly
              value={xmlContent}
              style={{ minHeight: '220px', background: '#f8fafc' }}
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
