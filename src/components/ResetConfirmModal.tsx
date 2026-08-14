import React from 'react';
import { AlertTriangle, X, RotateCcw } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} color="#dc2626" />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700 }}>重置表單確認</span>
          </div>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: '12px' }}>
          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
            您確定要重置冷櫃獎金申請單嗎？此操作將會清空目前所有已輸入的航次、櫃號與每日巡櫃記錄，且無法復原。
          </p>
        </div>

        <div className="modal-footer" style={{ background: '#ffffff', borderTop: 'none' }}>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn"
            style={{
              background: '#dc2626',
              borderColor: '#dc2626',
              color: '#ffffff',
            }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <RotateCcw size={14} />
            確定清空重置
          </button>
        </div>
      </div>
    </div>
  );
};
