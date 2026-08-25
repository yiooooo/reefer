import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** 若設定，只有該角色可進入；其他人看到 403 */
  requireRole?: 'admin' | 'crew';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireRole }) => {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // 初始化讀取 localStorage session 時顯示空白（避免閃爍跳轉）
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          <span className="text-xs font-semibold">{t('auth.loading')}</span>
        </div>
      </div>
    );
  }

  // 未登入 → 跳轉到 /login，並記住原本想去的頁面
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 角色不符 → 403
  if (requireRole && user.role !== requireRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">{t('auth.forbiddenTitle')}</h1>
          <p className="text-xs text-slate-500">{t('auth.forbiddenDesc')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
