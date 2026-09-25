import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { BasicInfoCard } from '../components/BasicInfoCard';
import { ReeferListPanel } from '../components/ReeferListPanel';
import { TempRecordingPanel } from '../components/TempRecordingPanel';
import { ImportModal } from '../components/ImportModal';
import { ExportModal } from '../components/ExportModal';
import { ResetConfirmModal } from '../components/ResetConfirmModal';
import { getInitialState, STORAGE_KEY } from '../utils/initialData';
import { ReeferContainer, ReeferFormState, TempRecord } from '../types/reefer';
import { formatTempNumber } from '../utils/tempGenerator';
import { generateAutoTempRecordsApi, calculateReeferDaysAndCashApi } from '../api/tempApi';
import { printHandoverForm } from '../utils/printHandover';
import { findDuplicateLocations, DuplicateLocationModal } from '../components/DuplicateLocationModal';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

export const ReeferBonusPage: React.FC = () => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<ReeferFormState>(getInitialState);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [showTempPanel, setShowTempPanel] = useState(false);
  const [tempContainerId, setTempContainerId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 自動同步 state 至 localStorage，確保網頁重新整理後資料不遺失
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
    } catch (err) {
      console.error('Failed to save state to localStorage:', err);
    }
  }, [formState]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 當前選取的冷櫃
  const selectedContainer = useMemo(() => {
    return formState.containers.find((c) => c.id === formState.selectedContainerId) || null;
  }, [formState.containers, formState.selectedContainerId]);

  // 統計指標計算
  const totalCash = useMemo(() => {
    return formState.containers.reduce((acc, c) => acc + (c.cash || 0), 0);
  }, [formState.containers]);

  const longCount = useMemo(() => {
    return formState.containers.filter((c) => c.cash === 800).length;
  }, [formState.containers]);

  const shortCount = useMemo(() => {
    return formState.containers.filter((c) => c.cash === 400).length;
  }, [formState.containers]);

  const dischargedCount = useMemo(() => {
    return formState.containers.filter((c) => c.dischargeDatetime?.trim()).length;
  }, [formState.containers]);

  // 重複裝載位置偵測
  const duplicateConflicts = useMemo(() => {
    return findDuplicateLocations(formState.containers);
  }, [formState.containers]);

  // 基本資訊與交接單表單處置器
  const handleVesselStatusChange = (status: 'own vessel' | 'chartered vessel') => {
    setFormState((prev) => ({ ...prev, vesselStatus: status }));
  };

  const handleVoyageChange = (voyage: string) => {
    setFormState((prev) => ({ ...prev, voyage }));
  };

  const handlePrintTypeChange = (printType: 'LOADPRINT' | 'DISCHARGEPRINT') => {
    setFormState((prev) => ({ ...prev, printType }));
  };

  const handlePrintPortInputChange = useCallback((printPortInput: string) => {
    setFormState((prev) => ({ ...prev, printPortInput }));
  }, []);

  // 冷櫃資料維護處置器
  const handleSelectContainer = (id: string) => {
    setFormState((prev) => ({ ...prev, selectedContainerId: id }));
    if (showTempPanel) {
      setTempContainerId(id);
    }
  };

  const handleAddContainer = (count: number = 1) => {
    setFormState((prev) => {
      const newContainers: ReeferContainer[] = [...prev.containers];

      for (let i = 0; i < count; i++) {
        const newId = `cnt-${Date.now()}-${i}`;
        newContainers.push({
          id: newId,
          containerNumber: '',
          settingTemp: '',
          commodity: '',
          loadingLocation: '',
          loadingPort: '',
          loadingDatetime: '',
          loadingTemp: '',
          dischargePort: '',
          dischargeDatetime: '',
          dischargeTemp: '',
          remark1: '',
          days: 1,
          cash: 400,
          isHidden: false,
          tempRecords: [],
          crewRecords: [
            { id: `cr-${Date.now()}-1`, role: 'C/O' },
            { id: `cr-${Date.now()}-2`, role: '2/O' },
            { id: `cr-${Date.now()}-3`, role: '3/O' },
            { id: `cr-${Date.now()}-4`, role: '3/E' },
          ],
        });
      }

      const nextSelectedId = newContainers[newContainers.length - 1].id;
      if (showTempPanel) {
        setTempContainerId(nextSelectedId);
      }

      return {
        ...prev,
        containers: newContainers,
        selectedContainerId: nextSelectedId,
      };
    });

    showToast(t('toasts.addedContainers', { count }));
  };

  const handleDeleteContainer = (id: string) => {
    setFormState((prev) => {
      const updated = prev.containers.filter((c) => c.id !== id);
      const nextSelected = updated.length > 0 ? updated[updated.length - 1].id : null;
      if (showTempPanel) {
        if (nextSelected) {
          setTempContainerId(nextSelected);
        } else {
          setShowTempPanel(false);
          setTempContainerId(null);
        }
      }
      return {
        ...prev,
        containers: updated,
        selectedContainerId: nextSelected,
      };
    });
    showToast(t('toasts.deletedContainer'));
  };


  const handleUpdateContainer = async <K extends keyof ReeferContainer>(id: string, field: K, value: ReeferContainer[K]) => {
    // 若更新裝卸船時間，先向後端取得計算結果（計費規則在後端，前端看不到）
    let daysCash: { days: number; cash: number } | null = null;
    if (field === 'loadingDatetime' || field === 'dischargeDatetime') {
      const c = formState.containers.find((c) => c.id === id);
      if (c) {
        const loading = field === 'loadingDatetime' ? (value as string) : c.loadingDatetime;
        const discharge = field === 'dischargeDatetime' ? (value as string) : c.dischargeDatetime;
        try {
          daysCash = await calculateReeferDaysAndCashApi(loading, discharge, c.tempRecords?.length || 0);
        } catch (err) {
          console.error('calculateDaysAndCash API failed:', err);
        }
      }
    }

    setFormState((prev) => {
      const updatedContainers = prev.containers.map((c) => {
        if (c.id === id) {
          const updated = { ...c, [field]: value };
          if (daysCash) {
            updated.days = daysCash!.days;
            updated.cash = daysCash!.cash;
          }
          return updated;
        }
        return c;
      });

      if (field === 'loadingLocation' && value && String(value).trim()) {
        const dupes = findDuplicateLocations(updatedContainers);
        if (dupes.length > 0) {
          setIsDuplicateOpen(true);
        }
      }

      return {
        ...prev,
        containers: updatedContainers,
      };
    });
  };

  // 巡溫紀錄維護處置器
  const handleAddTempRecord = async (containerId: string, count: number = 1) => {
    const c = formState.containers.find((c) => c.id === containerId);
    if (!c) return;

    const newRecords: TempRecord[] = [...c.tempRecords];
    let baseDateStr = c.loadingDatetime ? c.loadingDatetime.split('T')[0] : '';
    if (newRecords.length > 0) {
      const lastDateStr = newRecords[newRecords.length - 1].dateLog;
      if (lastDateStr) {
        const lastDate = new Date(lastDateStr);
        if (!isNaN(lastDate.getTime())) baseDateStr = lastDateStr;
      }
    }

    for (let i = 0; i < count; i++) {
      let dateStr = baseDateStr;
      if (baseDateStr) {
        const d = new Date(baseDateStr);
        d.setDate(d.getDate() + (newRecords.length > 0 ? i + 1 : i));
        dateStr = d.toISOString().split('T')[0];
      }
      newRecords.push({ id: `tr-${Date.now()}-${i}`, dateLog: dateStr, df1: '', df2: '', df3: '', remark: '' });
    }

    let days = c.days;
    let cash = c.cash;
    try {
      const result = await calculateReeferDaysAndCashApi(c.loadingDatetime, c.dischargeDatetime, newRecords.length);
      days = result.days;
      cash = result.cash;
    } catch (err) {
      console.error('calculateDaysAndCash API failed:', err);
    }

    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((ct) =>
        ct.id === containerId ? { ...ct, tempRecords: newRecords, days, cash } : ct
      ),
    }));
  };

  const handleDeleteTempRecord = async (containerId: string, recordId: string) => {
    const c = formState.containers.find((c) => c.id === containerId);
    if (!c) return;

    const updatedRecords = c.tempRecords.filter((r) => r.id !== recordId);
    let days = c.days;
    let cash = c.cash;
    try {
      const result = await calculateReeferDaysAndCashApi(c.loadingDatetime, c.dischargeDatetime, updatedRecords.length);
      days = result.days;
      cash = result.cash;
    } catch (err) {
      console.error('calculateDaysAndCash API failed:', err);
    }

    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((ct) =>
        ct.id === containerId ? { ...ct, tempRecords: updatedRecords, days, cash } : ct
      ),
    }));
  };

  const handleUpdateTempRecord = <K extends keyof TempRecord>(
    containerId: string,
    recordId: string,
    field: K,
    value: TempRecord[K]
  ) => {
    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((c) => {
        if (c.id === containerId) {
          const updatedRecords = c.tempRecords.map((r) =>
            r.id === recordId ? { ...r, [field]: value } : r
          );
          return {
            ...c,
            tempRecords: updatedRecords,
          };
        }
        return c;
      }),
    }));
  };

  // 自動生成巡溫紀錄處置器（呼叫後端 API，算法不暴露在前端）
  const handleAutoGenerateTemp = async (containerId: string) => {
    const c = formState.containers.find((c) => c.id === containerId);
    if (!c || !c.loadingDatetime || !c.dischargeDatetime) return;

    try {
      const autoRecords = await generateAutoTempRecordsApi(
        c.settingTemp,
        c.loadingDatetime,
        c.dischargeDatetime
      );
      const { days, cash } = await calculateReeferDaysAndCashApi(
        c.loadingDatetime,
        c.dischargeDatetime,
        autoRecords.length
      );

      setFormState((prev) => ({
        ...prev,
        containers: prev.containers.map((ct) =>
          ct.id === containerId
            ? { ...ct, tempRecords: autoRecords, days, cash }
            : ct
        ),
      }));

      showToast(t('toasts.autoTempSuccessSingle'));
    } catch (err) {
      console.error('Auto generate temp failed:', err);
    }
  };

  const handleAutoGenerateAllTemp = async () => {
    const eligibleContainers = formState.containers.filter(
      (c) => !!c.loadingDatetime?.trim() && !!c.dischargeDatetime?.trim()
    );

    if (eligibleContainers.length === 0) {
      showToast(t('toasts.autoTempNoEligible'));
      return;
    }

    try {
      // 平行呼叫 API 取得所有冷櫃的溫度紀錄
      const results = await Promise.all(
        eligibleContainers.map(async (c) => {
          const autoRecords = await generateAutoTempRecordsApi(
            c.settingTemp,
            c.loadingDatetime,
            c.dischargeDatetime
          );
          const { days, cash } = await calculateReeferDaysAndCashApi(
            c.loadingDatetime,
            c.dischargeDatetime,
            autoRecords.length
          );
          return { id: c.id, autoRecords, days, cash };
        })
      );

      const resultMap = new Map(results.map((r) => [r.id, r]));
      const generatedCount = results.filter((r) => r.autoRecords.length > 0).length;

      if (generatedCount === 0) {
        showToast(t('toasts.autoTempNoEligible'));
        return;
      }

      setFormState((prev) => ({
        ...prev,
        containers: prev.containers.map((c) => {
          const result = resultMap.get(c.id);
          if (result && result.autoRecords.length > 0) {
            return { ...c, tempRecords: result.autoRecords, days: result.days, cash: result.cash };
          } else {
            // 對於未符合自動生成條件的冷櫃，過濾掉全空白預留列
            const cleanedRecords = (c.tempRecords || []).filter(
              (r) => !!r.df1?.trim() || !!r.df2?.trim() || !!r.df3?.trim() || !!r.remark?.trim()
            );
            return { ...c, tempRecords: cleanedRecords };
          }
        }),
      }));

      showToast(t('toasts.autoTempSuccessAll', { count: generatedCount }));
    } catch (err) {
      console.error('Auto generate all temp failed:', err);
    }
  };


  // XML 與 TXT 檔案匯入處置器
  const handleImportContainers = async (
    importedData: Partial<ReeferContainer>[],
    metaData?: { voyage?: string; vesselName?: string },
    options: { duplicateMode?: 'allow_duplicate' | 'update_existing' | 'skip_existing' } = {}
  ) => {
    const { duplicateMode = 'allow_duplicate' } = options;

    let addedCount = 0;
    let updatedCount = 0;
    let finalTotalCount = 0;

    // 先平行呼叫 API 計算每個 container 的天數與獎金（計費規則在後端）
    const computedList = await Promise.all(
      importedData.map(async (item, index) => {
        const newId = `imported-${Date.now()}-${index}`;
        const rawTempRecords = item.tempRecords && item.tempRecords.length > 0 ? item.tempRecords : [];
        const tempRecords = rawTempRecords.map((r) => ({
          ...r,
          df1: formatTempNumber(r.df1),
          df2: formatTempNumber(r.df2),
          df3: formatTempNumber(r.df3),
        }));

        let computedDays = 1;
        let computedCash = 400;
        try {
          const result = await calculateReeferDaysAndCashApi(
            item.loadingDatetime,
            item.dischargeDatetime,
            tempRecords.length
          );
          computedDays = result.days;
          computedCash = result.cash;
        } catch (err) {
          console.error('calculateDaysAndCash API failed for item:', err);
        }

        const days = item.days || computedDays;
        const cash = item.cash || computedCash;

        return {
          id: newId,
          containerNumber: item.containerNumber || '',
          settingTemp: formatTempNumber(item.settingTemp),
          commodity: item.commodity || '',
          loadingLocation: item.loadingLocation || '',
          loadingPort: item.loadingPort || '',
          loadingDatetime: item.loadingDatetime || '',
          loadingTemp: formatTempNumber(item.loadingTemp),
          dischargePort: item.dischargePort || '',
          dischargeDatetime: item.dischargeDatetime || '',
          dischargeTemp: formatTempNumber(item.dischargeTemp),
          remark1: item.remark1 || '',
          days,
          cash,
          isHidden: false,
          tempRecords,
          crewRecords:
            item.crewRecords && item.crewRecords.length > 0
              ? item.crewRecords
              : [
                  { id: `cr-${newId}-1`, role: 'C/O' },
                  { id: `cr-${newId}-2`, role: '2/O' },
                  { id: `cr-${newId}-3`, role: '3/O' },
                  { id: `cr-${newId}-4`, role: '3/E' },
                ],
        } as ReeferContainer;
      })
    );

    setFormState((prev) => {
      const newContainers = computedList;

      let updatedList: ReeferContainer[] = [];

      // 累加模式：檢查現有清單是否僅包含 1 筆未編輯的空白預設列
      const isSingleBlankItem =
        prev.containers.length === 1 &&
        !prev.containers[0].containerNumber.trim() &&
        !prev.containers[0].loadingLocation.trim();

      const baseContainers = isSingleBlankItem ? [] : [...prev.containers];

      if (duplicateMode === 'allow_duplicate') {
        updatedList = [...baseContainers, ...newContainers];
        addedCount = newContainers.length;
      } else if (duplicateMode === 'skip_existing') {
        const existingCntNumbers = new Set(
          baseContainers.map((c) => c.containerNumber.trim().toUpperCase()).filter(Boolean)
        );
        const filteredNew = newContainers.filter(
          (c) => !c.containerNumber.trim() || !existingCntNumbers.has(c.containerNumber.trim().toUpperCase())
        );
        updatedList = [...baseContainers, ...filteredNew];
        addedCount = filteredNew.length;
      } else if (duplicateMode === 'update_existing') {
        const resultList = [...baseContainers];
        newContainers.forEach((newCnt) => {
          const cntNum = newCnt.containerNumber.trim().toUpperCase();
          if (cntNum) {
            const existingIdx = resultList.findIndex(
              (c) => c.containerNumber.trim().toUpperCase() === cntNum
            );
            if (existingIdx !== -1) {
              resultList[existingIdx] = { ...resultList[existingIdx], ...newCnt, id: resultList[existingIdx].id };
              updatedCount++;
            } else {
              resultList.push(newCnt);
              addedCount++;
            }
          } else {
            resultList.push(newCnt);
            addedCount++;
          }
        });
        updatedList = resultList;
      }

      finalTotalCount = updatedList.length;
      const nextSelectedId = updatedList.length > 0 ? updatedList[updatedList.length - 1].id : null;

      return {
        ...prev,
        voyage: metaData?.voyage || prev.voyage,
        vesselName: metaData?.vesselName || prev.vesselName,
        containers: updatedList,
        selectedContainerId: nextSelectedId,
      };
    });

    if (duplicateMode === 'update_existing' && updatedCount > 0) {
      showToast(t('toasts.importedSuccessAccumulated', { added: addedCount, updated: updatedCount, total: finalTotalCount }));
    } else {
      showToast(t('toasts.importedSuccess', { added: addedCount, total: finalTotalCount }));
    }

    // 匯入完成後自動檢查是否有重複裝載位置
    setTimeout(() => {
      setFormState((latestState) => {
        const dupes = findDuplicateLocations(latestState.containers);
        if (dupes.length > 0) setIsDuplicateOpen(true);
        return latestState;
      });
    }, 100);
  };

  const handleConfirmReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear localStorage:', err);
    }
    setFormState(getInitialState());
    showToast(t('toasts.resetSuccess'));
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-2000 bg-white border border-sky-200 shadow-lg rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm font-semibold text-sky-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={17} className="text-sky-600 shrink-0" />
          {toastMessage}
        </div>
      )}

      {/* Top Dark Header */}
      <Header
        vesselName={formState.vesselName}
        onUpdateVessel={(vesselName, imo) => {
          setFormState((prev) => ({
            ...prev,
            vesselName,
            ...(imo ? { imo } : {}),
          }));
        }}
        onReset={() => setIsResetOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Workspace */}
      <div className="workspace-content">
        {/* Top Control Bar with Handover Form Input */}
        <BasicInfoCard
          vesselStatus={formState.vesselStatus}
          voyage={formState.voyage}
          printType={formState.printType}
          printPortInput={formState.printPortInput}
          containers={formState.containers}
          totalCash={totalCash}
          longCount={longCount}
          shortCount={shortCount}
          onVesselStatusChange={handleVesselStatusChange}
          onVoyageChange={handleVoyageChange}
          onPrintTypeChange={handlePrintTypeChange}
          onPrintPortInputChange={handlePrintPortInputChange}
          onPrint={() => {
            if (formState.containers.length === 0) {
              showToast(t('toasts.printNoData'));
              return;
            }
            printHandoverForm(formState, formState.printType, formState.printPortInput);
          }}
        />

        {/* Main Layout: Unified List Panel + Temp Panel (on demand) */}
        <div className="main-layout">

          {/* Combined card: unified list and detail in one table */}
          <div className="combined-wrapper">
            <div className="list-section">
              <ReeferListPanel
                containers={formState.containers}
                selectedContainerId={formState.selectedContainerId}
                dischargedCount={dischargedCount}
                duplicateCount={duplicateConflicts.length}
                onOpenDuplicateModal={() => setIsDuplicateOpen(true)}
                onSelectContainer={handleSelectContainer}
                onAddContainer={handleAddContainer}
                onDeleteContainer={handleDeleteContainer}
                onUpdateContainer={handleUpdateContainer}
                onOpenImport={() => setIsImportOpen(true)}
                showTempContainerId={showTempPanel ? tempContainerId : null}
                onShowTemp={(id) => {
                  if (showTempPanel && tempContainerId === id) {
                    setShowTempPanel(false);
                    setTempContainerId(null);
                  } else {
                    handleSelectContainer(id);
                    setTempContainerId(id);
                    setShowTempPanel(true);
                  }
                }}
              />
            </div>
          </div>

          {/* Temp panel: only shows when thermometer icon clicked on a row */}
          {showTempPanel && selectedContainer && (
            <div className="temp-section">
              <TempRecordingPanel
                selectedContainer={formState.containers.find(c => c.id === tempContainerId) || selectedContainer}
                onAddTempRecord={handleAddTempRecord}
                onDeleteTempRecord={handleDeleteTempRecord}
                onUpdateTempRecord={handleUpdateTempRecord}
                onAutoGenerateTemp={handleAutoGenerateTemp}
                onAutoGenerateAllTemp={handleAutoGenerateAllTemp}
                onClose={() => {
                  setShowTempPanel(false);
                  setTempContainerId(null);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onConfirm={handleConfirmReset}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportContainers={handleImportContainers}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        formState={formState}
      />

      {/* Duplicate Location Alert Modal */}
      <DuplicateLocationModal
        isOpen={isDuplicateOpen}
        onClose={() => setIsDuplicateOpen(false)}
        duplicates={duplicateConflicts}
      />
    </div>
  );
};
