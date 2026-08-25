import React from 'react';
import { UserCircle, Mail, Shield, Monitor, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export const AccountPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const loginDevices = [
    {
      device: t('account.currentDevice'),
      browser: t('account.browserType'),
      time: t('account.onlineStatus'),
      isCurrent: true,
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* 標題區 */}
      <div className="flex flex-col items-center text-center space-y-2 py-4">
        <div className="w-16 h-16 rounded-full bg-sky-50 border-2 border-sky-100 flex items-center justify-center text-sky-600 shadow-sm">
          <UserCircle className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('account.title')}</h1>
        <p className="text-sm text-slate-500 max-w-sm">{t('account.subtitle')}</p>
      </div>

      {/* 帳號詳情卡片 */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-600" />
            {t('account.detailsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-slate-400" /> {t('account.displayName')}
            </span>
            <span className="text-sm font-semibold text-slate-800">{user?.displayName ?? '—'}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" /> {t('account.email')}
            </span>
            <span className="text-sm font-mono font-medium text-slate-800">{user?.email ?? '—'}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" /> {t('account.role')}
            </span>
            <Badge variant={user?.role === 'admin' ? 'indigo' : 'sky'}>
              {user?.role === 'admin' ? t('account.adminRole') : t('account.crewRole')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 登入裝置卡片 */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-sky-600" />
            {t('account.devicesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="space-y-2">
            {loginDevices.map((d) => (
              <div
                key={d.device}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{d.device}</span>
                      {d.isCurrent && (
                        <Badge variant="success" className="text-[10px] px-2 py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> {t('account.inUseBadge')}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{d.browser}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{d.time}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 italic pt-1 text-center">
            {t('account.auditNotice')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
