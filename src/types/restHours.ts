// REST HOURS MANAGER — 共用型別定義

export interface TimeShift {
  startHour: string;
  startMin: string;
  endHour: string;
  endMin: string;
}

export interface ShiftChange {
  id: string;
  groups: string[];
  effectiveDate: string;
  effectiveHour: string;
  effectiveMin: string;
  watchKeeping: string;
  maneuveringMode: string;
  dutyShifts: TimeShift[];
  workingShifts: TimeShift[];
}

export interface CrewMember {
  id: string;
  groups: string[];
  rank: string;
  name: string;
  engName: string;
  watchKeeping: string;
  maneuveringMode: string;
  hasSignOn: boolean;
  signOnDate: string;
  signOnHour: string;
  signOnMin: string;
  hasSignOff: boolean;
  signOffDate: string;
  signOffHour: string;
  signOffMin: string;
  seaNoWork: boolean;
  portNoWork: boolean;
  dutyShifts: TimeShift[];
  workingShifts: TimeShift[];
  shiftChanges: ShiftChange[];
}

export interface DayData {
  slots: string[];
  slotGroupOverrides: Record<number, Record<string, string>>;
  remark: string;
  isCustomHoliday: boolean;
  dayAdjust: string;
  clockAdjust: string;
  deckRestAm: boolean;
  deckRestPm: boolean;
}

export interface GroupDef {
  id: string;
  code: string;
  name: string;
  color: string;
}

export interface CrewOverrides {
  slots: Record<string, Record<number, string | null>>;
  remarks: Record<string, string>;
}

/** 用於渲染月曆列表的一列資料 */
export interface DisplayRow {
  rowKey: string;
  displayLabel: string;
  dateSuffix: string;
  weekName: string;
  isWeekend: boolean;
  dayNum: number;
  dayOfWeek?: number;
}

export type EngineCrewDutyType = 'MAN_ZERO' | 'DAY_WORK' | 'ON_CALL';

export interface EngineCrew {
  id: string;
  rank: string;
  type: EngineCrewDutyType;
}

export interface ShipInfo {
  vesselName: string;
  callSign: string;
  imoNo: string;
  portOfRegistry: string;
  grossTonnage: string;
  propellingPower: string;
  vesselType: string;
  serviceRoute: string;
  engineCrewRoster: EngineCrew[];
  engineersOnCallRanks: string[];
}

export type RestHoursView = 'PART_A' | 'PART_B' | 'PART_C' | 'PART_D';
