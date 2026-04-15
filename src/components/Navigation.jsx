import React from 'react';
import { NavLink } from 'react-router-dom';
import { Briefcase, MessageSquare, Bell, Calendar, BarChart3, MapPin, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import useT from '../i18n/useT';

const Navigation = () => {
  const { isAdmin, isCEO, canAccessPage } = useAppContext();
  const t = useT();

  const navLinks = [];

  if (canAccessPage?.('tasks')) {
    navLinks.push({ to: '/tasks', icon: <Briefcase size={18}/>, label: t('tasks') });
  }

  if (canAccessPage?.('planner')) {
    navLinks.push({ to: '/weekly-plan', icon: <Calendar size={18}/>, label: t('planner') });
  }

  if (isAdmin && canAccessPage?.('efficiency')) {
    navLinks.push({ to: '/efficiency',  icon: <BarChart3 size={18}/>, label: t('efficiency') });
  }

  if (canAccessPage?.('chat')) navLinks.push({ to: '/chat', icon: <MessageSquare size={18}/>, label: t('chat') });
  // Alerts are base for all users
  navLinks.push({ to: '/alerts', icon: <Bell size={18}/>, label: t('alerts') });
  if (canAccessPage?.('ai')) navLinks.push({ to: '/ai', icon: <Sparkles size={18}/>, label: t('ai') });

  if (isCEO && canAccessPage?.('live-map')) {
    navLinks.push({ to: '/live-map', icon: <MapPin size={18}/>, label: t('liveMap') });
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-2 md:px-8 flex justify-around md:justify-center md:gap-6 items-center z-[60] shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"
      style={{
        paddingLeft: 'var(--app-safe-left)',
        paddingRight: 'var(--app-safe-right)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingTop: '0.4rem',
        minHeight: '48px'
      }}
    >
      {navLinks.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 transition-all ${isActive ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-indigo-400'}`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-indigo-50' : ''}`}>{tab.icon}</div>
              <span className="text-[7px] font-black uppercase tracking-widest leading-none">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default Navigation;
