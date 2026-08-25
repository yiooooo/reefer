import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Thermometer,
  ShieldCheck,
  UserCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    {
      to: '/app/reefer-bonus',
      icon: <Thermometer className="w-4 h-4 shrink-0" />,
      label: t('nav.reeferBonus'),
      show: true,
    },
    {
      to: '/app/admin',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
      label: t('nav.admin'),
      show: isAdmin,
    },
    {
      to: '/app/account',
      icon: <UserCircle className="w-4 h-4 shrink-0" />,
      label: t('nav.account'),
      show: true,
    },
  ];

  const visibleItems = navItems.filter((item) => item.show);

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen flex flex-col justify-between bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-200 ease-in-out shrink-0 z-40 select-none",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Top / Nav items */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header with Clear Collapse/Expand Button */}
        <div
          className={cn(
            "flex items-center h-12 border-b border-slate-800/80 px-3",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed && (
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 pl-1">
              {t('nav.menu')}
            </span>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "flex items-center justify-center rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-all cursor-pointer",
              collapsed ? "w-10 h-10 bg-slate-800/50 border-slate-700/60 text-sky-400" : "w-8 h-8"
            )}
            aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation items */}
        <div className="p-2.5">
          <nav className="flex flex-col gap-1">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-sky-500/15 text-sky-400 border border-sky-500/20 shadow-xs"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-transparent"
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom: user info + logout */}
      <div className="p-3 border-t border-slate-800/80 flex flex-col gap-2">
        {!collapsed && user && (
          <div className="px-2 py-1 flex flex-col">
            <span className="text-xs font-bold text-slate-200 truncate">
              {user.displayName}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {user.role === 'admin' ? t('nav.adminRole') : t('nav.crewRole')}
            </span>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer w-full",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? t('nav.logout') : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{t('nav.logout')}</span>}
        </button>
      </div>
    </aside>
  );
};
