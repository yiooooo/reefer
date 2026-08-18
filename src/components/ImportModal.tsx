import React, { useState } from 'react';
import { X, Upload, CheckCircle } from 'lucide-react';
import { ReeferContainer, TempRecord, CrewRecord } from '../types/reefer';
import { calculateReeferDaysAndCash } from '../utils/tempGenerator';

export type DuplicateMode = 'allow_duplicate' | 'update_existing' | 'skip_existing';

export interface ImportOptions {
  duplicateMode: DuplicateMode;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportContainers: (
    containers: Partial<ReeferContainer>[],
    meta?: { voyage?: string; vesselName?: string },
    options?: ImportOptions
  ) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportContainers,
}) => {
  const [importType, setImportType] = useState<'AUTO' | 'XML' | 'SUPERCARGO' | 'MACS3'>('AUTO');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('allow_duplicate');
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setRawText(content);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = () => {
    const text = rawText.trim();
    if (!text) {
      alert('請先選擇並上傳檔案！');
      return;
    }

    const importedList: Partial<ReeferContainer>[] = [];
    let metaData: { voyage?: string; vesselName?: string } = {};

    const isXmlContent = text.startsWith('<?xml') || text.includes('<my:group1>') || text.includes('<group1>');

    if (isXmlContent || importType === 'XML') {
      // 1. InfoPath XML / 標準 XML 解析器
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        // 輔助函式：依據標籤名稱取得內部文字內容（支援 my: 前綴或無前綴標籤）
        const getTagValue = (parent: Element | Document, tagName: string): string => {
          const children = parent.getElementsByTagName('*');
          for (let i = 0; i < children.length; i++) {
            if (children[i].localName.toLowerCase() === tagName.toLowerCase()) {
              return children[i].textContent?.trim() || '';
            }
          }
          return '';
        };

        // 提取航次與船名元資料
        const voyage = getTagValue(xmlDoc, 'voyage');
        const vesselName = getTagValue(xmlDoc, 'ship_name') || getTagValue(xmlDoc, 'vessel_name');
        if (voyage) metaData.voyage = voyage;
        if (vesselName) metaData.vesselName = vesselName;

        // 搜尋所有冷櫃節點 (group1, group1_item 或 REEFER)
        const allElements = xmlDoc.getElementsByTagName('*');
        const group1Nodes: Element[] = [];
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];
          if (el.localName.toLowerCase() === 'group1' || el.localName.toLowerCase() === 'group1_item') {
            group1Nodes.push(el);
          }
        }

        group1Nodes.forEach((itemNode) => {
          const containerNumber = getTagValue(itemNode, 'container_number');
          const settingTemp = getTagValue(itemNode, 'setting_temp');
          const commodity = getTagValue(itemNode, 'commodity');
          const loadingLocation = getTagValue(itemNode, 'loading_location');
          const loadingPort = getTagValue(itemNode, 'loading_port');
          const loadingDate = getTagValue(itemNode, 'loading_date');
          const loadingH = getTagValue(itemNode, 'loading_timeh');
          const loadingM = getTagValue(itemNode, 'loading_timem');

          const dischargePort = getTagValue(itemNode, 'discharge_port');
          const dischargeDate = getTagValue(itemNode, 'discharge_date');
          const handoverH = getTagValue(itemNode, 'handover_timeh') || getTagValue(itemNode, 'discharge_timeh');
          const handoverM = getTagValue(itemNode, 'handover_timem') || getTagValue(itemNode, 'discharge_timem');

          const loadingTemp = getTagValue(itemNode, 'loading_temp');
          const dischargeTemp = getTagValue(itemNode, 'discharge_temp');
          const remark1 = getTagValue(itemNode, 'remark_1');
          const cashVal = parseFloat(getTagValue(itemNode, 'cash'));

          // 統一使用 YYYY-MM-DD HH:mm 格式
          const loadingDtStr = getTagValue(itemNode, 'loading_datetime');
          const dischargeDtStr = getTagValue(itemNode, 'discharge_datetime');

          let loadingDatetime = '';
          if (loadingDtStr && loadingDtStr.toLowerCase() !== 'null') {
            const cleanStr = loadingDtStr.replace(/\//g, '-').replace(' ', 'T');
            const d = new Date(cleanStr);
            if (!isNaN(d.getTime())) {
              const pad = (n: number) => String(n).padStart(2, '0');
              loadingDatetime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } else {
              loadingDatetime = loadingDtStr.replace('T', ' ');
            }
          } else if (loadingDate) {
            const h = loadingH ? loadingH.padStart(2, '0') : '00';
            const m = loadingM ? loadingM.padStart(2, '0') : '00';
            loadingDatetime = `${loadingDate} ${h}:${m}`;
          }

          let dischargeDatetime = '';
          if (dischargeDtStr && dischargeDtStr.toLowerCase() !== 'null') {
            const cleanStr = dischargeDtStr.replace(/\//g, '-').replace(' ', 'T');
            const d = new Date(cleanStr);
            if (!isNaN(d.getTime())) {
              const pad = (n: number) => String(n).padStart(2, '0');
              dischargeDatetime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } else {
              dischargeDatetime = dischargeDtStr.replace('T', ' ');
            }
          } else if (dischargeDate) {
            const h = handoverH ? handoverH.padStart(2, '0') : '00';
            const m = handoverM ? handoverM.padStart(2, '0') : '00';
            dischargeDatetime = `${dischargeDate} ${h}:${m}`;
          }

          // 提取每日溫度紀錄 (group2)
          const tempRecords: TempRecord[] = [];
          const itemChildren = itemNode.getElementsByTagName('*');
          for (let j = 0; j < itemChildren.length; j++) {
            const child = itemChildren[j];
            if (child.localName.toLowerCase() === 'group2') {
              const dateLog = getTagValue(child, 'date_log') || getTagValue(child, 'date');
              const df1 = getTagValue(child, 'df_1');
              const df2 = getTagValue(child, 'df_2');
              const df3 = getTagValue(child, 'df_3');
              const remark = getTagValue(child, 'remark');

              tempRecords.push({
                id: `tr-${Date.now()}-${tempRecords.length}`,
                dateLog: dateLog || (loadingDate ? loadingDate : ''),
                df1: df1 || '',
                df2: df2 || '',
                df3: df3 || '',
                remark: remark || '',
              });
            }
          }

          // 提取巡櫃人員記錄 (group3)
          const crewRecords: CrewRecord[] = [];
          for (let j = 0; j < itemChildren.length; j++) {
            const child = itemChildren[j];
            if (child.localName.toLowerCase() === 'group3') {
              const rec = getTagValue(child, 'record');
              let role = rec;
              if (rec === 'CO') role = 'C/O';
              else if (rec === '2O') role = '2/O';
              else if (rec === '3O') role = '3/O';
              else if (rec === '3E') role = '3/E';

              if (role) {
                crewRecords.push({
                  id: `cr-${Date.now()}-${crewRecords.length}`,
                  role,
                });
              }
            }
          }

          const { days: computedDays, cash: computedCash } = calculateReeferDaysAndCash(
            loadingDatetime,
            dischargeDatetime,
            tempRecords.length
          );
          const days = computedDays;
          const cash = !isNaN(cashVal) && cashVal > 0 ? cashVal : computedCash;

          importedList.push({
            containerNumber,
            settingTemp,
            commodity,
            loadingLocation,
            loadingPort,
            loadingDatetime,
            loadingTemp,
            dischargePort,
            dischargeDatetime,
            dischargeTemp,
            remark1,
            days,
            cash,
            tempRecords,
            crewRecords: crewRecords.length > 0 ? crewRecords : undefined,
          });
        });
      } catch (err) {
        console.error('XML parse error:', err);
      }
    } else {
      // 2. 純文字檔解析器 (Supercargo / MACS3 文字格式)
      const lines = text.split('\n');
      const isMacs3 = text.toLowerCase().includes('position');

      if (isMacs3 || importType === 'MACS3') {
        const posIndex = lines.findIndex((l) => l.trim().toLowerCase().startsWith('position'));
        const startLine = posIndex !== -1 ? posIndex + 2 : 0;

        for (let i = startLine; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const tokens = line.split(/\s+/);
          if (tokens.length >= 3) {
            importedList.push({
              loadingLocation: tokens[0],
              loadingPort: tokens[1],
              dischargePort: tokens[2],
              containerNumber: tokens[3] || tokens[0],
              settingTemp: tokens[4] || '3',
              commodity: '',
              cash: 400,
              days: 1,
            });
          }
        }
      } else {
        // Supercargo 文字檔解析器
        const cellIndex = lines.findIndex((l) => l.trim().toLowerCase().startsWith('cell'));
        const startLine = cellIndex !== -1 ? cellIndex + 1 : 0;

        for (let i = startLine; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const tokens = line.split(/\s+/);
          if (tokens.length >= 4) {
            const loc = tokens[0];
            const cntNo = tokens[1];
            const loadPort = tokens[3] || 'LCB';
            const dischPort = tokens[4] || 'KHH';
            const tempMatch = line.match(/RF[\s\S]{0,10}?C/);
            let settingTemp = '';
            if (tempMatch) {
              settingTemp = tempMatch[0].replace(/[^\d.-]/g, '');
            }

            importedList.push({
              containerNumber: cntNo,
              loadingLocation: loc,
              loadingPort: loadPort,
              dischargePort: dischPort,
              settingTemp: settingTemp || '3',
              commodity: '',
              cash: 400,
              days: 1,
            });
          }
        }
      }
    }

    if (importedList.length === 0) {
      alert('無法解析檔案內容，請確認檔案格式是否正確。');
      return;
    }

    onImportContainers(importedList, metaData, { duplicateMode });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} color="#0284c7" />
            Import File 匯入冷櫃與巡櫃資料
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
            <label className="form-label">選擇檔案上傳 (.xml / .txt)</label>
            <input
              type="file"
              accept=".xml,.txt"
              onChange={handleFileUpload}
              className="input-control"
              style={{ padding: '6px' }}
            />
            {fileName && (
              <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <CheckCircle size={14} /> 已載入檔案: {fileName}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">選擇匯入格式 / 自動偵測</label>
            <select
              className="input-control"
              value={importType}
              onChange={(e) => setImportType(e.target.value as any)}
            >
              <option value="AUTO">自動判斷 (Auto Detect XML / Text)</option>
              <option value="XML">InfoPath XML / 標準 XML 報表</option>
              <option value="SUPERCARGO">SUPERCARGO TXT 格式</option>
              <option value="MACS3">MACS3 TXT 格式</option>
            </select>
          </div>

          <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>重複櫃號處理原則</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="duplicateMode"
                  value="allow_duplicate"
                  checked={duplicateMode === 'allow_duplicate'}
                  onChange={() => setDuplicateMode('allow_duplicate')}
                />
                直接追加所有冷櫃 (允許相同櫃號重複出現)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="duplicateMode"
                  value="update_existing"
                  checked={duplicateMode === 'update_existing'}
                  onChange={() => setDuplicateMode('update_existing')}
                />
                自動覆蓋更新 (相同櫃號時更新現有資料，新櫃號追加)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="duplicateMode"
                  value="skip_existing"
                  checked={duplicateMode === 'skip_existing'}
                  onChange={() => setDuplicateMode('skip_existing')}
                />
                自動跳過重複櫃號 (忽略現有清單中已存在的櫃號)
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleImportSubmit}>
            開始匯入
          </button>
        </div>
      </div>
    </div>
  );
};

