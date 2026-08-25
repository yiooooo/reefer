import React from 'react';
import { ShieldCheck, Users, Settings, BarChart3, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '../i18n/LanguageContext';

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();

  const adminModules = [
    {
      icon: <Users className="w-5 h-5 text-sky-500" />,
      title: t('admin.userPermTitle'),
      desc: t('admin.userPermDesc'),
      badge: t('admin.comingSoon'),
      badgeVariant: 'sky' as const,
    },
    {
      icon: <Settings className="w-5 h-5 text-indigo-500" />,
      title: t('admin.sysSettingsTitle'),
      desc: t('admin.sysSettingsDesc'),
      badge: t('admin.comingSoon'),
      badgeVariant: 'indigo' as const,
    },
    {
      icon: <BarChart3 className="w-5 h-5 text-emerald-500" />,
      title: t('admin.reportsTitle'),
      desc: t('admin.reportsDesc'),
      badge: t('admin.comingSoon'),
      badgeVariant: 'success' as const,
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* 標題區 */}
      <div className="flex flex-col items-center text-center space-y-2 py-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-50 to-indigo-50 border-2 border-sky-100 flex items-center justify-center text-sky-600 shadow-sm">
          <ShieldCheck className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('admin.title')}</h1>
        <p className="text-sm text-slate-500 max-w-md">
          {t('admin.desc')}
        </p>
      </div>

      {/* 模組清單 */}
      <div className="space-y-3">
        {adminModules.map((m) => (
          <Card
            key={m.title}
            className="bg-white border-slate-200 hover:border-slate-300 transition-all shadow-xs py-4"
          >
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
                  {m.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-800 truncate">{m.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={m.badgeVariant} className="text-[11px]">
                  {m.badge}
                </Badge>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
