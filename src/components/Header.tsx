import React from 'react';
import { RotateCcw, Upload, Download, Ship } from 'lucide-react';

interface HeaderProps {
  vesselName: string;
  onReset: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  vesselName,
  onReset,
  onOpenImport,
  onOpenExport,
}) => {
  return (
    <header className="app-header">
      <div className="brand-title">
        <span className="system-name">FLEET FORMs SYSTEM</span>
        <div className="vessel-tag">
          <Ship size={15} />
          <span>{vesselName || 'YM IMMENSE 雲明'}</span>
        </div>
      </div>

      <div className="header-actions">
        <button className="hdr-btn hdr-btn-ghost" onClick={onReset}>
          <RotateCcw size={15} />
          重置 (Reset)
        </button>
        <button className="hdr-btn hdr-btn-outline" onClick={onOpenImport}>
          <Upload size={15} />
          匯入 (Import)
        </button>
        <button className="hdr-btn hdr-btn-primary" onClick={onOpenExport}>
          <Download size={15} />
          匯出 XML (Export)
        </button>
      </div>
    </header>
  );
};
