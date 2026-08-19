import React from 'react';
import { AlertTriangle, X, MapPin } from 'lucide-react';
import { ReeferContainer } from '../types/reefer';

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
        containerNumber: cnt.containerNumber.trim() || `(未填櫃號 #${idx + 1})`,
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
  if (!isOpen || duplicates.length === 0) return null;

  return (
    <div className="modal-overlay z-1100" onClick={onClose}>
      <div
        className="modal-card border border-amber-300 shadow-2xl max-w-580px w-[92%]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header border-b border-amber-200 bg-amber-50/90 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-base font-bold text-amber-900">
                裝載位置重複提醒
              </div>
              <div className="text-xs font-medium text-amber-700">
                偵測到 {duplicates.length} 組裝載位置發生衝突
              </div>
            </div>
          </div>
          <button
            type="button"
            className="text-amber-800 hover:text-amber-950 p-1.5 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer border-0 bg-transparent"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body max-h-[65vh] overflow-y-auto p-5 flex flex-col gap-4">
          <div className="text-slate-600 leading-relaxed">
            同一個裝載位置不應同時有多個未卸櫃貨櫃。請核對以下重複位置與對應櫃號：
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
                      裝載位置：<span className="font-mono text-sm font-bold bg-amber-100 text-amber-950 px-2.5 py-1 rounded-md border border-amber-300 ml-1">{dup.location}</span>
                    </span>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                    共 {dup.containers.length} 筆重複
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {dup.containers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white border border-amber-200/80 rounded-lg px-3.5 py-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-400 text-xs min-w-6">
                          #{c.index}
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                          {c.containerNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span>裝港: <strong className="text-sky-600 font-bold">{c.loadingPort || '-'}</strong></span>
                        <span>卸港: <strong className="text-emerald-600 font-bold">{c.dischargePort || '-'}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex justify-end">
          <button
            type="button"
            className="btn bg-amber-600 border-amber-600 hover:bg-amber-700 hover:border-amber-700 text-white min-w-110px h-9 text-xs font-bold"
            onClick={onClose}
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
