import { ReeferContainer, ReeferFormState } from '../types/reefer';

/**
 * 列印船岸交接單 (Ship-Shore Handover Form)
 * 參考舊專案 (REEFER INTERCHANGE TEMP. REPORT) 表格格式與報表樣式
 */
export const printHandoverForm = (
  formState: ReeferFormState,
  printType: 'LOADPRINT' | 'DISCHARGEPRINT',
  portFilter: string
) => {
  const isLoad = printType === 'LOADPRINT';
  const isDischarge = printType === 'DISCHARGEPRINT';
  const portUpper = portFilter.trim().toUpperCase();

  // 依據港口條件篩選冷櫃資料
  const containers: ReeferContainer[] = formState.containers.filter((c) => {
    if (!portUpper) return true;
    const targetPort = isLoad ? c.loadingPort : c.dischargePort;
    return (targetPort?.trim().toUpperCase() || '').startsWith(portUpper);
  });

  const loadCheck = isLoad ? '✅' : '';
  const dischCheck = isDischarge ? '✅' : '';

  // 產生表格列內容 (對齊舊專案格式)
  const rowsHtml = containers
    .map((c, idx) => {
      const remarkLoc = [c.remark1?.trim(), c.loadingLocation?.trim()].filter(Boolean).join(' / ');
      return `
        <tr>
          <td style="font-size: 11px; padding: 4px 2px; line-height: 1;">${idx + 1}</td>
          <td style="font-size: 11px; padding: 4px 2px; line-height: 1; font-weight: bold;">${c.containerNumber || '-'}</td>
          <td style="font-size: 11px; padding: 4px 2px; line-height: 1;">${c.settingTemp || '-'}</td>
          <td style="width: 70px;"></td>
          <td style="width: 70px;"></td>
          <td style="width: 80px;"></td>
          <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; font-size: 10px; padding: 4px 2px; line-height: 1;">${c.commodity || ''}</td>
          <td style="font-size: 11px; padding: 4px 2px; line-height: 1;">${remarkLoc || '-'}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <title>REEFER INTERCHANGE TEMP. REPORT - ${formState.vesselName || ''} ${formState.voyage || ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 15px; }
    h3 { text-align: center; margin-bottom: 12px; font-size: 18px; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 6px; text-align: center; vertical-align: middle; }
    .meta-table td { font-size: 12px; height: 26px; }
    .data-table th { font-size: 11px; font-weight: bold; background-color: #f2f2f2; }
    .print-button { display: block; margin: 20px auto; text-align: center; font-size: 16px; }
    .signature-section { margin-top: 25px; line-height: 2; font-size: 12px; font-weight: bold; }

    @media print {
      .print-button { display: none; }
      body { padding: 5px; }
      @page { size: A4 portrait; margin: 10mm; }
    }
  </style>
</head>
<body>
  <h3><img src="assets/logo/YM_RGB.png" style="width: 25px; height: 25px; vertical-align: middle; margin-right: 6px;" alt="Logo" />REEFER INTERCHANGE TEMP. REPORT</h3>
  
  <table class="meta-table" style="margin-bottom: 12px;">
    <tr>
      <td style="text-align: left; width: 33%;">SHIP：${formState.vesselName || ''}</td>
      <td style="text-align: left; width: 33%;">VOY：${formState.voyage || ''}</td>
      <td style="text-align: left; width: 34%;" rowspan="2">DATE (YY/MM/DD)：</td>
    </tr>
    <tr>
      <td style="text-align: left;">DISCHARGE：${dischCheck}</td>
      <td style="text-align: left;">PORT：${portUpper || 'ALL'}</td>
    </tr>
    <tr>
      <td style="text-align: left;">LOADING：${loadCheck}</td>
      <td style="text-align: left;">TERMINAL：</td>
      <td style="text-align: left;">RECORDED BY：</td>
    </tr>
  </table>

  <table class="data-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 35px;">NO.</th>
        <th rowspan="2" style="width: 130px;">Container Number</th>
        <th rowspan="2" style="width: 80px;">Setting Temp</th>
        <th colspan="2">HAND OVER TEMP.</th>
        <th rowspan="2" style="width: 90px;">HANDOVER TIME</th>
        <th rowspan="2">COMMODITY</th>
        <th rowspan="2" style="width: 140px;">REMARK / LOCATION</th>
      </tr>
      <tr>
        <th style="width: 70px;">CHART</th>
        <th style="width: 70px;">CHECK READING</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" style="padding: 15px;">無符合條件之冷櫃資料</td></tr>'}
    </tbody>
  </table>

  <div class="signature-section">
    SERVICE MECHANIC：<br/><br/>
    YML TERMINAL SUPERVISOR SIGNATURE：<br/><br/>
    SHIP CHIEF OFFICER：
  </div>

  <div class="print-button">
    <a href="#" onclick="window.print(); return false;" style="padding: 8px 16px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 4px;">Print / 列印</a>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;

  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) {
    alert('請允許彈出視窗以進行列印！\nPlease allow popups to print.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
};
