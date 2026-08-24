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
import { useTranslation } from '../i18n/LanguageContext';

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
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-110" showCloseButton={false}>
        <DialogHeader className="border-b-0 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <DialogTitle className="text-base font-bold text-red-600">{t('resetModal.title')}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          <p className="text-sm text-slate-500 leading-relaxed">
            {t('resetModal.desc')}
          </p>
        </div>

        <DialogFooter className="border-t-0 bg-white">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <RotateCcw size={14} />
            {t('resetModal.confirmBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
