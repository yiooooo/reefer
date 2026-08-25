import React from 'react';
import { Outlet } from 'react-router-dom';

/** 登入頁的外殼：全屏深色漸層背景，內容置中 */
export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 flex items-center justify-center p-4 sm:p-6">
      <Outlet />
    </div>
  );
};
