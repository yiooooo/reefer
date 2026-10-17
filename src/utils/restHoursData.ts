// REST HOURS MANAGER — 常數與預設資料
import type { CrewMember, DayData, GroupDef, ShipInfo } from '../types/restHours';

// ─── 時間選項 ────────────────────────────────────────────────────────────────

export const HOURS = Array.from({ length: 25 }, (_, i) => String(i).padStart(2, '0'));
export const MINUTES = ['00', '30'];
export const YEARS = ['2024', '2025', '2026', '2027', '2028'];
export const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

// ─── 進出港模式 ──────────────────────────────────────────────────────────────

export const MANEUVERING_MODES = [
  { code: 'ALL', label: '全時段起工' },
  { code: 'TWO_TWO', label: '前二後二(雙點班)' },
  { code: 'DUTY_ONLY', label: '僅當值起工 (實習生)' },
  { code: 'NONE', label: '不參與進出港' },
] as const;

// ─── 工作狀態定義 ────────────────────────────────────────────────────────────

export const STATUS_DEFINITIONS = [
  { code: 'N', name: '航行當值', color: 'bg-sky-50 text-sky-900 border-sky-200' },
  { code: 'P', name: '碼頭當值', color: 'bg-purple-100 text-purple-900 border-purple-300' },
  { code: 'D', name: '錨泊/防盜班', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { code: 'W', name: '進出港/派工', color: 'bg-rose-100 text-rose-900 border-rose-400 font-black' },
  { code: 'B', name: '加油作業', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  { code: 'T', name: 'ISM 訓練', color: 'bg-indigo-100 text-indigo-950 border-indigo-300 font-bold' },
  { code: 'I', name: '官員檢查', color: 'bg-orange-100 text-orange-900 border-orange-300' },
  { code: 'E', name: '緊急狀況', color: 'bg-red-600 text-white border-red-700 font-bold' },
  { code: 'O', name: '其他', color: 'bg-gray-200 text-gray-800 border-gray-400 font-bold' },
] as const;

/** B 表格點擊循環順序 */
export const B_STATUS_CYCLE = ['N', 'P', 'D', 'W', 'B', 'T', 'I', 'E', 'O'];

/** C 表格點擊循環順序（含 null = 休息） */
export const C_STATUS_CYCLE: (string | null)[] = [null, 'N', 'P', 'D', 'W', 'B', 'T', 'I', 'E', 'O'];

// ─── 預設作業群組 ─────────────────────────────────────────────────────────────

export const DEFAULT_GROUP_DEFINITIONS: GroupDef[] = [
  { id: 'g_1', code: '錨', name: '下錨作業', color: 'bg-blue-600 text-white border-blue-700' },
  { id: 'g_2', code: 'M', name: '船長作業', color: 'bg-amber-500 text-white border-amber-600' },
  { id: 'g_3', code: 'X', name: '大副作業', color: 'bg-emerald-600 text-white border-emerald-700' },
  { id: 'g_4', code: '三', name: '三副保養', color: 'bg-teal-600 text-white border-teal-700' },
  { id: 'g_5', code: '甲', name: '甲板班', color: 'bg-sky-600 text-white border-sky-700' },
  { id: 'g_6', code: '04', name: '04-08班', color: 'bg-indigo-600 text-white border-indigo-700' },
  { id: 'g_7', code: '08', name: '08-12班', color: 'bg-purple-600 text-white border-purple-700' },
  { id: 'g_8', code: '12', name: '12-04班', color: 'bg-rose-600 text-white border-rose-700' },
  { id: 'g_9', code: '廚', name: '大廚專用', color: 'bg-cyan-700 text-white border-cyan-800' },
  { id: 'g_10', code: '自2', name: '自訂作業2', color: 'bg-slate-700 text-white border-slate-800' },
];

// ─── 預設人員清單 ─────────────────────────────────────────────────────────────

const makeDutyShift = (sh: string, sm: string, eh: string, em: string) => ({
  startHour: sh,
  startMin: sm,
  endHour: eh,
  endMin: em,
});

export const DEFAULT_CREW_LIST: CrewMember[] = [
  {
    id: 'c_1', groups: ['g_1', 'g_2'], rank: 'CAPT', name: '王建國', engName: 'WANG JIANGUO',
    watchKeeping: 'N', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: true, portNoWork: true,
    dutyShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('20', '00', '24', '00')],
    workingShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('13', '30', '17', '30')],
    shiftChanges: [],
  },
  {
    id: 'c_2', groups: ['g_1', 'g_3'], rank: 'C/O', name: '李美玲', engName: 'LI MEILING',
    watchKeeping: 'Y', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: true,
    dutyShifts: [makeDutyShift('04', '00', '08', '00'), makeDutyShift('16', '00', '20', '00')],
    workingShifts: [makeDutyShift('04', '00', '08', '00'), makeDutyShift('16', '00', '20', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_3', groups: [], rank: '2/O', name: '張志強', engName: 'ZHANG ZHIQIANG',
    watchKeeping: 'Y', maneuveringMode: 'TWO_TWO',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('00', '00', '04', '00'), makeDutyShift('12', '00', '16', '00')],
    workingShifts: [makeDutyShift('00', '00', '04', '00'), makeDutyShift('12', '00', '16', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_4', groups: [], rank: '3/O(1)', name: '', engName: '',
    watchKeeping: 'Y', maneuveringMode: 'TWO_TWO',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('20', '00', '24', '00')],
    workingShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('20', '00', '24', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_5', groups: [], rank: '3/O(2)', name: '', engName: '',
    watchKeeping: 'Y', maneuveringMode: 'TWO_TWO',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('04', '00', '08', '00'), makeDutyShift('16', '00', '20', '00')],
    workingShifts: [makeDutyShift('04', '00', '08', '00'), makeDutyShift('16', '00', '20', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_6', groups: ['g_1', 'g_5'], rank: 'BOSUN', name: '', engName: '',
    watchKeeping: 'N', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('13', '30', '17', '30')],
    workingShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('13', '30', '17', '30')],
    shiftChanges: [],
  },
  {
    id: 'c_7', groups: ['g_1', 'g_5'], rank: 'CASSAB', name: '', engName: '',
    watchKeeping: 'N', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('13', '30', '17', '30')],
    workingShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('13', '30', '17', '30')],
    shiftChanges: [],
  },
  {
    id: 'c_8', groups: [], rank: 'AB(1)', name: '', engName: '',
    watchKeeping: 'Y', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('00', '00', '04', '00'), makeDutyShift('12', '00', '16', '00')],
    workingShifts: [makeDutyShift('00', '00', '04', '00'), makeDutyShift('12', '00', '16', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_9', groups: [], rank: 'AB(2)', name: '', engName: '',
    watchKeeping: 'Y', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('04', '00', '08', '00'), makeDutyShift('16', '00', '20', '00')],
    workingShifts: [makeDutyShift('04', '00', '08', '00'), makeDutyShift('16', '00', '20', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_10', groups: [], rank: 'AB(3)', name: '', engName: '',
    watchKeeping: 'Y', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('20', '00', '24', '00')],
    workingShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('20', '00', '24', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_11', groups: [], rank: 'AB(4)', name: '', engName: '',
    watchKeeping: 'N', maneuveringMode: 'ALL',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('08', '00', '12', '00'), makeDutyShift('13', '30', '17', '30')],
    workingShifts: [makeDutyShift('00', '00', '04', '00'), makeDutyShift('12', '00', '16', '00')],
    shiftChanges: [],
  },
  {
    id: 'c_12', groups: ['g_9'], rank: 'COOK', name: '', engName: '',
    watchKeeping: 'N', maneuveringMode: 'NONE',
    hasSignOn: false, signOnDate: '', signOnHour: '08', signOnMin: '00',
    hasSignOff: false, signOffDate: '', signOffHour: '12', signOffMin: '00',
    seaNoWork: false, portNoWork: false,
    dutyShifts: [makeDutyShift('06', '00', '08', '00'), makeDutyShift('10', '00', '13', '00'), makeDutyShift('15', '30', '18', '30')],
    workingShifts: [makeDutyShift('06', '00', '08', '00'), makeDutyShift('10', '00', '13', '00'), makeDutyShift('15', '30', '18', '30')],
    shiftChanges: [],
  },
];

// ─── 空白日資料工廠 ───────────────────────────────────────────────────────────

export const emptyDay = (): DayData => ({
  slots: Array(48).fill('N'),
  slotGroupOverrides: {},
  remark: '',
  isCustomHoliday: false,
  dayAdjust: '',
  clockAdjust: '',
  deckRestAm: false,
  deckRestPm: false,
});

// ─── 預設船舶基本資訊與機艙輪值 ──────────────────────────────────────────────

export const DEFAULT_SHIP_INFO: ShipInfo = {
  vesselName: 'YM AAAA',
  callSign: 'BLHB',
  imoNo: '9234567',
  portOfRegistry: 'KEELUNG',
  grossTonnage: '27,800 GT',
  propellingPower: '21,560 KW',
  vesselType: 'Container Ship',
  serviceRoute: 'Ocean going 遠洋線',
  engineCrewRoster: [
    { id: 'ec_1', rank: 'CE', type: 'ON_CALL' },
    { id: 'ec_2', rank: '2E', type: 'MAN_ZERO' },
    { id: 'ec_3', rank: '3E', type: 'MAN_ZERO' },
    { id: 'ec_4', rank: '4/E', type: 'MAN_ZERO' },
    { id: 'ec_5', rank: 'NO.1', type: 'DAY_WORK' },
    { id: 'ec_6', rank: 'MM', type: 'DAY_WORK' },
    { id: 'ec_7', rank: 'CC', type: 'DAY_WORK' },
  ],
  engineersOnCallRanks: ['2E', '3E', '4/E'],
};

