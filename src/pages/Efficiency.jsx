import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import {
  TrendingUp, CheckCircle2, Clock, AlertCircle,
  Star, Zap, Users, Award, BarChart3
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import useT from '../i18n/useT';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-3 text-[11px]">
        <p className="font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
            <span className="font-bold text-slate-600 capitalize">{p.name}:</span>
            <span className="font-black text-slate-800">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getPerfBadge = (pct) => {
  if (pct >= 90) return { key: 'perfExcellent', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (pct >= 70) return { key: 'perfGood', color: 'text-indigo-600', bg: 'bg-indigo-50' };
  if (pct >= 50) return { key: 'perfAverage', color: 'text-amber-600', bg: 'bg-amber-50' };
  return { key: 'perfNeedsWork', color: 'text-red-600', bg: 'bg-red-50' };
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Efficiency = () => {
  const { tasks, users, currentUser, isAdmin, lang } = useAppContext();
  const t = useT();

  // ── Per-user stats ──────────────────────────────────────────────────────────
  const userStats = useMemo(() => {
    return users.map(u => {
      const assigned = tasks.filter(t => t.employeeId === u.id);
      const completed = assigned.filter(t => t.status === 'completed');
      const inProgress = assigned.filter(t => t.status === 'in progress');
      const pending = assigned.filter(t => t.status === 'pending');
      const overdue = assigned.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        return new Date(t.dueDate) < new Date();
      });
      const onTime = completed.filter(t => {
        if (!t.dueDate || !t.completedAt) return false;
        const due = new Date(t.dueDate).getTime();
        const done = t.completedAt?.toMillis ? t.completedAt.toMillis() : Date.now();
        return done <= due;
      });
      const late = completed.filter(t => {
        if (!t.dueDate || !t.completedAt) return false;
        const due = new Date(t.dueDate).getTime();
        const done = t.completedAt?.toMillis ? t.completedAt.toMillis() : Date.now();
        return done > due;
      });

      const pct = assigned.length === 0 ? 0 : Math.round((completed.length / assigned.length) * 100);
      const badge = getPerfBadge(pct);

      return {
        ...u,
        assigned: assigned.length,
        completed: completed.length,
        inProgress: inProgress.length,
        pending: pending.length,
        overdue: overdue.length,
        onTime: onTime.length,
        late: late.length,
        pct,
        badge,
      };
    }).sort((a, b) => b.pct - a.pct);
  }, [users, tasks]);

  // ── Company-wide task overview ──────────────────────────────────────────────
  const globalStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const overdue = tasks.filter(t => {
      if (!t.dueDate || t.status === 'completed') return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    const bonus = tasks.filter(t => t.taskType === 'bonus').length;
    const high = tasks.filter(t => t.priority === 'High').length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, inProgress, pending, overdue, bonus, high, pct };
  }, [tasks]);

  // ── Trend chart (last 7 days — tasks due each day) ─────────────────────────
  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    return days.map(day => {
      const dayStr = day.toDateString();
      const dayTasks = tasks.filter(t => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        if (!due) return false;
        due.setHours(0, 0, 0, 0);
        return due.toDateString() === dayStr;
      });
      return {
        name: day.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short' }),
        Completed: dayTasks.filter(t => t.status === 'completed').length,
        Pending: dayTasks.filter(t => t.status !== 'completed').length,
      };
    });
  }, [tasks, lang]);

  // ── Visible user (non-admin sees only their own) ────────────────────────────
  const myStats = userStats.find(u => u.id === currentUser.id);
  const displayStats = isAdmin ? userStats : (myStats ? [myStats] : []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* Page Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="bg-indigo-600 p-2.5 rounded-[1.25rem] shadow-lg shadow-indigo-200">
          <TrendingUp className="text-white" size={22} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 leading-tight">{t('efficiencyReport')}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {isAdmin ? t('companyWideAnalytics') : `${t('personalDashboard')} — ${currentUser.username}`}
          </p>
        </div>
      </div>

      {/* Global KPI Cards (Admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <BarChart3 size={18}/>, label: t('totalTasks'), val: globalStats.total, color: 'bg-slate-50 text-slate-500' },
            { icon: <CheckCircle2 size={18}/>, label: t('completed'), val: globalStats.completed, color: 'bg-emerald-50 text-emerald-500' },
            { icon: <AlertCircle size={18}/>, label: t('overdue'), val: globalStats.overdue, color: 'bg-red-50 text-red-500' },
            { icon: <Zap size={18}/>, label: t('efficiency'), val: `${globalStats.pct}%`, color: 'bg-indigo-50 text-indigo-600' },
          ].map(card => (
            <div key={card.label} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-2">
              <div className={`p-2.5 rounded-2xl ${card.color}`}>{card.icon}</div>
              <p className="text-2xl font-black text-slate-800">{card.val}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* My Personal Card (non-admin) */}
      {!isAdmin && myStats && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-black text-slate-800 text-lg">{myStats.username}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{myStats.role}</p>
            </div>
            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full ${myStats.badge.bg} ${myStats.badge.color} uppercase tracking-widest`}>
              {t(myStats.badge.key)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-2xl font-black text-slate-800">{myStats.assigned}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('assigned')}</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-500">{myStats.completed}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('done')}</p>
            </div>
            <div>
              <p className="text-2xl font-black text-indigo-600">{myStats.pct}%</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('score')}</p>
            </div>
          </div>
          <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${myStats.pct}%` }}/>
          </div>
        </div>
      )}

      {/* 7-Day Trend Chart */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-black text-slate-800">{t('sevenDayTrend')}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('tasksDueEachDay')}</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"/><span className="text-[9px] font-black text-slate-400 uppercase">{t('done')}</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-200"/><span className="text-[9px] font-black text-slate-400 uppercase">{t('open')}</span></div>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3"/>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} dy={8}/>
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="Completed" stroke="#34d399" strokeWidth={2.5} fill="url(#gCompleted)"/>
              <Area type="monotone" dataKey="Pending" stroke="#818cf8" strokeWidth={2.5} fill="url(#gPending)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-User Efficiency Leaderboard */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Award className="text-indigo-500" size={18}/>
          <h3 className="font-black text-slate-800">{isAdmin ? t('teamLeaderboard') : t('myPerformance')}</h3>
        </div>

        <div className="space-y-4">
          {displayStats.map((u, rank) => (
            <div key={u.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50/50 transition-colors">
              
              {/* Rank */}
              {isAdmin && (
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  rank === 0 ? 'bg-amber-400 text-white shadow-amber-200 shadow-md' :
                  rank === 1 ? 'bg-slate-300 text-white' :
                  rank === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400 border border-slate-200'
                }`}>
                  {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}
                </div>
              )}

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-black flex items-center justify-center text-sm shrink-0">
                {u.username.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-black text-slate-800 truncate text-sm">{u.username}</p>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${u.badge.bg} ${u.badge.color}`}>
                    {t(u.badge.key)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      u.pct >= 70 ? 'bg-emerald-400' : u.pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${u.pct}%` }}
                  />
                </div>
                {/* Mini stats */}
                <div className="flex gap-3 mt-1.5">
                  <span className="text-[9px] font-bold text-slate-400">{u.completed}/{u.assigned} {t('done')}</span>
                  {u.overdue > 0 && <span className="text-[9px] font-black text-red-400">⚠ {u.overdue} {t('overdue')}</span>}
                  {u.onTime > 0  && <span className="text-[9px] font-black text-emerald-500">✓ {u.onTime} {t('onTime')}</span>}
                  {u.late > 0    && <span className="text-[9px] font-black text-amber-500">↓ {u.late} {t('late')}</span>}
                </div>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <p className={`text-xl font-black ${u.pct >= 70 ? 'text-emerald-500' : u.pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{u.pct}%</p>
              </div>
            </div>
          ))}

          {displayStats.length === 0 && (
            <div className="text-center py-8 text-slate-400 font-bold">{t('noDataYet')}</div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Efficiency;
