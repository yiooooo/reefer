import React, { useState } from 'react';
import { Upload, CheckCircle, FileText } from 'lucide-react';
import { ReeferContainer, TempRecord, CrewRecord } from '../types/reefer';
import { calculateReeferDaysAndCash, formatTempNumber } from '../utils/tempGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useTranslation } from '../i18n/LanguageContext';

export type DuplicateMode = 'allow_duplicate' | 'update_existing' | 'skip_existing';
export type ImportType = 'AUTO' | 'XML' | 'SUPERCARGO' | 'MACS3';

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
  const { t } = useTranslation();
  const [importType, setImportType] = useState<ImportType>('AUTO');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('allow_duplicate');
  const [rawText, setRawText] = useState<string>('');
  const [uploadedContent, setUploadedContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = (evt.target?.result as string) || '';
      setUploadedContent(content);

      const isXml =
        file.name.toLowerCase().endsWith('.xml') ||
        content.trim().startsWith('<?xml') ||
        content.includes('<my:group1>') ||
        content.includes('<group1>');

      if (isXml) {
        // XML 檔案不放入下方文字框，維持文字框乾淨
        setRawText('');
      } else {
        // TXT 檔案則將內容顯示於文字框中
        setRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = () => {
    const text = (uploadedContent || rawText).trim();
    if (!text) {
      alert(t('importModal.selectFileError'));
      return;
    }

    const importedList: Partial<ReeferContainer>[] = [];
    const metaData: { voyage?: string; vesselName?: string } = {};

    const isXmlContent = text.startsWith('<?xml') || text.includes('<my:group1>') || text.includes('<group1>');

    if (isXmlContent || importType === 'XML') {
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
          const settingTemp = formatTempNumber(getTagValue(itemNode, 'setting_temp'));
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

          const loadingTemp = formatTempNumber(getTagValue(itemNode, 'loading_temp'));
          const dischargeTemp = formatTempNumber(getTagValue(itemNode, 'discharge_temp'));
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
              const rawDateLog = getTagValue(child, 'date_log') || getTagValue(child, 'date');
              // 標準化為 YYYY-MM-DD：去除時間部分（T 之後或空格之後）、並將 / 轉為 -
              let dateLog = '';
              if (rawDateLog) {
                const normalized = rawDateLog.replace(/\//g, '-').split('T')[0].split(' ')[0].trim();
                // 若是合法的 YYYY-MM-DD 形式才採用，否則留空
                dateLog = /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
              }
              const df1 = formatTempNumber(getTagValue(child, 'df_1'));
              const df2 = formatTempNumber(getTagValue(child, 'df_2'));
              const df3 = formatTempNumber(getTagValue(child, 'df_3'));
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
      alert(t('importModal.parseError'));
      return;
    }

    onImportContainers(importedList, metaData, { duplicateMode });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-160 w-[92%]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={16} className="text-sky-600" />
            {t('importModal.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* 上傳檔案 */}
          <div className="flex flex-col gap-1.5">
            <Label>{t('importModal.fileLabel')}</Label>
            <Input
              type="file"
              accept=".xml,.txt"
              onChange={handleFileUpload}
              className="h-9 cursor-pointer file:mr-3 file:py-1.5 file:px-3.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-700 file:cursor-pointer"
            />
            {fileName && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 w-fit">
                <CheckCircle size={13} /> {t('importModal.fileLoaded')} {fileName}
              </span>
            )}
          </div>

          {/* 匯入格式 */}
          <div className="flex flex-col gap-1.5">
            <Label>{t('importModal.formatLabel')}</Label>
            <Select
              value={importType}
              onValueChange={(val) => setImportType(val as ImportType)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder={t('importModal.formatLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">{t('importModal.formatAuto')}</SelectItem>
                <SelectItem value="XML">{t('importModal.formatXml')}</SelectItem>
                <SelectItem value="SUPERCARGO">{t('importModal.formatSupercargo')}</SelectItem>
                <SelectItem value="MACS3">{t('importModal.formatMacs3')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 重複櫃號處理原則 */}
          <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-border">
            <Label className="mb-1">{t('importModal.duplicateRuleLabel')}</Label>
            <div className="flex flex-col gap-2 text-xs text-slate-700">
              {(
                [
                  { value: 'allow_duplicate', label: t('importModal.dupAllow') },
                  { value: 'update_existing', label: t('importModal.dupUpdate') },
                  { value: 'skip_existing', label: t('importModal.dupSkip') },
                ] as { value: DuplicateMode; label: string }[]
              ).map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateMode"
                    value={value}
                    checked={duplicateMode === value}
                    onChange={() => setDuplicateMode(value)}
                    className="accent-sky-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 貼上 TXT */}
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText size={13} className="text-sky-600" />
              {t('importModal.directPasteLabel')}
            </Label>
            <Textarea
              className="min-h-32.5 font-mono text-[11px] resize-y"
              placeholder={t('importModal.pastePlaceholder')}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setUploadedContent('');
                if (fileName) setFileName('');
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleImportSubmit}>
            {t('importModal.importConfirmBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
