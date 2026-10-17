import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../../context/ToastContext';
import type { CrewMember, DayData, CrewOverrides, ShipInfo } from '../../types/restHours';
import { DEFAULT_SHIP_INFO, emptyDay } from '../../utils/restHoursData';
import { getDaysInMonth, resolveCrewWorkSlots } from '../../utils/restHoursUtils';

export interface PartDProps {
  selYear: string;
  selMonth: string;
  crewList: CrewMember[];
  dailyData: Record<string, DayData>;
  allCrewOverrides: Record<string, CrewOverrides>;
  onBackToC?: () => void;
}

// 智慧識別是否屬於機艙部門職稱 (支援 4/E1, 4/E2, MM1, MM2, NO.1, CE, 2E 等)
const isEngineRank = (rawRank: string = ''): boolean => {
  if (!rawRank) return false;
  const upper = rawRank.trim().toUpperCase();

  // 1. 中文字詞識別
  if (/(輪機|機艙|管輪|大管|二管|三管|機匠|機工|加油|抹油|銅匠|電機|電工)/.test(upper)) {
    return true;
  }

  // 2. 匹配 MM, MM1, MM2, OILER, WIPER, FITTER, MOTOR, PUMP 等機艙關鍵字
  if (
    /(^|[\s\/\(\.\-_])(MM|OILER|WIPER|FITTER|MOTOR|ELECTR|PUMP)(\d|\b|[\s\/\)\(\.\-_])/i.test(upper)
  ) {
    return true;
  }

  // 3. 英文詞包含
  if (
    upper.includes('ENGINE') ||
    upper.includes('CHIEF ENG') ||
    upper.includes('SECOND ENG') ||
    upper.includes('THIRD ENG') ||
    upper.includes('FOURTH ENG') ||
    upper.includes('ELECTRICAL')
  ) {
    return true;
  }

  // 4. 匹配管輪代碼 (如 4/E1, 4/E2, 4/E, 4E1, 4E2, 3/E1, 2/E1, CE, 1AE, 2AE, ETO, NO.1, NO 1 等)
  if (
    /(^|[\s\/\(\.\-_])(C[\/\.]?E|1[\/\.]?E|2[\/\.]?E|3[\/\.]?E|4[\/\.]?E|1[\/\.]?AE|2[\/\.]?AE|3[\/\.]?AE|4[\/\.]?AE|ETO|EEO|NO[\s\.]*1)($|[\s\/\)\(\.\-_0-9])/i.test(
      upper,
    )
  ) {
    return true;
  }

  return false;
};

// 勞動部標準事故類型選項 (fsh11020_accident.json)
const ACCIDENT_TYPES = [
  '墜落、滾落',
  '跌倒',
  '衝撞',
  '物體飛落',
  '物體倒塌、崩塌',
  '被撞',
  '被夾、被捲',
  '被切、割、擦傷',
  '踩踏',
  '溺斃',
  '與高溫、低溫之接觸',
  '與有害物等之接觸',
  '感電',
  '爆炸',
  '物體破裂',
  '火災',
  '不當動作',
  '其他',
  '無法歸類者',
];

// 勞動部標準受傷部位選項 (fsh11020_injury.json)
const INJURY_PARTS = [
  '頭(含眼、耳、鼻、口腔、下顎骨)',
  '臉頰（不含頭部之臉顏）',
  '頸',
  '肩',
  '鎖骨',
  '上膊',
  '肘',
  '前膊',
  '腕',
  '胸',
  '肋骨',
  '背',
  '手',
  '指',
  '腹',
  '臀',
  '鼠蹊',
  '股',
  '膝',
  '腿',
  '足',
  '內臟',
  '全身',
  '其他',
];

export const PartD: React.FC<PartDProps> = ({
  selYear,
  selMonth,
  crewList,
  dailyData,
  allCrewOverrides,
}) => {
  const { showToast } = useToast();

  // 1. 船舶基本資訊 (背景自動保留以供 XML 匯出對齊)
  const [shipInfo] = useState<ShipInfo>(() => {
    try {
      const a = localStorage.getItem('ship_working_arrangement_info');
      if (a) return JSON.parse(a);
      const b = localStorage.getItem('part_a_ship_info') || localStorage.getItem('ship_info');
      if (b) return JSON.parse(b);
    } catch {
      // ignore
    }
    return DEFAULT_SHIP_INFO;
  });

  const daysInMonth = useMemo(() => getDaysInMonth(selYear, selMonth), [selYear, selMonth]);

  // 機艙部工時「手動覆蓋」輸入框 (預設為空，若填寫則覆蓋自動帶入值)
  const [engineHoursInput, setEngineHoursInput] = useState<string>('');

  // 船員所屬部門手動覆蓋狀態 (預設由職級自動判定，使用者可點擊切換)
  const [deptOverrides, setDeptOverrides] = useState<Record<string, 'DECK' | 'ENGINE'>>({});

  const toggleCrewDept = (id: string, currentIsEngine: boolean) => {
    setDeptOverrides(prev => ({
      ...prev,
      [id]: currentIsEngine ? 'DECK' : 'ENGINE',
    }));
  };

  // 2. 職災狀態切換 (預設為無職災 NO，切換年月時自動重置為 NO)
  const [yesNo, setYesNo] = useState<'NO' | 'YES'>('NO');

  useEffect(() => {
    setYesNo('NO');
  }, [selYear, selMonth]);

  // 背景基本欄位 (供 XML 匯出使用，已自頁面格子中移除)
  const [vesselName, setVesselName] = useState(shipInfo.vesselName || 'YM IMMENSE');
  const [imoNo, setImoNo] = useState(shipInfo.imoNo || '9319131');
  const [masterName, setMasterName] = useState('');
  const [coName, setCoName] = useState('');
  const [ceName, setCeName] = useState('');
  const [seName, setSeName] = useState('');

  // 職災基本欄位 (YES_NO === 'YES')
  const [yesDate1, setYesDate1] = useState('');
  const [yesDate2, setYesDate2] = useState('');
  const [yesHours1, setYesHours1] = useState('0');
  const [yesHours2, setYesHours2] = useState('0');

  // 表1-1 事故調查報告表 (4ASDPF01) 完整欄位
  const [reportFiller, setReportFiller] = useState('');
  const [report1, setReport1] = useState(''); // 1. 罹災人員姓名
  const [report2, setReport2] = useState(''); // 2. 罹災人員部門/單位
  const [report3, setReport3] = useState(''); // 3. 事故時間
  const [report4, setReport4] = useState(''); // 4. 事故地點
  const [report5, setReport5] = useState(''); // 5. 受傷部份
  const [report6, setReport6] = useState('輕度'); // 6. 傷害嚴重程度
  const [report7, setReport7] = useState(''); // 7. 造成傷害之體、設備或物質
  const [report8, setReport8] = useState('0'); // 8. 總損失工時
  const [report9, setReport9] = useState(''); // 9. 罹災人員職務
  const [report10, setReport10] = useState(''); // 10. 罹災人員年齡/年資
  const [report11, setReport11] = useState(''); // 11. 損壞財物名稱
  const [report12, setReport12] = useState(''); // 12. 損壞狀況
  const [report13, setReport13] = useState(''); // 13. 損失金額
  const [report14, setReport14] = useState(''); // 14. 造成損失之物體、設備或物質
  const [report15, setReport15] = useState(''); // 15. 操作/管理7或14項之人員
  const [report16, setReport16] = useState(''); // 16. 事故類型
  const [report17, setReport17] = useState(''); // 17. 事故提報人員
  const [report18, setReport18] = useState(''); // 18. 相關物體、設備或物質
  const [report19, setReport19] = useState(''); // 19. 描述說明事故相關資訊 (人、事、時、地、物、如何)
  const [report20, setReport20] = useState(''); // 20. 直接原因
  const [report21, setReport21] = useState(''); // 21. 間接原因
  const [report22, setReport22] = useState(''); // 22. 基本原因
  const [reportAccident, setReportAccident] = useState(false); // 處理確認勾選
  const [report23, setReport23] = useState(''); // 23. 改善措施 (條列式 1.2.3.)
  const [reportAuthorized, setReportAuthorized] = useState(''); // 權責主管
  const [reportOccupational, setReportOccupational] = useState(''); // 勞安主管
  const [reportInvestigator, setReportInvestigator] = useState(''); // 調查人員
  const [reportLabor, setReportLabor] = useState(''); // 勞工代表

  // 表1-2 事故原因及現有管理措施查核表狀態
  const [showTable12, setShowTable12] = useState(false);
  const [report24Map, setReport24Map] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (let i = 1; i <= 24; i++) {
      init[`REPORT24_${i}`] = i === 14 || i === 24 ? '' : 'N';
    }
    return init;
  });
  const [report25Map, setReport25Map] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (let i = 1; i <= 25; i++) {
      init[`REPORT25_${i}`] = i === 13 || i === 25 ? '' : 'N';
    }
    return init;
  });
  const [report26Map, setReport26Map] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (let i = 1; i <= 34; i++) {
      init[`REPORT26_${i}`] = i === 8 || i === 15 || i === 34 ? '' : 'N';
    }
    for (let i = 35; i <= 46; i++) {
      init[`REPORT26_${i}`] = '';
    }
    return init;
  });

  // 當月份所有在船人員及個別工作時數統計（包含中途上下船人員）
  const crewWorkDetails = useMemo(() => {
    const monthStart = `${selYear}-${selMonth}-01`;
    const lastDayStr = `${selYear}-${selMonth}-${String(daysInMonth).padStart(2, '0')}`;

    return crewList
      .filter(c => {
        if (c.hasSignOff && c.signOffDate && c.signOffDate < monthStart) return false;
        if (c.hasSignOn && c.signOnDate && c.signOnDate > lastDayStr) return false;
        return true;
      })
      .map((c, idx) => {
        let totalWorkSlots = 0;
        const ov = allCrewOverrides[c.id] || { slots: {}, remarks: {} };

        for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
          const rowKey = `day_${dayNum}`;
          const ds = `${selYear}-${selMonth}-${String(dayNum).padStart(2, '0')}`;
          const dd = dailyData[rowKey] || emptyDay();
          const os = ov.slots?.[rowKey] || {};

          for (let sIdx = 0; sIdx < 48; sIdx++) {
            const b = resolveCrewWorkSlots(c, dd, ds, sIdx);
            const f = os[sIdx] !== undefined ? os[sIdx] : b;
            if (f !== null) {
              totalWorkSlots++;
            }
          }
        }

        const totalHours = totalWorkSlots * 0.5;
        const autoIsEngine = isEngineRank(c.rank);
        const isEngine =
          deptOverrides[c.id] !== undefined ? deptOverrides[c.id] === 'ENGINE' : autoIsEngine;

        let statusTag = '全月在船';
        if (c.hasSignOn && c.signOnDate && c.signOnDate >= monthStart) {
          statusTag = `${c.signOnDate.slice(5)} 上船`;
        }
        if (c.hasSignOff && c.signOffDate && c.signOffDate <= lastDayStr) {
          statusTag = statusTag === '全月在船' ? `${c.signOffDate.slice(5)} 下船` : `${statusTag} / ${c.signOffDate.slice(5)} 下船`;
        }

        return {
          idx: idx + 1,
          id: c.id,
          name: c.name?.trim() ? c.name.trim() : '-',
          engName: c.engName?.trim() ? c.engName.trim() : '-',
          rank: c.rank || '未設定',
          isEngine,
          statusTag,
          totalSlots: totalWorkSlots,
          totalHours,
        };
      });
  }, [crewList, dailyData, allCrewOverrides, selYear, selMonth, daysInMonth, deptOverrides]);

  // 自動依據名單預填幹部姓名 (供 XML 簽核背景欄位)
  useEffect(() => {
    const capt = crewList.find(c => /(CAPT|MASTER|船長)/i.test(c.rank || ''));
    if (capt && !masterName) setMasterName(capt.name ? `${capt.rank} ${capt.name}` : capt.rank);

    const co = crewList.find(c => /(C[\/\.]?O|CHIEF\s+MATE|大副)/i.test(c.rank || ''));
    if (co && !coName) setCoName(co.name ? `${co.rank} ${co.name}` : co.rank);

    const ce = crewList.find(c => isEngineRank(c.rank) && /(C[\/\.]?E|CHIEF|輪機長)/i.test(c.rank || ''));
    if (ce && !ceName) setCeName(ce.name ? `${ce.rank} ${ce.name}` : ce.rank);

    const se = crewList.find(c => /(2[\/\.]?E|1[\/\.]?AE|SECOND|大管)/i.test(c.rank || ''));
    if (se && !seName) setSeName(se.name ? `${se.rank} ${se.name}` : se.rank);
  }, [crewList]);

  // 3. 工時計算：甲板部總工時預設自動帶入；機艙部工時預設自動帶入，若有手動輸入則手動覆蓋
  const { deckCrewCount, engineCrewCount, calculatedDeckHours, calculatedEngineHours } = useMemo(() => {
    let dHours = 0;
    let eHours = 0;
    let dCount = 0;
    let eCount = 0;

    crewWorkDetails.forEach(c => {
      if (c.isEngine) {
        eHours += c.totalHours;
        eCount++;
      } else {
        dHours += c.totalHours;
        dCount++;
      }
    });

    return {
      deckCrewCount: dCount,
      engineCrewCount: eCount,
      calculatedDeckHours: dHours,
      calculatedEngineHours: eHours,
    };
  }, [crewWorkDetails]);

  // 甲板部總工時：自動帶入
  const finalDeckHours = calculatedDeckHours;

  // 機艙部總工時：預設自動帶入，若有手動覆蓋輸入框的值則手動覆蓋
  const isEngineManualOverridden = engineHoursInput.trim() !== '';
  const finalEngineHours = useMemo(() => {
    if (isEngineManualOverridden) {
      return parseFloat(engineHoursInput) || 0;
    }
    return calculatedEngineHours;
  }, [isEngineManualOverridden, engineHoursInput, calculatedEngineHours]);

  // 全船當月總工時 = 甲板部 (自動帶入) + 機艙部 (自動帶入或手動覆蓋)
  const finalTotalHours = finalDeckHours + finalEngineHours;

  // 4. 構建完全符合公司版本的 XML（嚴格無換行、無縮排，139 欄位精確對齊 FFS）
  const buildCompanyXml = () => {
    const dateObj = new Date(parseInt(selYear, 10), parseInt(selMonth, 10) - 1, 1);
    const dateStr = dateObj.toString();
    const isYes = yesNo === 'YES';

    const fields: Record<string, string | number | boolean> = {
      CATEGORY: 'WEB_FFS',
      FORM_TYPE: 'occupational_injury',
      IMO: imoNo || localStorage.getItem('imoNo') || shipInfo.imoNo || '9319131',
      VESSEL_NAME: vesselName || localStorage.getItem('vesselName') || shipInfo.vesselName || 'YM IMMENSE',
      YEAR_MONTH: dateStr,
      YES_NO: yesNo,
      NO_HOURS: isYes ? '' : Math.round(finalTotalHours),
      YES_DATE1: isYes && yesDate1 ? new Date(yesDate1).toString() : '',
      YES_DATE2: isYes && yesDate2 ? new Date(yesDate2).toString() : '',
      YES_HOURS1: isYes ? parseFloat(yesHours1) || 0 : '',
      YES_HOURS2: isYes ? parseFloat(yesHours2) || 0 : '',
      MASTER: isYes ? (masterName || '') : '',
      CO: isYes ? (coName || '') : '',
      CE: isYes ? (ceName || '') : '',
      SE: isYes ? (seName || '') : '',
      REPORT_FILLER: isYes ? (reportFiller || '') : '',
      REPORT_AUTHORIZED: isYes ? (reportAuthorized || '') : '',
      REPORT_OCCUPATIONAL: isYes ? (reportOccupational || '') : '',
      REPORT_INVESTIGATOR: isYes ? (reportInvestigator || '') : '',
      REPORT_LABOR: isYes ? (reportLabor || '') : '',
      REPORT_ACCIDENT: isYes ? (reportAccident ? 'true' : 'false') : '',
      REPORT1: isYes ? (report1 || '') : '',
      REPORT2: isYes ? (report2 || '') : '',
      REPORT3: isYes ? (report3 || '') : '',
      REPORT4: isYes ? (report4 || '') : '',
      REPORT5: isYes ? (report5 || '') : '',
      REPORT6: isYes ? (report6 || '') : '',
      REPORT7: isYes ? (report7 || '') : '',
      REPORT8: isYes ? (report8 || '') : '',
      REPORT9: isYes ? (report9 || '') : '',
      REPORT10: isYes ? (report10 || '') : '',
      REPORT11: isYes ? (report11 || '') : '',
      REPORT12: isYes ? (report12 || '') : '',
      REPORT13: isYes ? (report13 || '') : '',
      REPORT14: isYes ? (report14 || '') : '',
      REPORT15: isYes ? (report15 || '') : '',
      REPORT16: isYes ? (report16 || '') : '',
      REPORT17: isYes ? (report17 || '') : '',
      REPORT18: isYes ? (report18 || '') : '',
      REPORT19: isYes ? (report19 || '') : '',
      REPORT20: isYes ? (report20 || '') : '',
      REPORT21: isYes ? (report21 || '') : '',
      REPORT22: isYes ? (report22 || '') : '',
      REPORT23: isYes ? (report23 || '') : '',
    };

    // 表 1-2 填報欄位 (REPORT24_1 ~ REPORT26_46)
    // 若無職災 (NO)，全部欄位皆保持空白，不輸出 'N' 或其他預設值
    for (let i = 1; i <= 24; i++) {
      const k = `REPORT24_${i}`;
      fields[k] = isYes
        ? (report24Map[k] !== undefined ? report24Map[k] : i === 14 || i === 24 ? '' : 'N')
        : '';
    }
    for (let i = 1; i <= 25; i++) {
      const k = `REPORT25_${i}`;
      fields[k] = isYes
        ? (report25Map[k] !== undefined ? report25Map[k] : i === 13 || i === 25 ? '' : 'N')
        : '';
    }
    for (let i = 1; i <= 34; i++) {
      const k = `REPORT26_${i}`;
      fields[k] = isYes
        ? (report26Map[k] !== undefined ? report26Map[k] : i === 8 || i === 15 || i === 34 ? '' : 'N')
        : '';
    }
    for (let i = 35; i <= 46; i++) {
      const k = `REPORT26_${i}`;
      fields[k] = isYes ? (report26Map[k] !== undefined ? report26Map[k] : '') : '';
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<form>';
    for (const key of Object.keys(fields)) {
      if (key === 'CATEGORY') {
        xml += `<${key}>WEB_FFS</${key}>`;
      } else {
        xml += `<${key}>${fields[key]}</${key}>`;
      }
    }
    xml += '</form>';

    return xml;
  };

  // 匯出 XML 檔案下載
  const handleExportXml = () => {
    const xml = buildCompanyXml();
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });

    // 檔名：船名無職災工時紀錄年月.xml（若有職災則為 船名職災工時紀錄年月.xml）
    const cleanVessel = (vesselName || shipInfo.vesselName || localStorage.getItem('vesselName') || 'YM IMMENSE').trim();
    const docType = yesNo === 'YES' ? '職災工時紀錄' : '無職災工時紀錄';
    const filename = `${cleanVessel}${docType}${selYear}${selMonth}.xml`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`已成功匯出 XML: ${filename}`, 'success');
  };

  // 匯入外部 XML 檔案
  const handleImportXml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const text = evt.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        const formType = xmlDoc.querySelector('FORM_TYPE')?.textContent;
        if (formType && formType !== 'occupational_injury') {
          showToast(`此檔案表單類別為 [${formType}]，非 occupational_injury`, 'error');
          return;
        }

        const vName = xmlDoc.querySelector('VESSEL_NAME')?.textContent;
        if (vName) setVesselName(vName);

        const imo = xmlDoc.querySelector('IMO')?.textContent;
        if (imo) setImoNo(imo);

        const yn = xmlDoc.querySelector('YES_NO')?.textContent;
        if (yn === 'YES' || yn === 'NO') setYesNo(yn);

        const noH = xmlDoc.querySelector('NO_HOURS')?.textContent;
        if (noH) {
          const numH = parseFloat(noH) || 0;
          const diff = Math.max(0, numH - finalDeckHours);
          setEngineHoursInput(diff > 0 ? diff.toFixed(1) : '');
        }

        const m = xmlDoc.querySelector('MASTER')?.textContent;
        if (m) setMasterName(m);
        const co = xmlDoc.querySelector('CO')?.textContent;
        if (co) setCoName(co);
        const ce = xmlDoc.querySelector('CE')?.textContent;
        if (ce) setCeName(ce);
        const se = xmlDoc.querySelector('SE')?.textContent;
        if (se) setSeName(se);

        // 職災基本資料
        const yd1 = xmlDoc.querySelector('YES_DATE1')?.textContent;
        if (yd1) {
          const d = new Date(yd1);
          if (!isNaN(d.getTime())) setYesDate1(d.toISOString().slice(0, 10));
        }
        const yd2 = xmlDoc.querySelector('YES_DATE2')?.textContent;
        if (yd2) {
          const d = new Date(yd2);
          if (!isNaN(d.getTime())) setYesDate2(d.toISOString().slice(0, 10));
        }
        const yh1 = xmlDoc.querySelector('YES_HOURS1')?.textContent;
        if (yh1) setYesHours1(yh1);
        const yh2 = xmlDoc.querySelector('YES_HOURS2')?.textContent;
        if (yh2) setYesHours2(yh2);

        // 表1-1 欄位還原
        const getVal = (tag: string) => xmlDoc.querySelector(tag)?.textContent || '';
        setReportFiller(getVal('REPORT_FILLER'));
        setReportAuthorized(getVal('REPORT_AUTHORIZED'));
        setReportOccupational(getVal('REPORT_OCCUPATIONAL'));
        setReportInvestigator(getVal('REPORT_INVESTIGATOR'));
        setReportLabor(getVal('REPORT_LABOR'));
        setReportAccident(getVal('REPORT_ACCIDENT') === 'true');
        setReport1(getVal('REPORT1'));
        setReport2(getVal('REPORT2'));
        setReport3(getVal('REPORT3'));
        setReport4(getVal('REPORT4'));
        setReport5(getVal('REPORT5'));
        setReport6(getVal('REPORT6') || '輕度');
        setReport7(getVal('REPORT7'));
        setReport8(getVal('REPORT8'));
        setReport9(getVal('REPORT9'));
        setReport10(getVal('REPORT10'));
        setReport11(getVal('REPORT11'));
        setReport12(getVal('REPORT12'));
        setReport13(getVal('REPORT13'));
        setReport14(getVal('REPORT14'));
        setReport15(getVal('REPORT15'));
        setReport16(getVal('REPORT16'));
        setReport17(getVal('REPORT17'));
        setReport18(getVal('REPORT18'));
        setReport19(getVal('REPORT19'));
        setReport20(getVal('REPORT20'));
        setReport21(getVal('REPORT21'));
        setReport22(getVal('REPORT22'));
        setReport23(getVal('REPORT23'));

        // 表1-2 欄位還原
        const new24: Record<string, string> = {};
        for (let i = 1; i <= 24; i++) {
          const val = xmlDoc.querySelector(`REPORT24_${i}`)?.textContent;
          if (val !== undefined && val !== null) new24[`REPORT24_${i}`] = val;
        }
        setReport24Map(prev => ({ ...prev, ...new24 }));

        const new25: Record<string, string> = {};
        for (let i = 1; i <= 25; i++) {
          const val = xmlDoc.querySelector(`REPORT25_${i}`)?.textContent;
          if (val !== undefined && val !== null) new25[`REPORT25_${i}`] = val;
        }
        setReport25Map(prev => ({ ...prev, ...new25 }));

        const new26: Record<string, string> = {};
        for (let i = 1; i <= 46; i++) {
          const val = xmlDoc.querySelector(`REPORT26_${i}`)?.textContent;
          if (val !== undefined && val !== null) new26[`REPORT26_${i}`] = val;
        }
        setReport26Map(prev => ({ ...prev, ...new26 }));

        showToast('XML 檔案匯入成功！已完整還原無職災/職災事故申報資料。', 'success');
      } catch {
        showToast('XML 檔案解析失敗，請確認檔案格式！', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    // D頁面全面採用淺色風格 (Light Theme)
    <div className="flex-1 bg-slate-50 text-slate-800 p-4 sm:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
      {/* 頂部功能橫列：淺色風格、純文字、包含職災有無切換與 XML 匯入/匯出 */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* 左側：標題與申報年月 */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Part D: 無職災工時紀錄
          </h1>
          <span className="text-xs text-slate-500 font-medium">
            ({selYear} 年 {selMonth} 月)
          </span>
        </div>

        {/* 中間/獨立區：無職災與有職災切換按鈕 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">申報項目:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setYesNo('NO')}
              className={`px-3.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-all ${
                yesNo === 'NO'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              NO (無職災)
            </button>
            <button
              type="button"
              onClick={() => setYesNo('YES')}
              className={`px-3.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-all ${
                yesNo === 'YES'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              YES (有職災)
            </button>
          </div>
        </div>

        {/* 右側：匯入XML 與 匯出XML */}
        <div className="flex items-center gap-2.5">
          <label className="cursor-pointer">
            <input type="file" accept=".xml,.XML" className="hidden" onChange={handleImportXml} />
            <div className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center shadow-xs transition-colors cursor-pointer">
              匯入XML
            </div>
          </label>

          <Button
            size="sm"
            onClick={handleExportXml}
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 shadow-xs cursor-pointer transition-colors"
          >
            匯出XML
          </Button>
        </div>
      </div>

      {/* 工時統計卡片：淺色風格 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 卡片 1: 全船當月總工時 (NO_HOURS) */}
        <div className="bg-white border-2 border-emerald-500/40 rounded-xl p-5 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              全船當月總工時 (NO_HOURS)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
              甲板 + 機艙
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-mono font-black text-slate-900 tracking-tight">
              {Math.round(finalTotalHours).toLocaleString()}
            </span>
            <span className="text-slate-500 font-bold text-sm">小時 (hrs)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>精確數值: {finalTotalHours.toFixed(1)} hrs</span>
            <span className="font-mono text-slate-400">
              (甲板 {finalDeckHours.toFixed(1)} + 機艙 {finalEngineHours.toFixed(1)})
            </span>
          </div>
        </div>

        {/* 卡片 2: 甲板部總工時 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
              甲板部總工時 (Deck Dept)
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-sky-800">
              {finalDeckHours.toFixed(1)}
            </span>
            <span className="text-slate-500 font-bold text-sm">小時 (hrs)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <span>(共 {deckCrewCount} 人)</span>
          </div>
        </div>

        {/* 卡片 3: 機艙部總工時 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              機艙部總工時 (Engine Dept)
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-amber-800">
              {finalEngineHours.toFixed(1)}
            </span>
            <span className="text-slate-500 font-bold text-sm">小時 (hrs)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium shrink-0">手動覆蓋:</span>
              <Input
                type="number"
                step="0.5"
                placeholder={`${calculatedEngineHours.toFixed(1)}`}
                value={engineHoursInput}
                onChange={e => setEngineHoursInput(e.target.value)}
                className="h-7 flex-1 bg-white border-slate-300 text-xs font-mono text-slate-900 focus:border-amber-500"
              />
              {isEngineManualOverridden && (
                <button
                  type="button"
                  onClick={() => setEngineHoursInput('')}
                  className="text-[11px] text-amber-700 hover:text-amber-900 underline cursor-pointer shrink-0"
                >
                  清除覆蓋
                </button>
              )}
            </div>
            <div className="text-xs text-slate-500">
              <span>(共 {engineCrewCount} 人)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 依據公司檔案製作：有職災 (YES) 完整填寫表單 (表1-1 與 表1-2) */}
      {yesNo === 'YES' && (
        <div className="flex flex-col gap-5">
          {/* 職災基本發生日與累計工時 & 事故發生的在船管理階層人員 (橫向排列節省空間) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            {/* 4 個日期與累計工時欄位橫向排列 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* 人員受傷日期 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">人員受傷日期</label>
                <Input
                  type="date"
                  value={yesDate1}
                  onChange={e => setYesDate1(e.target.value)}
                  className="h-8 bg-white border-slate-300 text-slate-900 text-xs"
                />
              </div>

              {/* 人員因傷下船日期 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">人員因傷下船日期</label>
                <Input
                  type="date"
                  value={yesDate2}
                  onChange={e => setYesDate2(e.target.value)}
                  className="h-8 bg-white border-slate-300 text-slate-900 text-xs"
                />
              </div>

              {/* 人員因傷下船前累計工時 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">人員因傷下船前累計工時</label>
                <div className="flex rounded-md shadow-xs">
                  <Input
                    type="number"
                    value={yesHours1}
                    onChange={e => setYesHours1(e.target.value)}
                    className="h-8 rounded-r-none border-r-0 bg-white border-slate-300 text-slate-900 font-mono text-xs"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-600 text-xs font-semibold select-none">
                    HR
                  </span>
                </div>
              </div>

              {/* 人員因傷下船後累計工時 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">人員因傷下船後累計工時</label>
                <div className="flex rounded-md shadow-xs">
                  <Input
                    type="number"
                    value={yesHours2}
                    onChange={e => setYesHours2(e.target.value)}
                    className="h-8 rounded-r-none border-r-0 bg-white border-slate-300 text-slate-900 font-mono text-xs"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-600 text-xs font-semibold select-none">
                    HR
                  </span>
                </div>
              </div>
            </div>

            {/* 事故發生的在船管理階層人員 (卡片，4 個幹部橫向排列) */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/70 flex flex-col gap-2.5">
              <div className="text-xs font-semibold text-slate-600 tracking-wide">
                事故發生的在船管理階層人員
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* 船長 */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">船長</label>
                  <Input
                    type="text"
                    value={masterName}
                    onChange={e => setMasterName(e.target.value)}
                    className="h-8 bg-white border-slate-300 text-slate-900 text-xs"
                  />
                </div>

                {/* 大副 */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">大副</label>
                  <Input
                    type="text"
                    value={coName}
                    onChange={e => setCoName(e.target.value)}
                    className="h-8 bg-white border-slate-300 text-slate-900 text-xs"
                  />
                </div>

                {/* 輪機長 */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">輪機長</label>
                  <Input
                    type="text"
                    value={ceName}
                    onChange={e => setCeName(e.target.value)}
                    className="h-8 bg-white border-slate-300 text-slate-900 text-xs"
                  />
                </div>

                {/* 大管輪 */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">大管輪</label>
                  <Input
                    type="text"
                    value={seName}
                    onChange={e => setSeName(e.target.value)}
                    className="h-8 bg-white border-slate-300 text-slate-900 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 表1-1 事故調查報告表 (4ASDPF01) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 font-mono font-bold text-xs">
                  表1-1
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  事故調查報告表
                </h3>
                <span className="text-xs text-slate-500">
                  (表單編號: 4ASDPF01) (2019.05)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600">填表人：</span>
                <Input
                  value={reportFiller}
                  onChange={e => setReportFiller(e.target.value)}
                  placeholder="請填入填表人姓名"
                  className="h-7 w-36 bg-white border-slate-300 text-slate-900 text-xs"
                />
              </div>
            </div>

            {/* 區塊 1: 確認資料 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-slate-800 tracking-wider">確認資料</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-slate-600 block mb-1">1. 罹災人員姓名 (REPORT1):</label>
                  <Input
                    value={report1}
                    onChange={e => setReport1(e.target.value)}
                    placeholder="若無罹災人員則免填"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">2. 罹災人員部門/單位 (REPORT2):</label>
                  <Input
                    value={report2}
                    onChange={e => setReport2(e.target.value)}
                    placeholder="例如: 甲板部 / 機艙部"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">3. 事故時間 (REPORT3):</label>
                  <Input
                    value={report3}
                    onChange={e => setReport3(e.target.value)}
                    placeholder="YYYY-MM-DD HH:mm"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">4. 事故地點 (REPORT4):</label>
                  <Input
                    value={report4}
                    onChange={e => setReport4(e.target.value)}
                    placeholder="例如: 主甲板左舷 / 機艙二層"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* 區塊 2: 三欄分類 (人員傷害 / 財產損失 / 其他) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* 人員傷害欄 */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-2.5">
                <span className="font-bold text-amber-800 border-b border-slate-200 pb-1.5 block">
                  人員傷害
                </span>
                <div>
                  <label className="text-slate-600 block mb-1">5. 受傷部份 (REPORT5):</label>
                  <select
                    value={report5}
                    onChange={e => setReport5(e.target.value)}
                    className="w-full h-8 bg-white border border-slate-300 rounded px-2 text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">請選擇受傷部位...</option>
                    {INJURY_PARTS.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">6. 傷害嚴重程度 (REPORT6):</label>
                  <Input
                    value={report6}
                    onChange={e => setReport6(e.target.value)}
                    placeholder="輕度 / 中度 / 重度"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">7. 造成傷害之體、設備或物質 (REPORT7):</label>
                  <Input
                    value={report7}
                    onChange={e => setReport7(e.target.value)}
                    placeholder="如: 鋼索、絞機、階梯"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">8. 總損失工時 (REPORT8, 復工後加註):</label>
                  <Input
                    value={report8}
                    onChange={e => setReport8(e.target.value)}
                    placeholder="小時"
                    className="h-8 bg-white border-slate-300 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">9. 罹災人員職務 (REPORT9):</label>
                  <Input
                    value={report9}
                    onChange={e => setReport9(e.target.value)}
                    placeholder="如: AB 水手 / OILER 加油"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">10. 罹災人員年齡/年資 (REPORT10):</label>
                  <Input
                    value={report10}
                    onChange={e => setReport10(e.target.value)}
                    placeholder="如: 35歲 / 5年"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {/* 財產損失欄 */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-2.5">
                <span className="font-bold text-sky-800 border-b border-slate-200 pb-1.5 block">
                  財產損失
                </span>
                <div>
                  <label className="text-slate-600 block mb-1">11. 損壞財物名稱 (REPORT11):</label>
                  <Input
                    value={report11}
                    onChange={e => setReport11(e.target.value)}
                    placeholder="損壞機具、設備名稱"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">12. 損壞狀況 (REPORT12):</label>
                  <Input
                    value={report12}
                    onChange={e => setReport12(e.target.value)}
                    placeholder="破損、變形、燒毀等"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">13. 損失金額 (REPORT13):</label>
                  <Input
                    value={report13}
                    onChange={e => setReport13(e.target.value)}
                    placeholder="估計維修或重置金額"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">14. 造成損失之物體、設備或物質 (REPORT14):</label>
                  <Input
                    value={report14}
                    onChange={e => setReport14(e.target.value)}
                    placeholder="加害物或媒介物"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">15. 操作/管理7或14項之人員 (REPORT15):</label>
                  <Input
                    value={report15}
                    onChange={e => setReport15(e.target.value)}
                    placeholder="人員姓名或職稱"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {/* 其他資訊欄 */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-2.5">
                <span className="font-bold text-emerald-800 border-b border-slate-200 pb-1.5 block">
                  事故類型與提報
                </span>
                <div>
                  <label className="text-slate-600 block mb-1">
                    16. 事故類型 (REPORT16, 必填):
                  </label>
                  <select
                    value={report16}
                    onChange={e => setReport16(e.target.value)}
                    className="w-full h-8 bg-white border border-slate-300 rounded px-2 text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">請選擇災害類型 (勞動部標準)...</option>
                    {ACCIDENT_TYPES.map(a => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">17. 事故提報人員 (REPORT17, 必填):</label>
                  <Input
                    value={report17}
                    onChange={e => setReport17(e.target.value)}
                    placeholder="提報者姓名"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">18. 相關物體、設備或物質 (REPORT18):</label>
                  <Input
                    value={report18}
                    onChange={e => setReport18(e.target.value)}
                    placeholder="周遭相關環境或物件"
                    className="h-8 bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* 區塊 3: 事故描述與原因分析 */}
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  19. 事故描述：說明事故相關資訊 (人、事、時、地、物、如何) (REPORT19):
                </label>
                <textarea
                  rows={3}
                  value={report19}
                  onChange={e => setReport19(e.target.value)}
                  placeholder="詳細敘述事故前因後果..."
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    20. 直接原因 (造成災害之能量及物質) (REPORT20):
                  </label>
                  <textarea
                    rows={2}
                    value={report20}
                    onChange={e => setReport20(e.target.value)}
                    placeholder="如: 物體墜落、人員滑倒"
                    className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    21. 間接原因 (不安全動作/設備/環境) (REPORT21):
                  </label>
                  <textarea
                    rows={2}
                    value={report21}
                    onChange={e => setReport21(e.target.value)}
                    placeholder="如: 未穿戴防滑鞋、甲板濕滑"
                    className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    22. 基本原因 (人為/管理及環境缺失) (REPORT22):
                  </label>
                  <textarea
                    rows={2}
                    value={report22}
                    onChange={e => setReport22(e.target.value)}
                    placeholder="如: 缺乏安全巡檢、作業標準未落實"
                    className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* 處理確認勾選 */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="reportAccidentCheck"
                  checked={reportAccident}
                  onChange={e => setReportAccident(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                />
                <label htmlFor="reportAccidentCheck" className="text-xs text-slate-800 cursor-pointer">
                  事故缺失狀況 (不安全環境/設施設備/行為缺失) 已去除完畢，已隔離人員禁止接近及操作，無立即再發危險 (REPORT_ACCIDENT)
                </label>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  23. 改善措施：請以條列式 1. 2. 3. 方式填寫 (REPORT23):
                </label>
                <textarea
                  rows={2}
                  value={report23}
                  onChange={e => setReport23(e.target.value)}
                  placeholder="1. 立即清除甲板油漬&#10;2. 加強船員安全衛生講習&#10;3. 落實每日工安巡檢"
                  className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-900 text-xs focus:ring-1 focus:ring-sky-500 font-mono"
                />
              </div>
            </div>

            {/* 簽署欄位 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-200">
              <div>
                <label className="text-slate-600 block mb-1">權責主管 (REPORT_AUTHORIZED):</label>
                <Input
                  value={reportAuthorized}
                  onChange={e => setReportAuthorized(e.target.value)}
                  placeholder="主管簽署"
                  className="h-8 bg-white border-slate-300 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">勞安主管 (REPORT_OCCUPATIONAL):</label>
                <Input
                  value={reportOccupational}
                  onChange={e => setReportOccupational(e.target.value)}
                  placeholder="勞安負責人簽署"
                  className="h-8 bg-white border-slate-300 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">調查人員 (REPORT_INVESTIGATOR):</label>
                <Input
                  value={reportInvestigator}
                  onChange={e => setReportInvestigator(e.target.value)}
                  placeholder="事故調查人員簽署"
                  className="h-8 bg-white border-slate-300 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">勞工代表 (REPORT_LABOR):</label>
                <Input
                  value={reportLabor}
                  onChange={e => setReportLabor(e.target.value)}
                  placeholder="勞工代表簽署"
                  className="h-8 bg-white border-slate-300 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* 表1-2 事故原因及現有管理措施查核表 (可折疊面板) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setShowTable12(!showTable12)}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 font-mono font-bold text-xs">
                  表1-2
                </span>
                <span className="font-bold text-sm text-slate-900">
                  事故原因及現有管理措施查核表 (查核項 REPORT24 ~ REPORT26)
                </span>
              </div>
              <span className="text-xs text-slate-600 font-semibold">
                {showTable12 ? '▲ 收合查核表' : '▼ 展開完整查核表'}
              </span>
            </button>

            {showTable12 && (
              <div className="p-5 flex flex-col gap-5 text-xs border-t border-slate-200">
                {/* 24. 直接原因 */}
                <div className="flex flex-col gap-2.5">
                  <h4 className="font-bold text-sky-800 border-b border-slate-200 pb-1.5">
                    24. 直接原因（加害物包括危害能量及有害物質）
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 危害能量來源 */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                      <span className="font-semibold text-slate-700">（一）危害能量來源</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'REPORT24_1', label: '機械' },
                          { key: 'REPORT24_2', label: '工具' },
                          { key: 'REPORT24_3', label: '運動中物件' },
                          { key: 'REPORT24_4', label: '人體動作' },
                          { key: 'REPORT24_5', label: '未經絕緣之導體' },
                          { key: 'REPORT24_6', label: '高壓電未做好接地' },
                          { key: 'REPORT24_7', label: '電氣設備絕緣劣化' },
                          { key: 'REPORT24_8', label: '燃燒物體' },
                          { key: 'REPORT24_9', label: '高熱物體' },
                          { key: 'REPORT24_10', label: '物體飛落' },
                          { key: 'REPORT24_11', label: '人體飛落' },
                          { key: 'REPORT24_12', label: '輻射' },
                          { key: 'REPORT24_13', label: '噪音' },
                        ].map(item => (
                          <div key={item.key} className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1 rounded">
                            <span className="text-slate-700">{item.label}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setReport24Map(p => ({ ...p, [item.key]: 'Y' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report24Map[item.key] === 'Y' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Y
                              </button>
                              <button
                                type="button"
                                onClick={() => setReport24Map(p => ({ ...p, [item.key]: 'N' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report24Map[item.key] !== 'Y' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                N
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-600 w-16">其他填寫:</span>
                        <Input
                          value={report24Map['REPORT24_14'] || ''}
                          onChange={e => setReport24Map(p => ({ ...p, REPORT24_14: e.target.value }))}
                          placeholder="補充其他能量來源"
                          className="h-7 bg-white border-slate-300 text-slate-900 text-xs"
                        />
                      </div>
                    </div>

                    {/* 有害物質 */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                      <span className="font-semibold text-slate-700">（二）有害物質</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'REPORT24_15', label: '壓縮或液化氣體' },
                          { key: 'REPORT24_16', label: '腐蝕性物質' },
                          { key: 'REPORT24_17', label: '易燃性物質' },
                          { key: 'REPORT24_18', label: '氧化性物質' },
                          { key: 'REPORT24_19', label: '毒性物質' },
                          { key: 'REPORT24_20', label: '放射性物質' },
                          { key: 'REPORT24_21', label: '致病劑' },
                          { key: 'REPORT24_22', label: '粉塵' },
                          { key: 'REPORT24_23', label: '爆炸物' },
                        ].map(item => (
                          <div key={item.key} className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1 rounded">
                            <span className="text-slate-700">{item.label}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setReport24Map(p => ({ ...p, [item.key]: 'Y' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report24Map[item.key] === 'Y' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Y
                              </button>
                              <button
                                type="button"
                                onClick={() => setReport24Map(p => ({ ...p, [item.key]: 'N' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report24Map[item.key] !== 'Y' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                N
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-600 w-16">其他填寫:</span>
                        <Input
                          value={report24Map['REPORT24_24'] || ''}
                          onChange={e => setReport24Map(p => ({ ...p, REPORT24_24: e.target.value }))}
                          placeholder="補充其他有害物質"
                          className="h-7 bg-white border-slate-300 text-slate-900 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 25. 間接原因 */}
                <div className="flex flex-col gap-2.5">
                  <h4 className="font-bold text-amber-800 border-b border-slate-200 pb-1.5">
                    25. 間接原因（不安全動作/行為及不安全狀況/環境）
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 不安全行為 */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                      <span className="font-semibold text-slate-700">1. 不安全動作或行為（人為）</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'REPORT25_1', label: '使用有缺陷之機具' },
                          { key: 'REPORT25_2', label: '使用機具方法不當' },
                          { key: 'REPORT25_3', label: '未使用個人防護具' },
                          { key: 'REPORT25_4', label: '未使用適當之工具' },
                          { key: 'REPORT25_5', label: '不正確之提舉' },
                          { key: 'REPORT25_6', label: '不正確裝載機具物料' },
                          { key: 'REPORT25_7', label: '使安全防護失效' },
                          { key: 'REPORT25_8', label: '向運轉中機械進/取料' },
                          { key: 'REPORT25_9', label: '未經授權逕行操作' },
                          { key: 'REPORT25_10', label: '不正確之工作姿勢' },
                          { key: 'REPORT25_11', label: '在工作中嬉鬧' },
                          { key: 'REPORT25_12', label: '酗酒或吸食麻醉劑' },
                        ].map(item => (
                          <div key={item.key} className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1 rounded">
                            <span className="text-slate-700 truncate pr-1">{item.label}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setReport25Map(p => ({ ...p, [item.key]: 'Y' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report25Map[item.key] === 'Y' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Y
                              </button>
                              <button
                                type="button"
                                onClick={() => setReport25Map(p => ({ ...p, [item.key]: 'N' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report25Map[item.key] !== 'Y' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                N
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-600 w-16">其他填寫:</span>
                        <Input
                          value={report25Map['REPORT25_13'] || ''}
                          onChange={e => setReport25Map(p => ({ ...p, REPORT25_13: e.target.value }))}
                          placeholder="補充其他不安全動作"
                          className="h-7 bg-white border-slate-300 text-slate-900 text-xs"
                        />
                      </div>
                    </div>

                    {/* 不安全狀況 */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                      <span className="font-semibold text-slate-700">2. 不安全狀況（設備或環境）</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'REPORT25_14', label: '工作場所擁擠' },
                          { key: 'REPORT25_15', label: '工具設備有缺陷' },
                          { key: 'REPORT25_16', label: '高度噪音' },
                          { key: 'REPORT25_17', label: '有火災或爆炸之虞' },
                          { key: 'REPORT25_18', label: '大氣環境之危害性' },
                          { key: 'REPORT25_19', label: '防護或支撐不良' },
                          { key: 'REPORT25_20', label: '警報系統不良' },
                          { key: 'REPORT25_21', label: '場地不清潔物品散亂' },
                          { key: 'REPORT25_22', label: '採光照明不良' },
                          { key: 'REPORT25_23', label: '通風不良' },
                          { key: 'REPORT25_24', label: '輻射暴露' },
                        ].map(item => (
                          <div key={item.key} className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1 rounded">
                            <span className="text-slate-700 truncate pr-1">{item.label}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setReport25Map(p => ({ ...p, [item.key]: 'Y' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report25Map[item.key] === 'Y' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Y
                              </button>
                              <button
                                type="button"
                                onClick={() => setReport25Map(p => ({ ...p, [item.key]: 'N' }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                  report25Map[item.key] !== 'Y' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                N
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-600 w-16">其他填寫:</span>
                        <Input
                          value={report25Map['REPORT25_25'] || ''}
                          onChange={e => setReport25Map(p => ({ ...p, REPORT25_25: e.target.value }))}
                          placeholder="補充其他環境狀況"
                          className="h-7 bg-white border-slate-300 text-slate-900 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 26. 管理措施查核 (P / S / C) */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-2">
                    <h4 className="font-bold text-emerald-800">
                      26. 現有管理措施查核 (P: 目前缺乏需新增, S: 不當之措施, C: 未遵行該措施)
                    </h4>
                    <span className="text-slate-500 text-[11px]">可留空或依現況選取 P / S / C</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {[
                      { key: 'REPORT26_35', label: '1. 主管人員訓練' },
                      { key: 'REPORT26_36', label: '2. 定期檢查' },
                      { key: 'REPORT26_37', label: '3. 事故調查' },
                      { key: 'REPORT26_38', label: '4. 緊急應變規劃及演練' },
                      { key: 'REPORT26_39', label: '5. 安全作業規章及標準' },
                      { key: 'REPORT26_40', label: '6. 事故分析' },
                      { key: 'REPORT26_41', label: '7. 員工訓練' },
                      { key: 'REPORT26_42', label: '8. 個人防護器具' },
                      { key: 'REPORT26_43', label: '9. 健康管理' },
                      { key: 'REPORT26_44', label: '10. 工程控制' },
                      { key: 'REPORT26_45', label: '11. 個人溝通' },
                      { key: 'REPORT26_46', label: '12. 一般宣導' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1.5 rounded">
                        <span className="text-slate-700 font-medium truncate pr-1">{item.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {['P', 'S', 'C'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() =>
                                setReport26Map(p => ({
                                  ...p,
                                  [item.key]: p[item.key] === val ? '' : val,
                                }))
                              }
                              className={`w-5 h-5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                report26Map[item.key] === val
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 當月在船人員工作時數明細清單：淺色風格 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900">
            當月份在船人員工作時間明細
          </h2>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-12 text-center">No.</th>
                <th className="py-2.5 px-3">職稱 (Rank)</th>
                <th className="py-2.5 px-3">姓名 (Name)</th>
                <th className="py-2.5 px-3">英文名 (Eng Name)</th>
                <th className="py-2.5 px-3 text-center">所屬部門 (點擊切換)</th>
                <th className="py-2.5 px-3 text-center">當月在船狀態</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">工作總時數 (Hours)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
              {crewWorkDetails.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-center text-slate-500">{c.idx}</td>
                  <td className="py-2 px-3 font-bold text-sky-800">{c.rank}</td>
                  <td className="py-2 px-3 font-sans font-semibold text-slate-900">{c.name}</td>
                  <td className="py-2 px-3 text-slate-500 font-sans">{c.engName}</td>
                  <td className="py-2 px-3 text-center font-sans">
                    <button
                      type="button"
                      onClick={() => toggleCrewDept(c.id, c.isEngine)}
                      title="點擊手動切換甲板/機艙部門"
                      className="cursor-pointer transition-transform active:scale-95"
                    >
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 border shadow-2xs ${
                          c.isEngine
                            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            : 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                        }`}
                      >
                        {c.isEngine ? '機艙部' : '甲板部'}
                        <span className="text-[9px] text-slate-400">⇄</span>
                      </span>
                    </button>
                  </td>
                  <td className="py-2 px-3 text-center font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        c.statusTag === '全月在船'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-orange-50 text-orange-800 border border-orange-200'
                      }`}
                    >
                      {c.statusTag}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-black text-slate-900 text-sm">
                    {c.totalHours.toFixed(1)} <span className="text-xs text-slate-400 font-normal">h</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                <td colSpan={6} className="py-2.5 px-3 text-right font-sans text-slate-700">
                  當月名單人員合計工時:
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm font-black">
                  {crewWorkDetails.reduce((sum, c) => sum + c.totalHours, 0).toFixed(1)} h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
