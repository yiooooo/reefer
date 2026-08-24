import React from 'react';
import { RotateCcw, Upload, Download, Ship } from 'lucide-react';
import { VESSEL_LIST } from '../data/vessels';
import { Button } from './ui/button';

interface HeaderProps {
  vesselName: string;
  onUpdateVessel?: (vesselName: string, imo?: string) => void;
  onReset: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  vesselName,
  onUpdateVessel,
  onReset,
  onOpenImport,
  onOpenExport,
}) => {
  const currentVsl = vesselName || '';
  const hasCurrentInList = Boolean(currentVsl && VESSEL_LIST.some((v) => v.VSL_NAME === currentVsl));

  const handleVesselChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const item = VESSEL_LIST.find((v) => v.VSL_NAME === selectedName);
    onUpdateVessel?.(selectedName, item?.IMO_NO || '');
  };

  return (
    <header className="app-header">
      <div className="brand-title">
        <span className="system-name">FLEET FORMs SYSTEM</span>
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-sky-400/50 rounded-full text-xs sm:text-sm font-semibold text-sky-400 backdrop-blur-xs transition-all cursor-pointer hover:shadow-xs"
          title="點擊切換船名"
        >
          <Ship className="w-3.5 h-3.5 shrink-0 text-sky-400" />
          <select
            className="bg-transparent border-none text-sky-400 font-semibold text-xs sm:text-sm cursor-pointer outline-hidden appearance-none p-0 m-0"
            value={currentVsl}
            onChange={handleVesselChange}
            aria-label="選擇船名"
          >
            <option value="" className="bg-slate-900 text-slate-400 py-1 px-2">
              選擇船名
            </option>
            {currentVsl && !hasCurrentInList && (
              <option value={currentVsl} className="bg-slate-900 text-slate-100 py-1 px-2">
                {currentVsl}
              </option>
            )}
            {VESSEL_LIST.map((v) => (
              <option key={v.VSL_NAME} value={v.VSL_NAME} className="bg-slate-900 text-slate-100 py-1 px-2">
                {v.VSL_NAME}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="header-actions">
        <Button variant="ghost" size="sm" onClick={onReset}
          className="text-slate-200 hover:text-white hover:bg-white/15 border border-white/15 hover:border-white/30 h-8">
          <RotateCcw size={14} />
          重置 (Reset)
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenImport}
          className="border-sky-400/60 text-sky-400 bg-transparent hover:bg-sky-400/15 hover:text-sky-300 hover:border-sky-400 h-8">
          <Upload size={14} />
          匯入 (Import)
        </Button>
        <Button size="sm" onClick={onOpenExport} className="h-8">
          <Download size={14} />
          匯出 XML (Export)
        </Button>
      </div>
    </header>
  );
};
