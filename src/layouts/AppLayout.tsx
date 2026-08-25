import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

/**
 * /app/* 路由的外殼：
 * - Header 由各頁面自行渲染（保留原有設計，不全局重複）
 * - Sidebar 固定在左側，可收合
 * - 右側 main 顯示 <Outlet />（子頁面）
 */
export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};
