import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, User, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { CrewMember, DayData, CrewOverrides } from '../../types/restHours';
import {
  buildDisplayRows,
  getDaysInMonth,
  getLookbackMonthSlots,
  evaluateMLCWithLookback,
  get24hRestPeriods,
  resolveCrewWorkSlots,
  isSlotOnBoard,
  isDayCompletelyOffBoard,
} from '../../utils/restHoursUtils';
import { emptyDay, DEFAULT_SHIP_INFO } from '../../utils/restHoursData';
import { IMO_LOGO_BASE64, ILO_LOGO_BASE64 } from './logos';

interface PrintRestHoursModalProps {
  open: boolean;
  onClose: () => void;
  selYear: string;
  selMonth: string;
  crewList: CrewMember[];
  selectedCrewId: string;
  dailyData: Record<string, DayData>;
  allCrewOverrides: Record<string, CrewOverrides>;
}

const MONTH_ABBR: Record<string, string> = {
  '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR',
  '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AUG',
  '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DEC',
};

const ZH_FONT = "'標楷體', 'DFKai-SB', 'BiauKai TC', 'BiauKai', 'Noto Serif TC', serif";
const EN_FONT = "'Calibri', Arial, 'Liberation Sans', sans-serif";

export const PrintRestHoursModal: React.FC<PrintRestHoursModalProps> = ({
  open,
  onClose,
  selYear,
  selMonth,
  crewList,
  selectedCrewId,
  dailyData,
  allCrewOverrides,
}) => {
  if (!open) return null;

  const daysInMonth = getDaysInMonth(selYear, selMonth);
  const monthAbbr = MONTH_ABBR[selMonth] || selMonth;

  // 讀取船舶資訊預設值
  const shipInfo = useMemo(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('ship_working_arrangement_info') || 'null') ??
        DEFAULT_SHIP_INFO
      );
    } catch {
      return DEFAULT_SHIP_INFO;
    }
  }, []);

  // 列印範圍：'SINGLE' (單獨當前船員) | 'ALL' (全體人員)
  const [printScope, setPrintScope] = useState<'SINGLE' | 'ALL'>('SINGLE');
  const [activeCrewId, setActiveCrewId] = useState<string>(selectedCrewId || crewList[0]?.id || '');

  // 表頭基本資訊（支援手動編輯調整）
  const [vesselName, setVesselName] = useState(shipInfo.vesselName || 'YM_AAAA');
  const [imoNo, setImoNo] = useState(shipInfo.imoNo || '9319131');
  const [flagOfShip, setFlagOfShip] = useState('LIBERIA');

  // 授權簽署主管（於列印視窗中選擇）
  const signerStorageKey = `rest_hours_authorized_signer_id_${selYear}${selMonth}`;
  const [selectedSignerId, setSelectedSignerId] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(signerStorageKey) ||
        localStorage.getItem('rest_hours_authorized_signer_id') ||
        localStorage.getItem(`part_a_authorized_signer_id_${selYear}${selMonth}`) ||
        localStorage.getItem('part_a_authorized_signer_id') ||
        crewList.find(c => c.rank.toUpperCase().includes('C/O') || c.rank.toUpperCase().includes('CHIEF MATE'))?.id ||
        crewList[0]?.id ||
        ''
      );
    } catch {
      return crewList[0]?.id || '';
    }
  });

  const handleSignerChange = (id: string) => {
    setSelectedSignerId(id);
    try {
      localStorage.setItem(signerStorageKey, id);
      localStorage.setItem('rest_hours_authorized_signer_id', id);
    } catch {
      // ignore
    }
  };

  const authorizedSigner = useMemo(() => {
    const target =
      crewList.find(c => c.id === selectedSignerId) ||
      crewList.find(c => c.rank.toUpperCase().includes('C/O') || c.rank.toUpperCase().includes('CHIEF MATE')) ||
      crewList[0];

    if (!target) return 'C/O 李美玲 LI MEILING';
    const rankStr = target.rank ? `${target.rank} ` : '';
    const nameStr = target.name ? `${target.name} ` : '';
    const engStr = target.engName || '';
    return `${rankStr}${nameStr}${engStr}`.trim();
  }, [crewList, selectedSignerId]);

  // 當月份所有在船人員（過濾掉本月前已下船，或本月後才上船的人員）
  const allTargetCrews = useMemo(() => {
    const monthStart = `${selYear}-${selMonth}-01`;
    const lastDayStr = `${selYear}-${selMonth}-${String(daysInMonth).padStart(2, '0')}`;
    return crewList.filter(c => {
      // 若在本月份之前已下船，則不計入當月名單
      if (c.hasSignOff && c.signOffDate && c.signOffDate < monthStart) {
        return false;
      }
      // 若在本月份之後才上船，則不計入當月名單
      if (c.hasSignOn && c.signOnDate && c.signOnDate > lastDayStr) {
        return false;
      }
      return true;
    });
  }, [crewList, selYear, selMonth, daysInMonth]);

  // 決定要列印的船員清單
  const targetCrews = useMemo(() => {
    if (printScope === 'ALL') {
      return allTargetCrews;
    }
    const single = crewList.find(c => c.id === activeCrewId) || crewList[0];
    return single ? [single] : [];
  }, [printScope, activeCrewId, crewList, allTargetCrews]);

  // 預先計算列印人員的每日資料 (1~31天)
  const rows = useMemo(
    () => buildDisplayRows(dailyData, daysInMonth, selYear, selMonth),
    [dailyData, daysInMonth, selYear, selMonth],
  );

  // 計算指定船員的 31 天工時與休息資料（含代碼與備註）
  const getCrewPrintData = (crew: CrewMember) => {
    const lb = getLookbackMonthSlots(selYear, selMonth, crew.id, 6, crew);
    const cur: number[] = [];
    const ov = allCrewOverrides[crew.id] || { slots: {}, remarks: {} };

    const dayResults: {
      dayNum: number;
      final: (string | null)[];
      workH: number;
      restH: number;
      remark: string;
      min24: string;
      min7: string;
      offBoardType: 'BEFORE_SIGN_ON' | 'AFTER_SIGN_OFF' | null;
      slotOnBoard: boolean[];
    }[] = [];

    rows.forEach(row => {
      const ds = `${selYear}-${selMonth}-${String(row.dayNum).padStart(2, '0')}`;
      const dd = dailyData[row.rowKey] || emptyDay();
      const os = ov.slots?.[row.rowKey] || {};
      const final: (string | null)[] = [];
      const slotOnBoard: boolean[] = [];
      const offType = isDayCompletelyOffBoard(crew, ds);

      for (let sIdx = 0; sIdx < 48; sIdx++) {
        const onBoard = isSlotOnBoard(crew, ds, sIdx);
        slotOnBoard.push(onBoard);
        if (!onBoard) {
          final.push(null);
        } else {
          const b = resolveCrewWorkSlots(crew, dd, ds, sIdx);
          const f = os[sIdx] !== undefined ? os[sIdx] : b;
          final.push(f);
        }
      }
      final.forEach(f => cur.push(f ? 0 : 1));

      const wc = final.filter(Boolean).length;
      const wh = wc * 0.5;
      const rh = offType ? 0 : (24 - wh);
      const ar = offType
        ? ''
        : ov.remarks?.[row.rowKey] !== undefined
          ? ov.remarks[row.rowKey]
          : (dd.remark || '');

      dayResults.push({
        dayNum: row.dayNum,
        final,
        workH: offType ? 0 : wh,
        restH: rh,
        remark: ar,
        min24: offType ? '' : '24.0',
        min7: offType ? '' : '168.0',
        offBoardType: offType,
        slotOnBoard,
      });
    });

    const full = [...lb, ...cur];
    evaluateMLCWithLookback(full, lb.length);

    dayResults.forEach((dr, di) => {
      // 若當日整天完全未在船，各欄位維持空白
      if (dr.offBoardType) {
        dr.min24 = '';
        dr.min7 = '';
        dr.remark = '';
        return;
      }

      // 當日格位於 full 陣列中的真實起始索引（必須計入上月回推 lb.length）
      const dayStart = lb.length + di * 48;

      let m24 = 24.0;
      // 掃描涵蓋當日的所有 24 小時（48 格）視窗：依「最多兩段合計」計算各 24h 視窗之有效休息時數
      for (let k = dayStart - 47; k <= dayStart + 47; k++) {
        if (k >= 0 && k + 48 <= full.length) {
          const { top2Sum } = get24hRestPeriods(full, k);
          if (top2Sum < m24) m24 = top2Sum;
        }
      }
      dr.min24 = m24.toFixed(1);

      let m7 = 168;
      // 掃描涵蓋當日的所有 7 天（336 格）視窗
      for (let k = dayStart - 335; k <= dayStart + 47; k++) {
        if (k >= 0 && k + 336 <= full.length) {
          const ws = full.slice(k, k + 336);
          if (ws.length === 336) {
            const r = ws.filter(v => v === 1).length * 0.5;
            if (r < m7) m7 = r;
          }
        }
      }
      dr.min7 = m7.toFixed(1);
    });

    return dayResults;
  };

  const handlePrint = () => {
    const origTitle = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  };

  return createPortal(
    <div id="rh-print-portal" className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* 內嵌列印樣式：精確 A4 橫向 297mm x 210mm */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&display=swap');

        .en, .font-en {
          font-family: 'Calibri', Arial, 'Liberation Sans', sans-serif !important;
        }
        .zh, .font-zh {
          font-family: '標楷體', 'DFKai-SB', 'BiauKai TC', 'BiauKai', 'Noto Serif TC', serif !important;
        }
        .print-sheet {
          font-family: 'Calibri', '標楷體', 'DFKai-SB', 'BiauKai TC', 'BiauKai', 'Noto Serif TC', Arial, serif;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        @page {
          size: A4 landscape;
          margin: 0;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            width: 297mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* 完全移除網頁其他內容(含 #root)，不佔用任何高度，避免多出空白紙張 */
          body > *:not(#rh-print-portal) {
            display: none !important;
          }
          #rh-print-portal,
          #rh-print-portal > div,
          #rh-print-portal .rh-preview-scroll,
          #rest-hours-print-container {
            position: static !important;
            display: block !important;
            width: 297mm !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            backdrop-filter: none !important;
          }
          .crew-sheet-pair {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
          }
          .print-sheet {
            display: block !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 297mm !important;
            height: 209.5mm !important;
            max-height: 209.5mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* 最後一張紙避免強制分頁產生空白頁 */
          .crew-sheet-pair:last-child .print-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* 彈出視窗外框 */}
      <div className="bg-slate-800 text-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-700">
        {/* 控制面板 Header (列印時隱藏) */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Printer className="size-4" />
            </span>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>列印船員休息時數紀錄表</span>
                <span className="text-xs text-slate-400 font-normal">Appendix 98 (P.1/2 & P.2/2 正反面)</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 gap-1.5 shadow-md cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>確認列印 (Print)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <X className="size-4" />
              <span>關閉</span>
            </Button>
          </div>
        </div>

        {/* 參數設定列 (列印時隱藏) */}
        <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-700/80 flex flex-wrap items-center gap-3 text-xs no-print">
          {/* 列印範圍選擇 */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <span className="font-semibold text-slate-400">列印範圍:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPrintScope('SINGLE')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${printScope === 'SINGLE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                <User className="size-3" />
                <span>單獨列印 (當前人員)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('ALL')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${printScope === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Users className="size-3" />
                <span>全體人員一次列印 ({allTargetCrews.length}人)</span>
              </button>
            </div>
          </div>

          {/* 當單獨列印時，選擇船員 */}
          {printScope === 'SINGLE' && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-400">選擇船員:</span>
              <Select value={activeCrewId} onValueChange={setActiveCrewId}>
                <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700 w-48 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
                  {crewList.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      [{c.rank}] {c.name} {c.engName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 船名 */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">船名:</span>
            <Input
              value={vesselName}
              onChange={e => setVesselName(e.target.value)}
              className="h-7 w-28 bg-slate-900 border-slate-700 text-xs px-2 py-0 text-slate-200 font-mono"
            />
          </div>

          {/* IMO */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">IMO:</span>
            <Input
              value={imoNo}
              onChange={e => setImoNo(e.target.value)}
              className="h-7 w-24 bg-slate-900 border-slate-700 text-xs px-2 py-0 text-slate-200 font-mono"
            />
          </div>

          {/* 船籍國 */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">船籍國:</span>
            <Input
              value={flagOfShip}
              onChange={e => setFlagOfShip(e.target.value)}
              className="h-7 w-24 bg-slate-900 border-slate-700 text-xs px-2 py-0 text-slate-200 font-mono"
            />
          </div>

          {/* 授權簽署主管選擇 */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <span className="font-semibold text-slate-400 whitespace-nowrap">授權簽署主管:</span>
            <Select value={selectedSignerId || (crewList[0]?.id ?? '')} onValueChange={handleSignerChange}>
              <SelectTrigger className="h-7 text-xs font-semibold text-blue-200 bg-slate-900 border-slate-700 w-52 focus:ring-sky-500">
                <SelectValue placeholder="選擇主管" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
                {crewList.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    [{c.rank || '未設定'}] {c.name || ''} {c.engName || ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 預覽檢視區域 (捲軸容器) */}
        <div className="rh-preview-scroll flex-1 overflow-auto p-4 bg-slate-950 flex flex-col items-center gap-6">
          <div id="rest-hours-print-container" className="flex flex-col gap-8 items-center">
            {targetCrews.map(crew => {
              const printData = getCrewPrintData(crew);
              const isWatch = crew.watchKeeping === 'Y';

              return (
                <div key={crew.id} className="crew-sheet-pair flex flex-col gap-6 items-center">
                  {/* ────────────────────────────────────────────────────────── */}
                  {/* 第一頁：正面 (P.1/2)                                      */}
                  {/* ────────────────────────────────────────────────────────── */}
                  <div
                    className="print-sheet relative bg-white text-black shadow-lg overflow-hidden shrink-0 select-none"
                    style={{
                      width: '297mm',
                      height: '210mm',
                      fontFamily: EN_FONT,
                    }}
                  >
                    {/* 頂部標示列 */}
                    <div
                      className="absolute zh"
                      style={{
                        top: '5mm',
                        left: '22.9mm',
                        fontSize: '12pt',
                        lineHeight: 1,
                        fontFamily: ZH_FONT,
                      }}
                    >
                      資料分級：
                      <span className="inline-block w-[4mm] h-[4mm] border border-black text-center align-middle -translate-y-0.5 mx-1 bg-white" />
                      一般
                      <span className="inline-block w-[4mm] h-[4mm] bg-black border border-black align-middle -translate-y-0.5 mx-1 [print-color-adjust:exact]" />
                      內部
                      <span className="inline-block w-[4mm] h-[4mm] border border-black align-middle -translate-y-0.5 mx-1 bg-white" />
                      限閱
                      <span className="inline-block w-[4mm] h-[4mm] border border-black align-middle -translate-y-0.5 mx-1 bg-white" />
                      機密
                    </div>

                    <div
                      className="absolute en"
                      style={{
                        top: '5mm',
                        right: '22.9mm',
                        fontSize: '12pt',
                        fontWeight: 400,
                        lineHeight: 1,
                        fontFamily: EN_FONT,
                      }}
                    >
                      (2900A900) <span className="zh" style={{ fontFamily: ZH_FONT }}>附件</span>/Appendix 98 (P.1/2)
                    </div>

                    {/* 第 1 張：IMO Logo (左側：23.0mm, 尺寸 12.6mm × 12.6mm) */}
                    <img
                      src={IMO_LOGO_BASE64}
                      alt="IMO Logo"
                      className="absolute"
                      style={{
                        top: '14.6mm',
                        left: '23.0mm',
                        width: '12.6mm',
                        height: '12.6mm',
                        objectFit: 'contain',
                      }}
                    />

                    {/* 第 2 張：ILO Logo (右側：38.9mm, 尺寸 12.6mm × 11.4mm) */}
                    <img
                      src={ILO_LOGO_BASE64}
                      alt="ILO Logo"
                      className="absolute"
                      style={{
                        top: '14.6mm',
                        left: '38.9mm',
                        width: '12.6mm',
                        height: '11.4mm',
                        objectFit: 'contain',
                      }}
                    />

                    {/* 標題段落 */}
                    <div
                      className="absolute en"
                      style={{
                        top: '14mm',
                        left: '64.17mm',
                        fontSize: '14pt',
                        fontWeight: 'normal',
                        lineHeight: 1,
                        fontFamily: EN_FONT,
                      }}
                    >
                      Model format for record of hours of work or hours of rest of seafarers
                    </div>

                    <div
                      className="absolute zh"
                      style={{
                        top: '23.17mm',
                        left: '55.71mm',
                        fontSize: '14pt',
                        fontWeight: 'normal',
                        lineHeight: 1,
                        fontFamily: ZH_FONT,
                      }}
                    >
                      船員工作/休息時數紀錄表
                    </div>

                    {/* 基本資料區塊 */}
                    {/* 第 1 列 */}
                    <div
                      className="absolute flex items-baseline"
                      style={{
                        top: '32.34mm',
                        left: '39.8mm',
                        height: 'calc(6mm - 2px)',
                        lineHeight: 'calc(6mm - 2px)',
                        fontSize: '9.5pt',
                      }}
                    >
                      <span className="en" style={{ fontFamily: EN_FONT }}>Name of ship</span>
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>船名：</span>
                      <span
                        className="en text-center font-bold px-1"
                        style={{
                          width: '41mm',
                          display: 'inline-block',
                          fontFamily: EN_FONT,
                          borderBottom: '0.3mm solid black',
                        }}
                      >
                        {vesselName}
                      </span>

                      <span className="en" style={{ marginLeft: '2mm', fontFamily: EN_FONT }}>IMO number(if any)：</span>
                      <span
                        className="en text-center font-bold px-1"
                        style={{
                          width: '34mm',
                          display: 'inline-block',
                          fontFamily: EN_FONT,
                          borderBottom: '0.3mm solid black',
                        }}
                      >
                        {imoNo}
                      </span>

                      <span className="en" style={{ marginLeft: '2mm', fontFamily: EN_FONT }}>Flag of ship</span>
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>船籍國：</span>
                      <span
                        className="en text-center font-bold px-1"
                        style={{
                          width: '48mm',
                          display: 'inline-block',
                          fontFamily: EN_FONT,
                          borderBottom: '0.3mm solid black',
                        }}
                      >
                        {flagOfShip}
                      </span>
                    </div>

                    {/* 第 2 列 */}
                    <div
                      className="absolute flex items-baseline"
                      style={{
                        top: '39.34mm',
                        left: '39.8mm',
                        height: 'calc(6mm - 2px)',
                        lineHeight: 'calc(6mm - 2px)',
                        fontSize: '9.5pt',
                      }}
                    >
                      <span className="en" style={{ fontFamily: EN_FONT }}>Seafarer (full name)</span>
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>船員姓名：</span>
                      <span
                        className="text-left font-bold px-2 flex items-center"
                        style={{
                          width: '93mm',
                          display: 'inline-block',
                          borderBottom: '0.3mm solid black',
                        }}
                      >
                        <span className="zh" style={{ fontFamily: ZH_FONT }}>{crew.name}</span>
                        {crew.engName && (
                          <span className="en" style={{ marginLeft: '4mm', fontFamily: EN_FONT }}>
                            {crew.engName}
                          </span>
                        )}
                      </span>

                      <span className="en" style={{ marginLeft: '2mm', fontFamily: EN_FONT }}>Position/rank</span>
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>職稱/級別：</span>
                      <span
                        className="en text-center font-bold px-1"
                        style={{
                          width: '38mm',
                          display: 'inline-block',
                          fontFamily: EN_FONT,
                          borderBottom: '0.3mm solid black',
                        }}
                      >
                        {crew.rank}
                      </span>
                    </div>

                    {/* 第 3 列 */}
                    <div
                      className="absolute flex items-baseline"
                      style={{
                        top: '46.34mm',
                        left: '39.8mm',
                        height: 'calc(6mm - 2px)',
                        lineHeight: 'calc(6mm - 2px)',
                        fontSize: '9.5pt',
                      }}
                    >
                      <span className="en" style={{ fontFamily: EN_FONT }}>Month and year</span>
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>月/年：</span>
                      <span
                        className="en text-center font-bold px-1"
                        style={{
                          width: '97mm',
                          display: 'inline-block',
                          fontFamily: EN_FONT,
                          borderBottom: '0.3mm solid black',
                        }}
                      >
                        {monthAbbr}/{selYear}
                      </span>

                      <span className="en" style={{ marginLeft: '2mm', fontFamily: EN_FONT }}>Watchkeeper</span>
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>當值人員：</span>
                      <sup className="en" style={{ marginLeft: '1mm', fontFamily: EN_FONT }}>2</sup>

                      <span className="en" style={{ marginLeft: '4mm', fontFamily: EN_FONT }}>yes</span>
                      <span
                        className="inline-block border border-black text-center font-bold align-middle mx-1"
                        style={{
                          width: '2.7mm',
                          height: '2.7mm',
                          lineHeight: '2.5mm',
                          fontSize: '6pt',
                          position: 'relative',
                          top: '-0.2mm',
                        }}
                      >
                        {isWatch ? '✓' : ''}
                      </span>

                      <span className="en" style={{ marginLeft: '4mm', fontFamily: EN_FONT }}>no</span>
                      <span
                        className="inline-block border border-black text-center font-bold align-middle mx-1"
                        style={{
                          width: '2.7mm',
                          height: '2.7mm',
                          lineHeight: '2.5mm',
                          fontSize: '6pt',
                          position: 'relative',
                          top: '-0.2mm',
                        }}
                      >
                        {!isWatch ? '✓' : ''}
                      </span>
                    </div>

                    {/* 左側三個黑點標記 (比照原版本 doc-dot 尺寸：1.5mm × 1.5mm 黑色方塊) */}
                    <div
                      className="absolute bg-black [print-color-adjust:exact]"
                      style={{ top: '53.31mm', left: '14mm', width: '1.5mm', height: '1.5mm' }}
                    />
                    <div
                      className="absolute bg-black [print-color-adjust:exact]"
                      style={{ top: '61.42mm', left: '14mm', width: '1.5mm', height: '1.5mm' }}
                    />
                    <div
                      className="absolute en text-center font-bold"
                      style={{
                        top: '58.11mm',
                        left: 0,
                        width: '297mm',
                        height: '23pt',
                        lineHeight: '23pt',
                        fontSize: '14pt',
                        fontFamily: EN_FONT,
                      }}
                    >
                      Record of hours of rest<sup style={{ fontSize: '9pt' }}>3</sup>
                    </div>

                    <div
                      className="absolute bg-black [print-color-adjust:exact]"
                      style={{ top: '69.53mm', left: '14mm', width: '1.5mm', height: '1.5mm' }}
                    />
                    <div
                      className="absolute zh text-center font-bold"
                      style={{
                        top: '66.22mm',
                        left: 0,
                        width: '297mm',
                        height: '23pt',
                        lineHeight: '23pt',
                        fontSize: '14pt',
                        fontFamily: ZH_FONT,
                      }}
                    >
                      休息時數紀錄
                    </div>

                    {/* 填寫說明 */}
                    <div
                      className="absolute"
                      style={{ top: '74.5mm', left: '22.9mm', fontSize: '10pt', lineHeight: 1.2 }}
                    >
                      <span className="en" style={{ fontFamily: EN_FONT }}>
                        Please mark periods of work or rest, as applicable, with a continuous line or arrow.
                      </span>
                      <span className="zh" style={{ fontFamily: ZH_FONT, marginLeft: '2mm' }}>
                        請用連續線段記錄休息期間的時數。
                      </span>
                    </div>

                    {/* 置中雙線提示框 (Word 標準雙線外框：4.5px double) */}
                    <div
                      className="absolute flex flex-col justify-center items-center text-center bg-white"
                      style={{
                        top: '80.5mm',
                        left: '83.25mm',
                        width: '130.5mm',
                        height: '27.3mm',
                        border: '4.5px double #000',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        className="en font-bold"
                        style={{ fontSize: '12pt', letterSpacing: '0.5px', fontFamily: EN_FONT }}
                      >
                        COMPLETE THE TABLE ON THE REVERSE SIDE
                      </div>
                      <div
                        className="zh font-bold"
                        style={{
                          fontSize: '12.5pt',
                          marginTop: '1.5mm',
                          fontFamily: ZH_FONT,
                        }}
                      >
                        完成背面的表格
                      </div>
                    </div>

                    {/* 適用法規條款 */}
                    <div
                      className="absolute en"
                      style={{
                        top: '109.5mm',
                        left: '22.9mm',
                        width: '251.2mm',
                        fontSize: '10pt',
                        lineHeight: 1.35,
                        whiteSpace: 'normal',
                        fontFamily: EN_FONT,
                      }}
                    >
                      The following national law, regulations and/or collective agreements governing limitations on
                      working hours or minimum rest periods apply to this ship:
                    </div>

                    <div
                      className="absolute zh"
                      style={{
                        top: '115.8mm',
                        left: '22.9mm',
                        width: '251.2mm',
                        fontSize: '10pt',
                        lineHeight: 1.35,
                        fontFamily: ZH_FONT,
                      }}
                    >
                      下列管理最高工作時數或最低休息時數限制之國內法規及/或團體協約適用於本船：
                    </div>

                    {/* 船員法滿版底線 */}
                    <div
                      className="absolute"
                      style={{
                        top: '121.8mm',
                        left: '22.9mm',
                        width: '251.2mm',
                        fontSize: '10pt',
                        lineHeight: 1.35,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          paddingLeft: '2mm',
                          boxSizing: 'border-box',
                          fontWeight: 'normal',
                          borderBottom: '0.3mm solid black',
                        }}
                      >
                        <span className="en" style={{ fontFamily: EN_FONT }}>The Seafarer’s Law</span>{' '}
                        <span className="zh" style={{ fontFamily: ZH_FONT }}>船員法</span>
                      </span>
                    </div>

                    {/* 同意宣告 */}
                    <div
                      className="absolute"
                      style={{
                        top: '128.0mm',
                        left: '22.9mm',
                        width: '251.2mm',
                        fontSize: '10pt',
                        fontWeight: 'bold',
                        fontStyle: 'italic',
                        lineHeight: '20pt',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span className="en" style={{ fontFamily: EN_FONT }}>
                        I agree that this record is an accurate reflection of the hours of work or rest of the seafarer
                        concerned.
                      </span>
                      <span className="zh" style={{ fontFamily: ZH_FONT, marginLeft: '2mm' }}>
                        我同意此紀錄表能準確的反映出船員的
                      </span>
                      <span
                        className="zh line-through"
                        style={{ fontFamily: ZH_FONT, textDecorationThickness: '0.3mm' }}
                      >
                        工作時數或
                      </span>
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>休息時數。</span>
                    </div>

                    {/* 姓名填寫行 */}
                    <div
                      className="absolute flex items-baseline"
                      style={{
                        top: '136.0mm',
                        left: '22.9mm',
                        width: '251.2mm',
                        fontSize: '10pt',
                        lineHeight: '22pt',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span className="shrink-0 whitespace-nowrap">
                        <span className="en" style={{ fontFamily: EN_FONT }}>
                          Name of <span className="line-through">master</span> or person authorized by master to sign
                          this record{' '}
                        </span>
                        <span className="zh" style={{ fontFamily: ZH_FONT }}>
                          <span className="line-through">船長</span>或其授權人員之姓名：
                        </span>
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          paddingLeft: '4mm',
                          fontWeight: 'bold',
                          position: 'relative',
                          top: '-1px',
                          boxSizing: 'border-box',
                          borderBottom: '0.3mm solid black',
                          fontFamily: `'Calibri', ${ZH_FONT}`,
                        }}
                      >
                        {authorizedSigner}
                      </span>
                    </div>

                    {/* 簽名處：比照原本長度 (授權人員底線 40mm，船員底線 flex: 1 填滿) */}
                    <div
                      className="absolute flex items-baseline"
                      style={{
                        top: '145.0mm',
                        left: '22.9mm',
                        width: '251.2mm',
                        fontSize: '10pt',
                        lineHeight: '24pt',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span className="shrink-0 whitespace-nowrap">
                        <span className="en" style={{ fontFamily: EN_FONT }}>
                          Signature of <span className="line-through">master or</span> authorized person{' '}
                        </span>
                        <span className="zh" style={{ fontFamily: ZH_FONT }}>
                          <span className="line-through">船長或</span>其授權人員簽名處：
                        </span>
                      </span>
                      <span
                        style={{
                          width: '40mm',
                          flexShrink: 0,
                          position: 'relative',
                          top: '1.5mm',
                          borderBottom: '0.3mm solid black',
                          display: 'inline-block',
                        }}
                      />

                      <span className="shrink-0 whitespace-nowrap" style={{ marginLeft: '4mm' }}>
                        <span className="en" style={{ fontFamily: EN_FONT }}>Signature of seafarer </span>
                        <span className="zh" style={{ fontFamily: ZH_FONT }}>船員簽名處：</span>
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          position: 'relative',
                          top: '1.5mm',
                          borderBottom: '0.3mm solid black',
                          display: 'inline-block',
                        }}
                      />
                    </div>

                    {/* 副本給予及主管機關 */}
                    <div
                      className="absolute"
                      style={{
                        top: '154.5mm',
                        left: '22.9mm',
                        width: '251.2mm',
                        lineHeight: 1.6,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        className="en text-[10pt] flex items-baseline w-full"
                        style={{ fontFamily: EN_FONT }}
                      >
                        <span className="shrink-0 whitespace-nowrap">
                          A copy of this record is to be given to the seafarer. This form is subject to examination and
                          endorsement under procedures established by
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            textAlign: 'center',
                            display: 'inline-block',
                            padding: '0 2mm',
                            boxSizing: 'border-box',
                            borderBottom: '0.3mm solid black',
                          }}
                        >
                          Flag state
                        </span>
                      </div>

                      <div className="mt-1 w-full whitespace-nowrap flex items-baseline">
                        <span className="zh" style={{ fontFamily: ZH_FONT }}>
                          請複製一份副本給船員，本文件由
                        </span>
                        <span
                          className="zh"
                          style={{
                            display: 'inline-block',
                            padding: '0 2mm',
                            width: '36mm',
                            textAlign: 'center',
                            fontSize: '10pt',
                            fontFamily: ZH_FONT,
                            boxSizing: 'border-box',
                            borderBottom: '0.3mm solid black',
                          }}
                        >
                          船旗國
                        </span>
                        <span className="zh" style={{ fontFamily: ZH_FONT }}>
                          主管單位負責查驗和認證
                        </span>
                        <span className="en text-[8pt]" style={{ marginLeft: '2mm', fontFamily: EN_FONT }}>
                          (name of competent authority)
                        </span>
                        <span className="zh" style={{ fontFamily: ZH_FONT, marginLeft: '1mm' }}>
                          (適當權責單位的名稱)
                        </span>
                      </div>
                    </div>

                    {/* 頁尾備註 1~3 點 */}
                    <div className="absolute" style={{ top: '169.0mm', left: '22.9mm', width: '251.2mm' }}>
                      <div className="w-full whitespace-nowrap leading-tight mb-2">
                        <span className="en inline-block w-4 text-[10pt]" style={{ fontFamily: EN_FONT }}>1.</span>
                        <span className="en text-[10pt]" style={{ fontFamily: EN_FONT }}>
                          The terms used in this model table are to appear in the working language or languages of the
                          ship and in English.
                        </span>{' '}
                        <span className="zh" style={{ fontFamily: ZH_FONT, fontSize: '9pt', marginLeft: '2mm' }}>
                          本格式請使用工作語言或船籍國語言和英文填寫。
                        </span>
                      </div>

                      <div className="w-full whitespace-nowrap leading-tight mb-2">
                        <span className="en inline-block w-4 text-[10pt]" style={{ fontFamily: EN_FONT }}>2.</span>
                        <span className="en text-[10pt]" style={{ fontFamily: EN_FONT }}>Check ✓ as appropriate.</span>{' '}
                        <span className="zh" style={{ fontFamily: ZH_FONT, fontSize: '9pt', marginLeft: '2mm' }}>
                          請選擇填寫項目。
                        </span>
                      </div>

                      <div className="w-full whitespace-nowrap leading-tight">
                        <span className="en inline-block w-4 text-[10pt]" style={{ fontFamily: EN_FONT }}>3.</span>
                        <span className="en text-[10pt]" style={{ fontFamily: EN_FONT }}>Delete as appropriate.</span>{' '}
                        <span className="zh" style={{ fontFamily: ZH_FONT, fontSize: '9pt', marginLeft: '2mm' }}>
                          請選擇填寫項目，將不適用者刪除。
                        </span>
                      </div>
                    </div>

                    {/* 表單編號 (頁尾) */}
                    <div
                      className="absolute text-right whitespace-nowrap text-red-600 font-normal"
                      style={{ bottom: '5mm', right: '22.9mm', fontSize: '12pt' }}
                    >
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>(表單編號</span>{' '}
                      <span className="en" style={{ fontFamily: EN_FONT }}>Form No. : 4M-951-07) (2025.11)</span>
                    </div>
                  </div>

                  {/* ────────────────────────────────────────────────────────── */}
                  {/* 第二頁：背面 (P.2/2)                                      */}
                  {/* ────────────────────────────────────────────────────────── */}
                  <div
                    className="print-sheet relative bg-white text-black shadow-lg overflow-hidden shrink-0 select-none"
                    style={{
                      width: '297mm',
                      height: '210mm',
                      fontFamily: EN_FONT,
                    }}
                  >
                    {/* 頂部標示列 */}
                    <div
                      className="absolute zh"
                      style={{
                        top: '5mm',
                        left: '15mm',
                        fontSize: '12pt',
                        lineHeight: 1,
                        fontFamily: ZH_FONT,
                      }}
                    >
                      資料分級：
                      <span className="inline-block w-[4mm] h-[4mm] border border-black text-center align-middle -translate-y-0.5 mx-1 bg-white" />
                      一般
                      <span className="inline-block w-[4mm] h-[4mm] bg-black border border-black align-middle -translate-y-0.5 mx-1 [print-color-adjust:exact]" />
                      內部
                      <span className="inline-block w-[4mm] h-[4mm] border border-black align-middle -translate-y-0.5 mx-1 bg-white" />
                      限閱
                      <span className="inline-block w-[4mm] h-[4mm] border border-black align-middle -translate-y-0.5 mx-1 bg-white" />
                      機密
                    </div>

                    <div
                      className="absolute en"
                      style={{
                        top: '5mm',
                        right: '15mm',
                        fontSize: '12pt',
                        fontWeight: 400,
                        lineHeight: 1,
                        fontFamily: EN_FONT,
                      }}
                    >
                      (2900A900) <span className="zh" style={{ fontFamily: ZH_FONT }}>附件</span>/Appendix 98 (P.2/2)
                    </div>

                    {/* 背面主表格 (267mm 寬度) */}
                    <table
                      className="absolute border-collapse text-center"
                      style={{
                        top: '13.5mm',
                        left: '15mm',
                        width: '267mm',
                        border: 'none',
                        tableLayout: 'fixed',
                        boxSizing: 'border-box',
                      }}
                    >
                      <colgroup>
                        <col style={{ width: '15mm' }} />
                        {Array.from({ length: 48 }).map((_, i) => (
                          <col key={i} style={{ width: '3.229mm' }} />
                        ))}
                        <col style={{ width: '22mm' }} />
                        <col style={{ width: '31mm' }} />
                        <col style={{ width: '22mm' }} />
                        <col style={{ width: '22mm' }} />
                      </colgroup>

                      <thead>
                        {/* 第一列：說明 */}
                        <tr style={{ height: '18pt' }}>
                          <td style={{ border: '0.5px solid #000' }} />
                          <td
                            colSpan={48}
                            className="en"
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '8pt',
                              lineHeight: 1.15,
                              padding: '1px 0',
                              fontFamily: EN_FONT,
                            }}
                          >
                            Please mark periods of rest, as applicable with a continuous line
                            <br />
                            <span
                              className="zh"
                              style={{
                                color: 'red',
                                fontSize: '8.5pt',
                                fontFamily: ZH_FONT,
                              }}
                            >
                              請用連續線段記錄休息期間的時數
                            </span>
                          </td>
                          <td
                            colSpan={4}
                            className="en"
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '10pt',
                              lineHeight: 1.15,
                              color: 'red',
                              padding: '1px 0',
                              fontFamily: EN_FONT,
                            }}
                          >
                            To be completed by Master or Person Authorized by Master
                            <br />
                            <span
                              className="zh"
                              style={{
                                fontSize: '10pt',
                                fontFamily: ZH_FONT,
                              }}
                            >
                              由船長或其授權人員填寫
                            </span>
                          </td>
                        </tr>

                        {/* 第二列：時間 0~24 刻度 */}
                        <tr style={{ height: '17pt', fontSize: '8pt' }}>
                          <th
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              lineHeight: 1.1,
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span className="en" style={{ fontFamily: EN_FONT }}>Hours</span>
                            <br />
                            <span className="zh" style={{ fontFamily: ZH_FONT }}>時間</span>
                          </th>

                          {/* 0 01 02 ... 23 0 刻度 */}
                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid transparent',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              borderLeft: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', left: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              0
                            </span>
                          </th>

                          {Array.from({ length: 22 }, (_, idx) => {
                            const num = idx + 1;
                            const str = num < 10 ? `0${num}` : `${num}`;
                            return (
                              <React.Fragment key={num}>
                                <th
                                  className="en"
                                  style={{
                                    position: 'relative',
                                    padding: 0,
                                    fontWeight: 'bold',
                                    fontSize: '7pt',
                                    backgroundColor: '#fafafa',
                                    borderRight: '0.5px solid #000',
                                    borderTop: '0.5px solid #000',
                                    borderBottom: '0.5px solid #000',
                                    fontFamily: EN_FONT,
                                  }}
                                >
                                  <span style={{ position: 'absolute', right: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                                    {str[0]}
                                  </span>
                                </th>
                                <th
                                  className="en"
                                  style={{
                                    position: 'relative',
                                    padding: 0,
                                    fontWeight: 'bold',
                                    fontSize: '7pt',
                                    backgroundColor: '#fafafa',
                                    borderRight: '0.5px solid transparent',
                                    borderTop: '0.5px solid #000',
                                    borderBottom: '0.5px solid #000',
                                    fontFamily: EN_FONT,
                                  }}
                                >
                                  <span style={{ position: 'absolute', left: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                                    {str[1]}
                                  </span>
                                </th>
                              </React.Fragment>
                            );
                          })}

                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid #000',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', right: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              2
                            </span>
                          </th>
                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid transparent',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', left: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              3
                            </span>
                          </th>
                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid #000',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', right: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              0
                            </span>
                          </th>

                          {/* 右側 4 欄統計標題 */}
                          <th
                            rowSpan={2}
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '7pt',
                              lineHeight: 1.2,
                              backgroundColor: '#fafafa',
                              padding: '0 1mm',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span className="en" style={{ fontFamily: EN_FONT }}>Hours of rest in 24 hour period</span>
                            <br />
                            <span className="zh" style={{ fontFamily: ZH_FONT }}>24小時內的休息時間</span>
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '8pt',
                              backgroundColor: '#fafafa',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span className="en" style={{ fontFamily: EN_FONT }}>Comments</span>
                            <br />
                            <span className="zh" style={{ fontFamily: ZH_FONT }}>說明</span>
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '7pt',
                              lineHeight: 1.2,
                              backgroundColor: '#fafafa',
                              padding: '0 1mm',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span className="en" style={{ fontFamily: EN_FONT }}>
                              Hours of rest, as applicable, in any 24-hour period²
                            </span>
                            <br />
                            <span className="zh" style={{ fontFamily: ZH_FONT }}>任何24小時內/休息時數</span>
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '7pt',
                              lineHeight: 1.2,
                              backgroundColor: '#fafafa',
                              padding: '0 1mm',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span className="en" style={{ fontFamily: EN_FONT }}>
                              Hours of rest, as applicable, in any 7-day period²
                            </span>
                            <br />
                            <span className="zh" style={{ fontFamily: ZH_FONT }}>任何7天內休息時數</span>
                          </th>
                        </tr>

                        {/* 第三列：Date 標題與 48 格半小時標頭 */}
                        <tr style={{ height: '15pt', fontSize: '8pt' }}>
                          <th
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              lineHeight: 1.1,
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span className="en" style={{ fontFamily: EN_FONT }}>Date</span>
                            <br />
                            <span className="zh" style={{ fontFamily: ZH_FONT }}>日期</span>
                          </th>
                          {Array.from({ length: 48 }).map((_, h) => {
                            const isHour = h % 2 === 1;
                            return (
                              <th
                                key={h}
                                style={{
                                  backgroundColor: '#e2eff7',
                                  borderRight: isHour ? '0.5px solid #000' : '0.5px solid transparent',
                                  borderTop: '0.5px solid #000',
                                  borderBottom: '0.5px solid #000',
                                }}
                              />
                            );
                          })}
                        </tr>
                      </thead>

                      <tbody>
                        {/* 第 4~34 列：1 到 31 天 */}
                        {Array.from({ length: 31 }).map((_, dayIdx) => {
                          const currentDayNum = dayIdx + 1;
                          const dayData = printData[dayIdx];

                          return (
                            <tr
                              key={currentDayNum}
                              style={{ height: '12pt', fontSize: '7pt', boxSizing: 'border-box' }}
                            >
                              {/* 日期欄 */}
                              <td
                                className="en"
                                style={{
                                  border: '0.5px solid #000',
                                  backgroundColor: '#ffffff',
                                  fontWeight: 'bold',
                                  padding: 0,
                                  fontFamily: EN_FONT,
                                }}
                              >
                                {dayData ? currentDayNum : ''}
                              </td>

                              {/* 48 格半小時格：填入工作狀態代碼 (與 C 部分個人休息時數表一致) */}
                              {Array.from({ length: 48 }).map((_, sIdx) => {
                                const isHour = sIdx % 2 === 1;
                                const onBoard = dayData?.slotOnBoard ? dayData.slotOnBoard[sIdx] : !dayData?.offBoardType;
                                const code = dayData && onBoard ? dayData.final[sIdx] : null;

                                return (
                                  <td
                                    key={sIdx}
                                    className="en"
                                    style={{
                                      backgroundColor: !onBoard ? '#ffffff' : '#e2eff7',
                                      borderRight: isHour ? '0.5px solid #000' : '0.5px solid #a8a8a8',
                                      borderTop: '0.5px solid #000',
                                      borderBottom: '0.5px solid #000',
                                      borderLeft: sIdx === 0 ? '0.5px solid #000' : undefined,
                                      padding: 0,
                                      fontSize: '7pt',
                                      fontWeight: 'bold',
                                      fontFamily: EN_FONT,
                                      textAlign: 'center',
                                      verticalAlign: 'middle',
                                      color: '#000',
                                      lineHeight: '12pt',
                                      height: '12pt',
                                      userSelect: 'none',
                                    }}
                                  >
                                    {code || ''}
                                  </td>
                                );
                              })}

                              {/* 右側 4 欄統計數值 */}
                              {/* 1. 24小時內的休息時間 */}
                              <td
                                className="en"
                                style={{
                                  border: '0.5px solid #000',
                                  backgroundColor: '#ffffff',
                                  padding: '0 1px',
                                  fontSize: '6.8pt',
                                  fontFamily: EN_FONT,
                                }}
                              >
                                {dayData && !dayData.offBoardType ? dayData.restH.toFixed(1) : ''}
                              </td>

                              {/* 2. Comments 說明 (含 C 部分之備註) */}
                              <td
                                style={{
                                  border: '0.5px solid #000',
                                  backgroundColor: '#ffffff',
                                  padding: '0 2px',
                                  fontSize: '6.5pt',
                                  fontFamily: `'Calibri', ${ZH_FONT}`,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'left',
                                  lineHeight: '12pt',
                                }}
                              >
                                {dayData && !dayData.offBoardType ? dayData.remark : ''}
                              </td>

                              {/* 3. 任何24小時內/休息時數 */}
                              <td
                                className="en"
                                style={{
                                  border: '0.5px solid #000',
                                  backgroundColor: '#ffffff',
                                  padding: '0 1px',
                                  fontSize: '6.8pt',
                                  fontFamily: EN_FONT,
                                }}
                              >
                                {dayData && !dayData.offBoardType ? dayData.min24 : ''}
                              </td>

                              {/* 4. 任何7天內休息時數 */}
                              <td
                                className="en"
                                style={{
                                  border: '0.5px solid #000',
                                  backgroundColor: '#ffffff',
                                  padding: '0 1px',
                                  fontSize: '6.8pt',
                                  fontFamily: EN_FONT,
                                }}
                              >
                                {dayData && !dayData.offBoardType ? dayData.min7 : ''}
                              </td>
                            </tr>
                          );
                        })}

                        {/* 第 35 列：底部小時數刻度 */}
                        <tr style={{ height: '17pt' }}>
                          <th
                            style={{
                              border: '0.5px solid #000',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              lineHeight: 1.1,
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span className="en" style={{ fontFamily: EN_FONT }}>Hours</span>
                            <br />
                            <span className="zh" style={{ fontFamily: ZH_FONT }}>時間</span>
                          </th>
                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid transparent',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              borderLeft: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', left: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              0
                            </span>
                          </th>
                          {Array.from({ length: 22 }, (_, idx) => {
                            const num = idx + 1;
                            const str = num < 10 ? `0${num}` : `${num}`;
                            return (
                              <React.Fragment key={num}>
                                <th
                                  className="en"
                                  style={{
                                    position: 'relative',
                                    padding: 0,
                                    fontWeight: 'bold',
                                    fontSize: '7pt',
                                    backgroundColor: '#fafafa',
                                    borderRight: '0.5px solid #000',
                                    borderTop: '0.5px solid #000',
                                    borderBottom: '0.5px solid #000',
                                    fontFamily: EN_FONT,
                                  }}
                                >
                                  <span style={{ position: 'absolute', right: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                                    {str[0]}
                                  </span>
                                </th>
                                <th
                                  className="en"
                                  style={{
                                    position: 'relative',
                                    padding: 0,
                                    fontWeight: 'bold',
                                    fontSize: '7pt',
                                    backgroundColor: '#fafafa',
                                    borderRight: '0.5px solid transparent',
                                    borderTop: '0.5px solid #000',
                                    borderBottom: '0.5px solid #000',
                                    fontFamily: EN_FONT,
                                  }}
                                >
                                  <span style={{ position: 'absolute', left: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                                    {str[1]}
                                  </span>
                                </th>
                              </React.Fragment>
                            );
                          })}
                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid #000',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', right: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              2
                            </span>
                          </th>
                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid transparent',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', left: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              3
                            </span>
                          </th>
                          <th
                            className="en"
                            style={{
                              position: 'relative',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '7pt',
                              backgroundColor: '#fafafa',
                              borderRight: '0.5px solid #000',
                              borderTop: '0.5px solid #000',
                              borderBottom: '0.5px solid #000',
                              fontFamily: EN_FONT,
                            }}
                          >
                            <span style={{ position: 'absolute', right: '0.4mm', top: '50%', transform: 'translateY(-50%)' }}>
                              0
                            </span>
                          </th>
                          <th colSpan={4} style={{ backgroundColor: '#fafafa', border: '0.5px solid #000' }} />
                        </tr>

                        {/* 第 36~40 列：底部條文說明（無框線，位置與原版面完全一致不位移） */}
                        <tr style={{ height: '16.5pt' }}>
                          <td
                            colSpan={53}
                            className="en"
                            style={{
                              textAlign: 'left',
                              fontSize: '6.8pt',
                              border: 'none',
                              paddingLeft: '20px',
                              textIndent: '-15px',
                              lineHeight: 1.35,
                              fontFamily: EN_FONT,
                            }}
                          >
                            1. For completion and use in accordance with the procedures established by the competent
                            authority in compliance with the relevant requirements of the Seafarers' Hours of Work and the
                            Manning of Ships Convention, 1996 (Convention No. 180)
                          </td>
                        </tr>
                        <tr style={{ height: '16.5pt' }}>
                          <td
                            colSpan={53}
                            className="zh"
                            style={{
                              textAlign: 'left',
                              fontSize: '7.2pt',
                              border: 'none',
                              paddingLeft: '20px',
                              lineHeight: 1.35,
                              fontFamily: ZH_FONT,
                            }}
                          >
                            完成此表格之方法需遵照具適當權責機關所頒布之程序，以符合1996海員工作時數及船上員額配置公約(第180號公約)之相關規定。
                          </td>
                        </tr>
                        <tr style={{ height: '16.5pt' }}>
                          <td
                            colSpan={53}
                            className="en"
                            style={{
                              textAlign: 'left',
                              fontSize: '6.8pt',
                              border: 'none',
                              paddingLeft: '20px',
                              textIndent: '-15px',
                              lineHeight: 1.35,
                              fontFamily: EN_FONT,
                            }}
                          >
                            2. Additional calculations or verifications may be necessary to ensure compliance with the
                            relevant requirements of the Seafarers' Hours of Work and the Manning of Ships Convention,
                            1996 (Convention No. 180) and the International Convention on Standards of Training,
                            Certification and Watchkeeping, 1978, as amended (STCW Convention).
                          </td>
                        </tr>
                        <tr style={{ height: '16.5pt' }}>
                          <td
                            colSpan={53}
                            className="zh"
                            style={{
                              textAlign: 'left',
                              fontSize: '7.2pt',
                              border: 'none',
                              paddingLeft: '20px',
                              lineHeight: 1.35,
                              fontFamily: ZH_FONT,
                            }}
                          >
                            可能需要額外的計算方式或驗證以確保遵守1996海員工作時數及船上員額配置公約(第180號公約)、1978
                            STCW公約及其修正案之相關規定。
                          </td>
                        </tr>
                        <tr style={{ height: '16.5pt' }}>
                          <td colSpan={53} style={{ border: 'none' }} />
                        </tr>
                      </tbody>
                    </table>

                    {/* 表單編號 (頁尾) */}
                    <div
                      className="absolute text-right whitespace-nowrap text-red-600 font-normal"
                      style={{ bottom: '5mm', right: '15mm', fontSize: '12pt' }}
                    >
                      <span className="zh" style={{ fontFamily: ZH_FONT }}>(表單編號</span>{' '}
                      <span className="en" style={{ fontFamily: EN_FONT }}>Form No. : 4M-951-07) (2025.11)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
