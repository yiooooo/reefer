import { ReeferFormState } from '../types/reefer';

export const STORAGE_KEY = 'reefer_bonus_app_state_v1';

export const getInitialState = (): ReeferFormState => {
  const defaultState: ReeferFormState = {
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
    containers: [],
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.containers)) {
        return {
          ...defaultState,
          ...parsed,
        };
      }
    }
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
  }

  return defaultState;
};
