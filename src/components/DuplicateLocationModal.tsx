import React from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { ReeferContainer } from '../types/reefer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { useTranslation } from '../i18n/LanguageContext';

export interface DuplicateLocationConflict {
  location: string;
  containers: {
    id: string;
    containerNumber: string;
    index: number;
    loadingPort?: string;
    dischargePort?: string;
  }[];
}

/**
 * 檢查冷櫃清單中是否有重複的裝載位置
 * （若已填寫卸船日期時間，表示已卸櫃 / 空櫃，不納入裝載位置重複檢查）
 */
export function findDuplicateLocations(containers: ReeferContainer[]): DuplicateLocationConflict[] {
  const map = new Map<string, { id: string; containerNumber: string; index: number; loadingPort?: string; dischargePort?: string }[]>();

  containers.forEach((cnt, idx) => {
    // 1. 忽略已被隱藏的貨櫃
    if (cnt.isHidden) return;

    // 2. 若有填寫卸船日期時間，表示已卸櫃 / 空櫃，忽略不計入裝載位置衝突檢查
    const dischDt = cnt.dischargeDatetime ? cnt.dischargeDatetime.trim() : '';
    if (dischDt && dischDt.toLowerCase() !== 'null' && dischDt !== '--') {
      return;
    }

    const loc = cnt.loadingLocation ? cnt.loadingLocation.trim().toUpperCase() : '';
    if (loc) {
      if (!map.has(loc)) {
        map.set(loc, []);
      }
      map.get(loc)!.push({
        id: cnt.id,
        containerNumber: cnt.containerNumber.trim(),
        index: idx + 1,
        loadingPort: cnt.loadingPort,
        dischargePort: cnt.dischargePort,
      });
    }
  });

  const duplicates: DuplicateLocationConflict[] = [];
  map.forEach((list, loc) => {
    if (list.length > 1) {
      duplicates.push({
        location: loc,
        containers: list,
      });
    }
  });

  return duplicates;
}

interface DuplicateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateLocationConflict[];
}

export const DuplicateLocationModal: React.FC<DuplicateLocationModalProps> = ({
  isOpen,
  onClose,
  duplicates,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen && duplicates.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-115 w-[92%] border-amber-300" showCloseButton={false}>
        <DialogHeader className="border-b border-amber-200 bg-amber-50/90 rounded-t-xl px-5 py-4 gap-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="text-amber-900">{t('duplicateModal.title')}</DialogTitle>
                <div className="text-xs font-medium text-amber-700">
                  {duplicates.length} {t('duplicateModal.totalSlots')}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-amber-800 hover:text-amber-950 hover:bg-amber-100"
              onClick={onClose}
            >
              ✕
            </Button>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
          <div className="text-sm text-slate-600 leading-relaxed">
            {t('duplicateModal.warningDesc')}
          </div>

          <div className="flex flex-col gap-4">
            {duplicates.map((dup) => (
              <div
                key={dup.location}
                className="border border-amber-300 rounded-xl bg-amber-50/50 p-4 flex flex-col gap-3 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/80">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold text-amber-950 text-sm">
                      {t('duplicateModal.location')}：<span className="font-mono text-sm font-bold bg-amber-100 text-amber-950 px-2.5 py-1 rounded-md border border-amber-300 ml-1">{dup.location}</span>
                    </span>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                    {dup.containers.length} {t('duplicateModal.totalSlots')}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {dup.containers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white border border-amber-200/80 rounded-lg px-3.5 py-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-400 text-xs min-w-6">#{c.index}</span>
                        <span className="font-mono font-bold text-slate-900 text-sm tracking-wide">{c.containerNumber || '--'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span>{t('table.loadingPort')}: <strong className="text-sky-600 font-bold">{c.loadingPort || '-'}</strong></span>
                        <span>{t('table.dischargePort')}: <strong className="text-emerald-600 font-bold">{c.dischargePort || '-'}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="bg-slate-50 border-t border-slate-200">
          <Button
            className="bg-amber-600 hover:bg-amber-700 border-amber-600 min-w-[100px]"
            onClick={onClose}
          >
            {t('duplicateModal.closeBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
