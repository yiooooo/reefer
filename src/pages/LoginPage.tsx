import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Ship, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 已登入 → 直接跳轉
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app/reefer-bonus';
  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email.trim(), password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error ? t('login.invalidCredentials') : t('login.loginFailed'));
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 relative">
      {/* Top right language switcher */}
      <div className="flex justify-end mb-3">
        <LanguageSwitcher />
      </div>

      <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md">
        <CardHeader className="flex flex-col items-center text-center pb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30 mb-3">
            <Ship className="w-7 h-7" />
          </div>
          <CardTitle className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
            Vessel Management System
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            船舶管理系統
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-semibold text-slate-300">
                {t('login.emailLabel')}
              </Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-500 focus-visible:ring-sky-500/20 h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-semibold text-slate-300">
                {t('login.passwordLabel')}
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-500 focus-visible:ring-sky-500/20 h-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 hover:bg-transparent cursor-pointer"
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium" role="alert">
                {error}
              </div>
            )}

            <Button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full h-10 font-bold bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white shadow-md shadow-sky-600/30 transition-all cursor-pointer mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-1.5" />
              )}
              {isLoading ? t('login.loggingInBtn') : t('login.loginBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
