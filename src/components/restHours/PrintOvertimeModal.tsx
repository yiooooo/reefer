import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { Button } from '../ui/button';
import type { CrewMember, DayData, CrewOverrides, ShipInfo } from '../../types/restHours';
import { DEFAULT_SHIP_INFO, emptyDay } from '../../utils/restHoursData';
import {
  buildDisplayRows,
  getDaysInMonth,
  resolveCrewWorkSlots,
  calculateOvertimeHours,
} from '../../utils/restHoursUtils';

export interface PrintOvertimeModalProps {
  selYear: string;
  selMonth: string;
  crewList: CrewMember[];
  dailyData: Record<string, DayData>;
  allCrewOverrides: Record<string, CrewOverrides>;
  onClose: () => void;
}

const ZH_FONT = "'標楷體', 'DFKai-SB', 'BiauKai TC', 'BiauKai', 'Noto Serif TC', serif";
const EN_FONT = "'Calibri', Arial, 'Liberation Sans', sans-serif";

const MONTH_NAMES_EN = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export const PrintOvertimeModal: React.FC<PrintOvertimeModalProps> = ({
  selYear,
  selMonth,
  crewList,
  dailyData,
  allCrewOverrides,
  onClose,
}) => {
  // 船舶基本資訊（參考「船上工作安排表」之船名）
  const shipInfo = useMemo<ShipInfo>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('ship_working_arrangement_info') || 'null') ??
        JSON.parse(localStorage.getItem('part_a_ship_info') || 'null') ??
        DEFAULT_SHIP_INFO
      );
    } catch {
      return DEFAULT_SHIP_INFO;
    }
  }, []);

  const vesselName = shipInfo.vesselName || 'YM AAAA';

  // 月份英文格式（參考製作月份選擇之月份，如 "OCT/2026"）
  const monthDisplay = useMemo(() => {
    const mIdx = parseInt(selMonth, 10) - 1;
    const mName = MONTH_NAMES_EN[mIdx] || selMonth;
    return `${mName}/${selYear}`;
  }, [selMonth, selYear]);

  const daysInMonth = useMemo(() => getDaysInMonth(selYear, selMonth), [selYear, selMonth]);

  // 取得該月份每一日的排班列資訊 (包含星期與撥天調整)
  const rows = useMemo(
    () => buildDisplayRows(dailyData, daysInMonth, selYear, selMonth),
    [dailyData, daysInMonth, selYear, selMonth],
  );

  // 當月份所有在船人員（過濾掉本月前已下船，或本月後才上船的人員）
  const activeCrews = useMemo(() => {
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

  // 計算每位船員的 31 天每日加班工時
  const crewOtData = useMemo(() => {
    return activeCrews.map((crew, idx) => {
      let totalOt = 0;
      const dailyOt: (string | null)[] = [];

      for (let dayNum = 1; dayNum <= 31; dayNum++) {
        if (dayNum > daysInMonth) {
          dailyOt.push(null);
          continue;
        }

        const rowKey = `day_${dayNum}`;
        const ds = `${selYear}-${selMonth}-${String(dayNum).padStart(2, '0')}`;
        const dd = dailyData[rowKey] || emptyDay();
        const os = allCrewOverrides[crew.id]?.slots?.[rowKey] || {};

        // 取得當日星期
        const dateObj = new Date(parseInt(selYear, 10), parseInt(selMonth, 10) - 1, dayNum);
        const dow = dateObj.getDay();
        const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
        const weekName = weekNames[dow];

        // 計算當日工作格位 (48 格)
        let workSlots = 0;
        for (let sIdx = 0; sIdx < 48; sIdx++) {
          const base = resolveCrewWorkSlots(crew, dd, ds, sIdx);
          const final = os[sIdx] !== undefined ? os[sIdx] : base;
          if (final) {
            workSlots++;
          }
        }

        const workH = workSlots * 0.5;
        const otH = calculateOvertimeHours(workH, weekName, !!dd.isCustomHoliday);
        totalOt += otH;

        dailyOt.push(otH > 0 ? otH.toFixed(1) : '');
      }

      return {
        item: String(idx + 1).padStart(2, '0'),
        id: crew.id,
        name: crew.name || crew.engName || '',
        rank: crew.rank || '',
        dailyOt,
        totalOt: totalOt > 0 ? totalOt.toFixed(1) : '0',
      };
    });
  }, [activeCrews, daysInMonth, selYear, selMonth, dailyData, allCrewOverrides]);

  // 分頁邏輯：每頁最多 18 位船員，確保列印於 A4 橫向單頁或多頁時絕不超出高度
  const CREWS_PER_PAGE = 18;
  const pages = useMemo(() => {
    if (crewOtData.length === 0) return [[]];
    const result: typeof crewOtData[] = [];
    for (let i = 0; i < crewOtData.length; i += CREWS_PER_PAGE) {
      result.push(crewOtData.slice(i, i + CREWS_PER_PAGE));
    }
    return result;
  }, [crewOtData]);

  const handlePrint = () => {
    const origTitle = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  };

  return createPortal(
    <div id="ot-print-portal" className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* 內嵌列印樣式：精確比照 HTML 設定 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&display=swap');

        @page {
          size: A4 landscape;
          margin: 0;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        /* 畫布大小：A4 橫向 297mm × 210mm */
        .page-sheet {
          position: relative !important;
          width: 297mm !important;
          height: 210mm !important;
          min-width: 297mm !important;
          min-height: 210mm !important;
          max-width: 297mm !important;
          max-height: 210mm !important;
          background: #ffffff !important;
          box-shadow: 0 0 10px rgba(0,0,0,0.4);
          font-size: 10pt;
          color: #000 !important;
          line-height: 1.15;
          overflow: hidden !important;
          flex-shrink: 0;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .abs {
          position: absolute !important;
          white-space: nowrap;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }

        /* 英文字型優先 Calibri，中文字型優先標楷體 */
        .en, .font-en {
          font-family: 'Calibri', Arial, 'Liberation Sans', sans-serif !important;
        }

        .zh, .font-zh {
          font-family: '標楷體', 'DFKai-SB', 'BiauKai TC', 'BiauKai', 'Noto Serif TC', serif !important;
        }

        /* 主表格樣式：左右對齊 22.9mm，寬度 251.2mm */
        table.ot-table {
          position: absolute !important;
          top: 27mm !important;
          left: 22.9mm !important;
          width: 251.2mm !important;
          border-collapse: collapse !important;
          text-align: center !important;
          border: 1px solid #000 !important;
          table-layout: fixed !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        table.ot-table th, 
        table.ot-table td {
          border: 1px solid #000 !important;
          padding: 0 !important;
          margin: 0 !important;
          vertical-align: middle !important;
          box-sizing: border-box !important;
        }

        /* 欄位寬度配置（總寬度 251.2mm） */
        .col-item   { width: 8.2mm !important; }
        .col-name   { width: 22mm !important; }
        .col-rank   { width: 17mm !important; }
        .col-day    { width: 6.0mm !important; } /* 31 天 × 6.0mm = 186.0mm */
        .col-total  { width: 18.0mm !important; }

        /* 列高設定 */
        .row-header-title { height: 6.8mm !important; }
        .row-header-dates { height: 6.0mm !important; }
        .row-data         { height: 6.8mm !important; font-size: 10pt !important; }

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
          body > *:not(#ot-print-portal) {
            display: none !important;
          }
          #ot-print-portal,
          #ot-print-portal > div,
          #ot-print-portal .ot-preview-scroll,
          #ot-print-container {
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
          .page-sheet {
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
          /* 最後一頁避免產生空白第 2 頁 */
          .page-sheet:last-child {
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
            <span className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Printer className="size-4" />
            </span>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>列印船員加班時數紀錄表</span>
                <span className="text-xs text-slate-400 font-normal">Record of Overtime Hours</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 gap-1.5 shadow-md cursor-pointer"
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


        {/* 預覽檢視區域 (捲軸容器) */}
        <div className="ot-preview-scroll flex-1 overflow-auto p-4 bg-slate-950 flex flex-col items-center gap-6">
          <div id="ot-print-container" className="flex flex-col gap-8 items-center">
            {pages.map((pageCrews, pageIdx) => {
              // 動態計算表格與底部簽名區塊的高度 (每列 6.8mm，底部留 6.8mm 間距)
              const tableHeightMm = 12.8 + pageCrews.length * 6.8;
              const footerTopMm = 27 + tableHeightMm + 6.8;

              return (
                <div
                  key={pageIdx}
                  className="page-sheet relative bg-white text-black shadow-xl"
                  style={{
                    width: '297mm',
                    height: '210mm',
                    minWidth: '297mm',
                    minHeight: '210mm',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  {/* 表格大標題 (Excel A1:AJ1 置中, 16pt 粗體) */}
                  <div
                    className="abs en"
                    style={{
                      top: '11mm',
                      left: 0,
                      width: '297mm',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'bold',
                      fontFamily: EN_FONT,
                    }}
                  >
                    Record of Overtime Hours
                  </div>

                  {/* 船名與月份資訊列 (Excel Row 3, 12pt) */}
                  <div
                    className="abs en"
                    style={{
                      top: '19.5mm',
                      left: '22.9mm',
                      width: '251.2mm',
                      fontSize: '12pt',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      fontFamily: EN_FONT,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 'bold' }}>Vessel Name : </span>
                      <span
                        style={{
                          borderBottom: '1px solid #000',
                          padding: '0 5mm',
                          fontWeight: 'normal',
                          fontFamily: EN_FONT,
                        }}
                      >
                        {vesselName}
                      </span>
                    </div>
                    <div style={{ marginRight: '18mm' }}>
                      <span style={{ fontWeight: 'bold' }}>Month: </span>
                      <span
                        style={{
                          borderBottom: '1px solid #000',
                          padding: '0 6mm',
                          fontWeight: 'bold',
                          fontFamily: EN_FONT,
                        }}
                      >
                        {monthDisplay}
                      </span>
                    </div>
                  </div>

                  {/* 主表格 (當月份全體在船船員) */}
                  <table
                    className="ot-table en"
                    style={{
                      position: 'absolute',
                      top: '27mm',
                      left: '22.9mm',
                      width: '251.2mm',
                      fontFamily: EN_FONT,
                    }}
                  >
                    <colgroup>
                      <col className="col-item" style={{ width: '8.2mm' }} />
                      <col className="col-name" style={{ width: '22mm' }} />
                      <col className="col-rank" style={{ width: '17mm' }} />
                      {/* 31 天 */}
                      {Array.from({ length: 31 }).map((_, i) => (
                        <col key={i} className="col-day" style={{ width: '6.0mm' }} />
                      ))}
                      <col className="col-total" style={{ width: '18.0mm' }} />
                    </colgroup>

                    <thead>
                      {/* 表頭第一層 */}
                      <tr className="row-header-title" style={{ height: '6.8mm' }}>
                        <th
                          rowSpan={2}
                          className="en col-item"
                          style={{
                            width: '8.2mm',
                            fontSize: '8pt',
                            fontWeight: 'bold',
                            fontFamily: EN_FONT,
                            border: '1px solid #000',
                          }}
                        >
                          Item
                        </th>
                        <th
                          rowSpan={2}
                          className="en col-name"
                          style={{
                            width: '22mm',
                            fontSize: '8pt',
                            fontWeight: 'bold',
                            fontFamily: EN_FONT,
                            border: '1px solid #000',
                          }}
                        >
                          Name
                        </th>
                        <th
                          rowSpan={2}
                          className="en col-rank"
                          style={{
                            width: '17mm',
                            fontSize: '8pt',
                            fontWeight: 'bold',
                            fontFamily: EN_FONT,
                            border: '1px solid #000',
                          }}
                        >
                          Rank
                        </th>
                        <th
                          colSpan={31}
                          className="en"
                          style={{
                            fontSize: '12pt',
                            fontWeight: 'normal',
                            letterSpacing: '0.5px',
                            fontFamily: EN_FONT,
                            border: '1px solid #000',
                          }}
                        >
                          Daily Overtime Hours (Date)
                        </th>
                        <th
                          rowSpan={2}
                          className="en col-total"
                          style={{
                            width: '18.0mm',
                            fontSize: '8pt',
                            fontWeight: 'bold',
                            lineHeight: 1.1,
                            padding: '0 1mm',
                            fontFamily: EN_FONT,
                            border: '1px solid #000',
                          }}
                        >
                          Total
                          <br />
                          Overtime
                          <br />
                          Hours
                        </th>
                      </tr>
                      {/* 表頭第二層：1~31 日期列 */}
                      <tr className="row-header-dates" style={{ height: '6.0mm' }}>
                        {Array.from({ length: 31 }).map((_, d) => {
                          const num = d + 1;
                          const dateStr = num < 10 ? `0${num}` : `${num}`;
                          return (
                            <th
                              key={num}
                              className="en col-day"
                              style={{
                                width: '6.0mm',
                                fontSize: '8.5pt',
                                fontWeight: 'bold',
                                fontFamily: EN_FONT,
                                border: '1px solid #000',
                              }}
                            >
                              {dateStr}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {/* 當月份全體在船船員資料列 */}
                      {pageCrews.map(c => (
                        <tr
                          key={c.id}
                          className="row-data"
                          style={{ height: '6.8mm', fontSize: '10pt', boxSizing: 'border-box' }}
                        >
                          <td
                            className="en col-item"
                            style={{
                              width: '8.2mm',
                              fontSize: '8pt',
                              fontWeight: 'bold',
                              fontFamily: EN_FONT,
                              border: '1px solid #000',
                            }}
                          >
                            {c.item}
                          </td>
                          <td
                            className={/[\u4e00-\u9fa5]/.test(c.name) ? 'zh col-name' : 'en col-name'}
                            style={{
                              width: '22mm',
                              fontSize: '10pt',
                              fontFamily: /[\u4e00-\u9fa5]/.test(c.name) ? ZH_FONT : EN_FONT,
                              border: '1px solid #000',
                            }}
                          >
                            {c.name}
                          </td>
                          <td
                            className="en col-rank"
                            style={{
                              width: '17mm',
                              fontSize: '9.5pt',
                              fontFamily: EN_FONT,
                              border: '1px solid #000',
                            }}
                          >
                            {c.rank}
                          </td>
                          {Array.from({ length: 31 }).map((_, dayIdx) => {
                            const otVal = c.dailyOt[dayIdx];
                            return (
                              <td
                                key={dayIdx}
                                className="en col-day"
                                style={{
                                  width: '6.0mm',
                                  fontSize: '8.5pt',
                                  fontFamily: EN_FONT,
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  border: '1px solid #000',
                                }}
                              >
                                {otVal !== null ? otVal : ''}
                              </td>
                            );
                          })}
                          <td
                            className="en col-total"
                            style={{
                              width: '18.0mm',
                              fontSize: '9.5pt',
                              fontWeight: 'bold',
                              fontFamily: EN_FONT,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              border: '1px solid #000',
                            }}
                          >
                            {c.totalOt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* 底部說明文字與簽名區塊 (緊接在資料列下方) */}
                  <div
                    className="abs"
                    style={{
                      top: `${footerTopMm}mm`,
                      left: '22.9mm',
                      width: '251.2mm',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* 左側警語說明 */}
                    <div style={{ maxWidth: '175mm' }}>
                      <div
                        className="en"
                        style={{
                          fontSize: '10.5pt',
                          fontWeight: 'bold',
                          lineHeight: 1.35,
                          fontFamily: EN_FONT,
                        }}
                      >
                        **Please fill in the number of any hours of duty in excess of standard 8 (eight) hours per day.
                      </div>
                      <div
                        className="zh"
                        style={{
                          fontSize: '10.5pt',
                          fontWeight: 'bold',
                          marginTop: '1.5mm',
                          lineHeight: 1.35,
                          fontFamily: ZH_FONT,
                        }}
                      >
                        請依休息時數表，填入每日超過標準工作時數(8小時)外的加班時數(請注意每月個人之總和不應超過85小時)
                      </div>
                    </div>

                    {/* 右側船長簽名區 */}
                    <div style={{ width: '65mm', textAlign: 'center', marginRight: '2mm' }}>
                      {/* 簽名底線 */}
                      <div
                        style={{
                          borderBottom: '1.5px solid #000',
                          width: '100%',
                          height: '10mm',
                          marginBottom: '1.5mm',
                        }}
                      />
                      <div
                        className="en"
                        style={{
                          fontSize: '12pt',
                          fontWeight: 'bold',
                          fontFamily: EN_FONT,
                        }}
                      >
                        Master's Signature
                      </div>
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
