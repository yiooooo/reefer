import { ReeferFormState } from '../types/reefer';

export const getInitialState = (): ReeferFormState => {
  return {
    category: 'WEB_FFS',
    formType: 'reefer_bonus',
    imo: '9319131',
    vesselName: 'YM IMMENSE 雲明',
    vesselStatus: 'own vessel',
    voyage: '',
    printPortInput: '',
    queryType: 'DISCHARGE',
    printType: 'LOADPRINT',
    importType: 'SUPERCARGO',
    selectedContainerId: null,
    containers: [], // 預設空值
  };
};
