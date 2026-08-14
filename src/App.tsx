import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { BasicInfoCard } from './components/BasicInfoCard';
import { ReeferListPanel } from './components/ReeferListPanel';
import { ReeferDetailPanel } from './components/ReeferDetailPanel';
import { TempRecordingPanel } from './components/TempRecordingPanel';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { getInitialState } from './utils/initialData';
import { ReeferContainer, ReeferFormState, TempRecord } from './types/reefer';
import { generateAutoTempRecords } from './utils/tempGenerator';
import { CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [formState, setFormState] = useState<ReeferFormState>(getInitialState);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [showTempPanel, setShowTempPanel] = useState(false);
  const [tempContainerId, setTempContainerId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const handlePrintPortInputChange = (printPortInput: string) => {
    setFormState((prev) => ({ ...prev, printPortInput }));
  };

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
          tempRecords: [
            {
              id: `tr-${Date.now()}-${i}`,
              dateLog: new Date().toISOString().split('T')[0],
              df1: '',
              df2: '',
              df3: '',
              remark: '',
            },
          ],
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

    showToast(`成功新增 ${count} 筆冷櫃`);
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
    showToast('已刪除選取冷櫃');
  };


  const handleUpdateContainer = (id: string, field: keyof ReeferContainer, value: any) => {
    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }));
  };



  // 巡溫紀錄維護處置器
  const handleAddTempRecord = (containerId: string, count: number = 1) => {
    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((c) => {
        if (c.id === containerId) {
          const newRecords: TempRecord[] = [...c.tempRecords];
          let baseDate = new Date();
          if (newRecords.length > 0) {
            const lastDate = new Date(newRecords[newRecords.length - 1].dateLog);
            if (!isNaN(lastDate.getTime())) baseDate = lastDate;
          }

          for (let i = 0; i < count; i++) {
            const nextDate = new Date(baseDate);
            nextDate.setDate(baseDate.getDate() + 1 + i);
            const dateStr = nextDate.toISOString().split('T')[0];

            newRecords.push({
              id: `tr-${Date.now()}-${i}`,
              dateLog: dateStr,
              df1: '',
              df2: '',
              df3: '',
              remark: '',
            });
          }

          const days = newRecords.length;
          const cash = days >= 10 ? 800 : 400;

          return {
            ...c,
            tempRecords: newRecords,
            days,
            cash,
          };
        }
        return c;
      }),
    }));
  };

  const handleDeleteTempRecord = (containerId: string, recordId: string) => {
    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((c) => {
        if (c.id === containerId) {
          const updatedRecords = c.tempRecords.filter((r) => r.id !== recordId);
          const days = updatedRecords.length;
          const cash = days >= 10 ? 800 : 400;
          return {
            ...c,
            tempRecords: updatedRecords,
            days,
            cash,
          };
        }
        return c;
      }),
    }));
  };

  const handleUpdateTempRecord = (
    containerId: string,
    recordId: string,
    field: keyof TempRecord,
    value: any
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

  // 自動生成巡溫紀錄處置器
  const handleAutoGenerateTemp = (containerId: string) => {
    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((c) => {
        if (c.id === containerId) {
          if (!c.dischargeDatetime) return c; // 若無卸船日期則不處理
          const autoRecords = generateAutoTempRecords(
            c.settingTemp,
            c.loadingDatetime,
            c.dischargeDatetime
          );
          const days = autoRecords.length;
          const cash = days >= 10 ? 800 : 400;

          return {
            ...c,
            tempRecords: autoRecords,
            days,
            cash,
          };
        }
        return c;
      }),
    }));

    showToast('已完成巡溫紀錄自動生成 (±0.5°C 且已依裝卸時間切割)！');
  };

  const handleAutoGenerateAllTemp = () => {
    const targetContainers = formState.containers.filter(
      (c) => !!c.dischargeDatetime && generateAutoTempRecords(c.settingTemp, c.loadingDatetime, c.dischargeDatetime).length > 0
    );

    if (targetContainers.length === 0) {
      showToast('沒有符合條件的冷櫃（需填寫卸船日期時間）');
      return;
    }

    const targetIds = new Set(targetContainers.map((c) => c.id));

    setFormState((prev) => ({
      ...prev,
      containers: prev.containers.map((c) => {
        if (!targetIds.has(c.id)) return c;
        const autoRecords = generateAutoTempRecords(
          c.settingTemp,
          c.loadingDatetime,
          c.dischargeDatetime
        );
        const days = autoRecords.length;
        const cash = days >= 10 ? 800 : 400;
        return {
          ...c,
          tempRecords: autoRecords,
          days,
          cash,
        };
      }),
    }));

    showToast(`已對 ${targetContainers.length} 筆冷櫃完成巡溫紀錄自動生成！`);
  };


  // XML 與 TXT 檔案匯入處置器
  const handleImportContainers = (
    importedData: Partial<ReeferContainer>[],
    metaData?: { voyage?: string; vesselName?: string },
    options: { duplicateMode?: 'allow_duplicate' | 'update_existing' | 'skip_existing' } = {}
  ) => {
    const { duplicateMode = 'allow_duplicate' } = options;

    let addedCount = 0;
    let updatedCount = 0;
    let finalTotalCount = 0;

    setFormState((prev) => {
      const newContainers: ReeferContainer[] = importedData.map((item, index) => {
        const newId = `imported-${Date.now()}-${index}`;
        return {
          id: newId,
          containerNumber: item.containerNumber || '',
          settingTemp: item.settingTemp || '',
          commodity: item.commodity || '',
          loadingLocation: item.loadingLocation || '',
          loadingPort: item.loadingPort || '',
          loadingDatetime: item.loadingDatetime || '',
          loadingTemp: item.loadingTemp || '',
          dischargePort: item.dischargePort || '',
          dischargeDatetime: item.dischargeDatetime || '',
          dischargeTemp: item.dischargeTemp || '',
          remark1: item.remark1 || '',
          days: item.days || (item.tempRecords ? item.tempRecords.length : 1),
          cash: item.cash || 400,
          isHidden: false,
          tempRecords:
            item.tempRecords && item.tempRecords.length > 0
              ? item.tempRecords
              : [
                  {
                    id: `tr-${newId}-1`,
                    dateLog: new Date().toISOString().split('T')[0],
                    df1: '',
                    df2: '',
                    df3: '',
                    remark: '',
                  },
                ],
          crewRecords:
            item.crewRecords && item.crewRecords.length > 0
              ? item.crewRecords
              : [
                  { id: `cr-${newId}-1`, role: 'C/O' },
                  { id: `cr-${newId}-2`, role: '2/O' },
                  { id: `cr-${newId}-3`, role: '3/O' },
                  { id: `cr-${newId}-4`, role: '3/E' },
                ],
        };
      });

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
              resultList[existingIdx] = {
                ...resultList[existingIdx],
                ...newCnt,
                id: resultList[existingIdx].id,
              };
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

      const nextSelectedId =
        updatedList.length > 0 ? updatedList[updatedList.length - 1].id : null;

      return {
        ...prev,
        voyage: metaData?.voyage || prev.voyage,
        vesselName: metaData?.vesselName || prev.vesselName,
        containers: updatedList,
        selectedContainerId: nextSelectedId,
      };
    });

    if (duplicateMode === 'update_existing' && updatedCount > 0) {
      showToast(`已累計匯入：新增 ${addedCount} 筆，更新 ${updatedCount} 筆（現有總計 ${finalTotalCount} 筆）`);
    } else {
      showToast(`已累計匯入 ${addedCount} 筆冷櫃資料（現有總計 ${finalTotalCount} 筆）！`);
    }
  };

  const handleConfirmReset = () => {
    setFormState(getInitialState());
    showToast('表單已重置為空值狀態');
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            background: '#ffffff',
            border: '1px solid #38bdf8',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 2000,
            fontSize: '13px',
            fontWeight: 600,
            color: '#0284c7',
          }}
        >
          <CheckCircle2 size={18} color="#0284c7" />
          {toastMessage}
        </div>
      )}

      {/* Top Dark Header */}
      <Header
        vesselName={formState.vesselName}
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
          onVesselStatusChange={handleVesselStatusChange}
          onVoyageChange={handleVoyageChange}
          onPrintTypeChange={handlePrintTypeChange}
          onPrintPortInputChange={handlePrintPortInputChange}
          onPrint={() =>
            showToast(
              `準備列印 ${formState.printType === 'LOADPRINT' ? 'Loading 裝船' : 'Discharge 卸船'} 交接單 (${
                formState.printPortInput || '全部港口'
              })`
            )
          }
        />

        {/* Main Layout: Combined (list+detail) + Temp Panel (on demand) */}
        <div className="main-layout">

          {/* Combined card: list on left, detail on right */}
          <div className="combined-wrapper">
            <div className="list-section">
              <ReeferListPanel
                containers={formState.containers}
                selectedContainerId={formState.selectedContainerId}
                totalCash={totalCash}
                longCount={longCount}
                shortCount={shortCount}
                dischargedCount={dischargedCount}
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

            <div className="detail-section">
              <ReeferDetailPanel
                selectedContainer={selectedContainer}
                onUpdateContainer={handleUpdateContainer}
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
    </div>
  );
};

export default App;
