import vesselData from './vessel.json';

export interface VesselInfo {
  VSL_NAME: string;
  IMO_NO: string;
  VESSEL: string;
  AMOS_CODE: string;
}

export const VESSEL_LIST: VesselInfo[] = vesselData;
