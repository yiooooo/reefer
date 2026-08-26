export type Language = 'zh-TW' | 'en';

export interface TranslationSchema {
  common: {
    confirm: string;
    cancel: string;
    delete: string;
    save: string;
    close: string;
    loading: string;
    reset: string;
    import: string;
    export: string;
    all: string;
  };
  header: {
    systemTitle: string;
    vesselSelect: string;
    vesselSelectPlaceholder: string;
    resetBtn: string;
    importBtn: string;
    exportBtn: string;
  };
  basicInfo: {
    cardTag: string;
    ownVessel: string;
    charteredVessel: string;
    voyage: string;
    voyagePlaceholder: string;
    handoverTag: string;
    loadingType: string;
    dischargeType: string;
    handoverPort: string;
    noPortData: string;
    selectPort: string;
    selectType: string;
    printHandover: string;
    totalAmount: string;
    longVoyageCount: string;
    shortVoyageCount: string;
  };
  stats: {
    total: string;
    onboard: string;
    discharged: string;
  };
  reeferList: {
    panelTitle: string;
    crewRoles: string;
    deleteSelectedTitle: string;
    addOneReeferTitle: string;
    filterSettingsTitle: string;
    resetFilters: string;
    allDischargePorts: string;
    allLoadingPorts: string;
    pol: string;
    pod: string;
    search: string;
    searchPlaceholder: string;
    emptyNoDataTitle: string;
    emptyNoDataDesc: string;
    addFirstReefer: string;
    importFile: string;
    emptySearchMatch: string;
    emptyNoDischarged: string;
    emptyNoOnboard: string;
    clearFilters: string;
    dupWarningTooltip: string;
    dupLocationAlert: string;
  };
  table: {
    rowNumber: string;
    containerNumber: string;
    containerNumberPlaceholder: string;
    loadingLocation: string;
    loadingLocationPlaceholder: string;
    settingTemp: string;
    commodity: string;
    commodityPlaceholder: string;
    ventilation: string;
    loadingPort: string;
    loadingDatetime: string;
    loadingTemp: string;
    dischargePort: string;
    dischargeDatetime: string;
    dischargeTemp: string;
    tempRecording: string;
    deleteRowTitle: string;
  };
  tempRecord: {
    panelTitle: string;
    emptyTitle: string;
    emptyDesc: string;
    closeTitle: string;
    recordDays: string;
    recordsCount: string;
    bonusAmount: string;
    autoGenSingle: string;
    autoGenSingleTitle: string;
    autoGenSingleDisabledTitle: string;
    autoGenAll: string;
    autoGenAllTitle: string;
    recordDate: string;
    df1: string;
    df2: string;
    df3: string;
    time8: string;
    time16: string;
    time24: string;
    addRecordTitle: string;
    deleteRecordTitle: string;
    noRecordsPrompt: string;
  };
  importModal: {
    title: string;
    fileLabel: string;
    fileLoaded: string;
    formatLabel: string;
    formatAuto: string;
    formatXml: string;
    formatSupercargo: string;
    formatMacs3: string;
    duplicateRuleLabel: string;
    dupAllow: string;
    dupUpdate: string;
    dupSkip: string;
    directPasteLabel: string;
    pastePlaceholder: string;
    detectedType: string;
    parsedCount: string;
    importConfirmBtn: string;
    cancelBtn: string;
    selectFileError: string;
    parseError: string;
  };
  exportModal: {
    title: string;
    instruction: string;
    summaryTitle: string;
    vessel: string;
    voyage: string;
    totalCount: string;
    dischargedCount: string;
    onboardCount: string;
    exportBtn: string;
    cancelBtn: string;
  };
  duplicateModal: {
    title: string;
    warningDesc: string;
    location: string;
    totalSlots: string;
    firstVoyage: string;
    laterVoyage: string;
    closeBtn: string;
  };
  resetModal: {
    title: string;
    desc: string;
    confirmBtn: string;
    cancelBtn: string;
  };
  status: {
    discharged: string;
    onboard: string;
    waiting: string;
  };
  nav: {
    menu: string;
    reeferBonus: string;
    admin: string;
    account: string;
    logout: string;
    expandSidebar: string;
    collapseSidebar: string;
    adminRole: string;
    crewRole: string;
  };
  login: {
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    loginBtn: string;
    loggingInBtn: string;
    loginFailed: string;
    invalidCredentials: string;
    showPassword: string;
    hidePassword: string;
  };
  admin: {
    title: string;
    desc: string;
    userPermTitle: string;
    userPermDesc: string;
    sysSettingsTitle: string;
    sysSettingsDesc: string;
    reportsTitle: string;
    reportsDesc: string;
    comingSoon: string;
  };
  account: {
    title: string;
    subtitle: string;
    detailsTitle: string;
    displayName: string;
    email: string;
    role: string;
    adminRole: string;
    crewRole: string;
    devicesTitle: string;
    currentDevice: string;
    inUseBadge: string;
    onlineStatus: string;
    browserType: string;
    auditNotice: string;
  };
  notFound: {
    title: string;
    desc: string;
    backBtn: string;
  };
  auth: {
    forbiddenTitle: string;
    forbiddenDesc: string;
    loading: string;
  };
  toasts: {
    addedContainers: string;
    deletedContainer: string;
    autoTempSuccessSingle: string;
    autoTempSuccessAll: string;
    autoTempNoEligible: string;
    importedSuccessAccumulated: string;
    importedSuccess: string;
    resetSuccess: string;
    exportSuccess: string;
    printNoData: string;
  };
}

// 遞迴推導出 "section.key" 形式的型別安全 Key
type Prev = [never, 0, 1, 2, 3];
type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

export type TranslationKey = {
  [K in keyof TranslationSchema]: TranslationSchema[K] extends object
    ? Join<K, keyof TranslationSchema[K]>
    : K;
}[keyof TranslationSchema];
