import { TempRecord } from '../types/reefer';

const API_URL = '/api/generate-temp';

/**
 * 透過後端 API 自動產生巡溫紀錄（算法在伺服器端，前端看不到）
 */
export const generateAutoTempRecordsApi = async (
  settingTemp: string,
  loadingDatetime: string,
  dischargeDatetime: string
): Promise<TempRecord[]> => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generateTemp',
      settingTemp,
      loadingDatetime,
      dischargeDatatime: dischargeDatetime,
    }),
  });

  if (!res.ok) throw new Error(`generateTemp failed: ${res.status}`);
  const data = await res.json();
  return data.records as TempRecord[];
};

/**
 * 透過後端 API 計算冷藏天數與獎金（計費規則在伺服器端，前端看不到）
 */
export const calculateReeferDaysAndCashApi = async (
  loadingDatetime?: string,
  dischargeDatetime?: string,
  tempRecordsLength: number = 0
): Promise<{ days: number; cash: number }> => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'calculateDaysAndCash',
      loadingDatetime,
      dischargeDatatime: dischargeDatetime,
      tempRecordsLength,
    }),
  });

  if (!res.ok) throw new Error(`calculateDaysAndCash failed: ${res.status}`);
  return res.json();
};
