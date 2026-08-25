import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '../i18n/LanguageContext';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
        <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400">
          <Anchor className="w-10 h-10" />
        </div>
        <div className="space-y-1">
          <div className="text-6xl font-black text-slate-300 tracking-tighter leading-none">
            404
          </div>
          <h1 className="text-lg font-bold text-slate-800">{t('notFound.title')}</h1>
          <p className="text-xs text-slate-500">
            {t('notFound.desc')}
          </p>
        </div>
        <Button
          onClick={() => navigate('/app/reefer-bonus', { replace: true })}
          className="cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {t('notFound.backBtn')}
        </Button>
      </div>
    </div>
  );
};
