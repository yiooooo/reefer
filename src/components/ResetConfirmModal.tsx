import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-110" showCloseButton={false}>
        <DialogHeader className="border-b-0 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <DialogTitle className="text-base font-bold text-red-600">重置表單確認</DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          <p className="text-sm text-slate-500 leading-relaxed">
            您確定要重置冷櫃獎金申請單嗎？此操作將會清空目前所有已輸入的航次、櫃號與每日巡櫃記錄，且無法復原。
          </p>
        </div>

        <DialogFooter className="border-t-0 bg-white">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <RotateCcw size={14} />
            確定清空重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
