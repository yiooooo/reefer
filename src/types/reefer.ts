export interface TempRecord {
  id: string;
  dateLog: string; // YYYY-MM-DD
  df1: string; // 08:00
  df2: string; // 16:00
  df3: string; // 23:59
  remark: string;
}

export interface CrewRecord {
  id: string;
  role: string; // 巡櫃人員職稱 (例如: 'C/O', '2/O', '3/O', '3/E', 'E/E')
}

export interface ReeferContainer {
  id: string;
  containerNumber: string; // 櫃號 (例如: TCKU1185086)
  settingTemp: string; // 設定溫度 (例如: 3°C)
  commodity: string; // 貨物名稱
  loadingLocation: string; // 裝載位置 (例如: 010082)
  loadingPort: string; // 裝船港 (例如: KHH)
  loadingDatetime: string; // 裝船日期時間 (格式: YYYY-MM-DD HH:mm)
  loadingTemp: string; // 裝船溫度
  dischargePort: string; // 卸船港 (例如: NGO)
  dischargeDatetime: string; // 卸船日期時間 (格式: YYYY-MM-DD HH:mm)
  dischargeTemp: string; // 卸船溫度
  remark1: string; // 通風開度等備註
  days: number; // 巡溫記錄天數
  cash: number; // 計算獎金金額 (400 或 800 NTD)
  isHidden?: boolean; // 是否隱藏
  tempRecords: TempRecord[]; // 每日溫度記錄
  crewRecords: CrewRecord[]; // 巡櫃人員記錄
}

export interface ReeferFormState {
  category: string;
  formType: string;
  imo: string;
  vesselName: string;
  vesselStatus: 'own vessel' | 'chartered vessel';
  voyage: string;
  printPortInput: string; // 船岸交接單港口列印輸入值
  containers: ReeferContainer[];
  selectedContainerId: string | null;
  queryType: 'LOAD' | 'DISCHARGE' | 'BAY';
  printType: 'LOADPRINT' | 'DISCHARGEPRINT';
  importType: 'SUPERCARGO' | 'MACS3';
}
