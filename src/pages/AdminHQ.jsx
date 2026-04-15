import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  FunnelChart, Funnel, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart3, Users, Zap, Briefcase, Sparkles,
  Menu, X, FileDown, ChevronDown, Calendar,
  CheckCircle2, AlertCircle, Clock, Shield, TrendingUp,
  DollarSign, Target, Globe, Layers, PieChart as PieIcon, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import useT from '../i18n/useT';

const STATUS_STYLE = { completed: 'bg-emerald-50 text-emerald-600', 'in progress': 'bg-indigo-50 text-indigo-600', pending: 'bg-amber-50 text-amber-600' };
const PRIORITY_STYLE = { High: 'bg-red-50 text-red-500', Medium: 'bg-amber-50 text-amber-600', Low: 'bg-sky-50 text-sky-500' };
const STAGE_STYLE = { 'Closed Won': 'bg-emerald-50 text-emerald-600', 'Closed Lost': 'bg-red-50 text-red-600', 'Negotiation': 'bg-amber-50 text-amber-600', 'Proposal': 'bg-indigo-50 text-indigo-600', 'Lead': 'bg-slate-50 text-slate-500', 'Qualified': 'bg-sky-50 text-sky-600', 'Contract': 'bg-purple-50 text-purple-600' };

const CHART_COLORS = ['#6366f1', '#34d399', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const getPerfBadge = (pct) => {
  if (pct >= 90) return { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (pct >= 70) return { label: 'Good', color: 'text-indigo-600', bg: 'bg-indigo-50' };
  if (pct >= 50) return { label: 'Average', color: 'text-amber-600', bg: 'bg-amber-50' };
  return { label: 'Needs Work', color: 'text-red-600', bg: 'bg-red-50' };
};

const formatCurrency = (val, cur = 'USD') => {
  if (!val) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);
};

const formatCompact = (val) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val}`;
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-xl border border-slate-100">
      {label && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-black" style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === 'number' && p.value > 999 ? formatCompact(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Radial Gauge Component ─────────────────────────────────────────────────
const RadialGauge = ({ value, max = 100, label, color = '#6366f1', size = 140 }) => {
  const data = [{ name: label, value, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={size} height={size}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={data}>
          <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={10} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center -mt-8">
        <p className="text-2xl font-black text-slate-800">{value}{max === 100 ? '%' : ''}</p>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
      </div>
    </div>
  );
};

// ─── PDF export ──────────────────────────────────────────────────────────────
const exportTableAsPDF = (tasks, users, userStats, opportunities, kpis, options = {}) => {
  const { lang = 'en', t = (x) => x } = options;
  try {
    const isAr = lang === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const locale = isAr ? 'ar-EG' : 'en-GB';

    const statusLabel = (status) => {
      if (status === 'completed') return t('completed');
      if (status === 'in progress') return t('inProgress');
      if (status === 'pending') return t('pending');
      return status || '-';
    };
    const stageLabel = (stage) => {
      const map = {
        'Lead': 'stageLead',
        'Qualified': 'stageQualified',
        'Negotiation': 'stageNegotiation',
        'Proposal': 'stageProposal',
        'Contract': 'stageContract',
        'Closed Won': 'stageClosedWon',
        'Closed Lost': 'stageClosedLost',
      };
      return t(map[stage] || 'stageLead');
    };
    const priorityLabel = (p) => {
      if (p === 'High') return t('high');
      if (p === 'Medium') return t('medium');
      if (p === 'Low') return t('low');
      return p || t('medium');
    };

    const taskRows = tasks.map(t => {
      const u = users.find(u2 => u2.id === t.employeeId);
      return '<tr><td>' + (t.title || '-') + '</td><td>' + (u?.username || t.employee || '-') + '</td><td>' + statusLabel(t.status) + '</td><td>' + priorityLabel(t.priority || 'Medium') + '</td><td>' + (t.sector || '-') + '</td><td>' + (t.dueDate ? new Date(t.dueDate).toLocaleDateString(locale) : '-') + '</td></tr>';
    }).join('');
    const leaderRows = userStats.map((u, i) => '<tr><td>' + (i+1) + '</td><td>' + u.username + '</td><td>' + u.completed + ' / ' + u.assigned + '</td><td>' + u.pct + '%</td><td>' + t(u.badge?.key || 'perfAverage') + '</td></tr>').join('');
    const oppRows = (opportunities || []).map(o => '<tr><td>' + (o.name || o.client || '-') + '</td><td>' + (o.company || '-') + '</td><td>' + stageLabel(o.stage || 'Lead') + '</td><td>' + (o.value ? formatCurrency(o.value, o.currency) : '-') + '</td><td>' + (o.sector || '-') + '</td></tr>').join('');
    const kpiSection = kpis ? '<h3>' + t('kpiScorecard') + '</h3><table><thead><tr><th>' + t('metric') + '</th><th>' + t('value') + '</th></tr></thead><tbody>' +
      '<tr><td>' + t('totalPipelineValue') + '</td><td>' + (kpis.totalPipeline || 0) + '</td></tr>' +
      '<tr><td>' + t('wonDealsValue') + '</td><td>' + (kpis.wonValue || 0) + '</td></tr>' +
      '<tr><td>' + t('winRate') + '</td><td>' + (kpis.winRate || 0) + '%</td></tr>' +
      '<tr><td>' + t('activeOpps') + '</td><td>' + (kpis.activeOpps || 0) + '</td></tr>' +
      '<tr><td>' + t('taskCompletionRate') + '</td><td>' + (kpis.taskCompletionRate || 0) + '%</td></tr>' +
      '<tr><td>' + t('overdueTasks') + '</td><td>' + (kpis.overdueTasks || 0) + '</td></tr>' +
      '<tr><td>' + t('activeSectors') + '</td><td>' + (kpis.activeSectors || 0) + '</td></tr>' +
      '<tr><td>' + t('countriesCovered') + '</td><td>' + (kpis.activeCountries || 0) + '</td></tr>' +
      '</tbody></table>' : '';
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + t('efficiencyReport') + '</title><style>' +
      'body { font-family: -apple-system, Segoe UI, sans-serif; padding: 26px; color: #334155; background:#f8fafc; }' +
      '.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;box-shadow:0 6px 18px rgba(15,23,42,.06);margin-bottom:18px;}' +
      '.hero{background:linear-gradient(135deg,#4f46e5,#0ea5e9);color:#fff;border:none;}' +
      'h2 { margin:0 0 8px 0; font-size: 24px; }' +
      '.sub{opacity:.9;font-size:12px;font-weight:700;}' +
      'h3 { margin: 8px 0 12px; color: #1e293b; font-size: 16px; }' +
      'table { border-collapse: collapse; width: 100%; margin-bottom: 10px; overflow:hidden; border-radius:12px; }' +
      'th { background: #334155; color: #fff; padding: 10px 12px; text-align: ' + (isAr ? 'right' : 'left') + '; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }' +
      'td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; background:#fff; }' +
      'tr:last-child td { border-bottom: none; }' +
      'tr:nth-child(even) td { background: #f8fafc; }' +
      '.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}' +
      '.chip{font-size:10px;font-weight:800;background:#eef2ff;color:#4338ca;padding:6px 10px;border-radius:999px;}' +
      '@media print { body { padding: 10px; background:#fff; } .card{box-shadow:none;} table { page-break-inside: auto; } tr { page-break-inside: avoid; } }' +
      '</style></head><body>' +
      '<div class="card hero">' +
      '<h2>' + t('efficiencyReport') + '</h2>' +
      '<p class="sub">' + t('generated') + ': ' + new Date().toLocaleString(locale) + '</p>' +
      '<div class="chips">' +
      '<span class="chip">' + t('tasks') + ': ' + tasks.length + '</span>' +
      '<span class="chip">' + t('opportunity') + ': ' + (opportunities || []).length + '</span>' +
      '<span class="chip">' + t('onlineNow') + ': ' + users.filter(u => u.isOnline).length + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="card">' +
      kpiSection +
      '</div>' +
      '<div class="card">' +
      '<h3>' + t('teamLeaderboard') + '</h3>' +
      '<table><thead><tr><th>' + t('rank') + '</th><th>' + t('employee') + '</th><th>' + t('done') + ' / ' + t('assigned') + '</th><th>' + t('efficiencyPct') + '</th><th>' + t('rating') + '</th></tr></thead><tbody>' + leaderRows + '</tbody></table>' +
      '</div>' +
      '<div class="card">' +
      '<h3>' + t('tasks') + '</h3>' +
      '<table><thead><tr><th>' + t('task') + '</th><th>' + t('employee') + '</th><th>' + t('status') + '</th><th>' + t('priority') + '</th><th>' + t('sector') + '</th><th>' + t('deadline') + '</th></tr></thead><tbody>' + taskRows + '</tbody></table>' +
      '</div>' +
      (oppRows ? '<div class="card"><h3>' + t('pipeline') + '</h3><table><thead><tr><th>' + t('client') + '</th><th>' + t('companyAnalytics') + '</th><th>' + t('stage') + '</th><th>' + t('value') + '</th><th>' + t('sector') + '</th></tr></thead><tbody>' + oppRows + '</tbody></table></div>' : '') +
      '</body></html>';
    const wrappedHtml = html.replace('<body>', '<body dir="' + dir + '" lang="' + (isAr ? 'ar' : 'en') + '">');
    // Use Blob URL to avoid popup blocker issues
    const blob = new Blob([wrappedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.src = url;
    document.body.appendChild(printFrame);
    printFrame.onload = () => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (err) {
        // Fallback: open in new tab
        const w = window.open(url, '_blank');
        if (w) { w.onload = () => w.print(); }
        else { alert('Please allow popups to export PDF'); }
      }
      setTimeout(() => {
        document.body.removeChild(printFrame);
        URL.revokeObjectURL(url);
      }, 5000);
    };
  } catch (err) {
    console.error('[ExportPDF]', err);
    alert('Export failed: ' + err.message);
  }
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
const AdminHQ = () => {
  const { tasks, users, currentUser, isAdmin, opportunities, addNotification, lang } = useAppContext();
  const t = useT();
  const stageLabel = (st) => {
    const map = {
      'Lead': 'stageLead',
      'Qualified': 'stageQualified',
      'Negotiation': 'stageNegotiation',
      'Proposal': 'stageProposal',
      'Contract': 'stageContract',
      'Closed Won': 'stageClosedWon',
      'Closed Lost': 'stageClosedLost',
    };
    return t(map[st] || 'stageLead');
  };
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterUser, setFilterUser] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('tasks');

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Per-user stats ────────────────────────────────────────────────────────
  const userStats = useMemo(() => {
    return users.map(u => {
      const assigned = tasks.filter(t => t.employeeId === u.id);
      const completed = assigned.filter(t => t.status === 'completed');
      const inProgress = assigned.filter(t => t.status === 'in progress');
      const pending = assigned.filter(t => t.status === 'pending');
      const overdue = assigned.filter(t => t.dueDate && t.status !== 'completed' && new Date(t.dueDate) < new Date());
      const pct = assigned.length === 0 ? 0 : Math.round((completed.length / assigned.length) * 100);
      return { ...u, assigned: assigned.length, completed: completed.length, inProgress: inProgress.length, pending: pending.length, overdue: overdue.length, pct, badge: getPerfBadge(pct) };
    }).sort((a, b) => b.pct - a.pct);
  }, [users, tasks]);

  const myStats = userStats.find(u => u.id === currentUser.id);

  // ── CRM KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const opps = opportunities || [];
    const totalPipelineVal = opps.reduce((sum, o) => sum + (parseFloat(o.value) || 0), 0);
    const wonDeals = opps.filter(o => o.stage === 'Closed Won');
    const lostDeals = opps.filter(o => o.stage === 'Closed Lost');
    const wonValue = wonDeals.reduce((sum, o) => sum + (parseFloat(o.value) || 0), 0);
    const lostValue = lostDeals.reduce((sum, o) => sum + (parseFloat(o.value) || 0), 0);
    const closedTotal = wonDeals.length + lostDeals.length;
    const winRate = closedTotal === 0 ? 0 : Math.round((wonDeals.length / closedTotal) * 100);
    const activeOpps = opps.filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost').length;
    const overdueTasks = tasks.filter(t => t.dueDate && t.status !== 'completed' && new Date(t.dueDate) < new Date()).length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const taskCompletionRate = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);
    const activeSectors = new Set([...tasks.map(t => t.sector), ...opps.map(o => o.sector)].filter(Boolean)).size;
    const activeCountries = new Set([...tasks.map(t => t.country), ...opps.map(o => o.country)].filter(Boolean)).size;
    const avgDealSize = wonDeals.length === 0 ? 0 : Math.round(wonValue / wonDeals.length);
    return {
      totalPipeline: formatCurrency(totalPipelineVal), wonValue: formatCurrency(wonValue), winRate, activeOpps,
      taskCompletionRate, overdueTasks, activeSectors, activeCountries,
      avgDealSize: formatCurrency(avgDealSize), totalPipelineRaw: totalPipelineVal, wonValueRaw: wonValue, lostValueRaw: lostValue,
      completedTasks, inProgressTasks, pendingTasks, wonDealsCount: wonDeals.length, lostDealsCount: lostDeals.length
    };
  }, [opportunities, tasks]);

  // ── Chart data: Pipeline by Stage (Funnel) ────────────────────────────────
  const pipelineFunnelData = useMemo(() => {
    const opps = opportunities || [];
    const stages = ['Lead', 'Qualified', 'Negotiation', 'Proposal', 'Contract', 'Closed Won'];
    return stages.map((stage, i) => {
      const count = opps.filter(o => o.stage === stage).length;
      const value = opps.filter(o => o.stage === stage).reduce((s, o) => s + (parseFloat(o.value) || 0), 0);
      return { name: stage, value: count || 0, dealValue: value, fill: CHART_COLORS[i % CHART_COLORS.length] };
    }).filter(d => d.value > 0);
  }, [opportunities]);

  // ── Chart data: Task Status Distribution (Pie) ────────────────────────────
  const taskStatusPieData = useMemo(() => {
    return [
      { name: 'Completed', value: kpis.completedTasks, fill: '#34d399' },
      { name: 'In Progress', value: kpis.inProgressTasks, fill: '#818cf8' },
      { name: 'Pending', value: kpis.pendingTasks, fill: '#fbbf24' },
      { name: 'Overdue', value: kpis.overdueTasks, fill: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [kpis]);

  // ── Chart data: Win/Loss Pie ──────────────────────────────────────────────
  const winLossPieData = useMemo(() => {
    return [
      { name: 'Won', value: kpis.wonDealsCount, fill: '#34d399' },
      { name: 'Lost', value: kpis.lostDealsCount, fill: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [kpis]);

  // ── Chart data: Pipeline Value by Sector (Bar) ────────────────────────────
  const sectorBarData = useMemo(() => {
    const opps = opportunities || [];
    const sectorMap = {};
    opps.forEach(o => {
      if (!o.sector) return;
      if (!sectorMap[o.sector]) sectorMap[o.sector] = { tasks: 0, pipeline: 0 };
      sectorMap[o.sector].pipeline += parseFloat(o.value) || 0;
    });
    tasks.forEach(t => {
      if (!t.sector) return;
      if (!sectorMap[t.sector]) sectorMap[t.sector] = { tasks: 0, pipeline: 0 };
      sectorMap[t.sector].tasks += 1;
    });
    return Object.entries(sectorMap).map(([name, data]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '..' : name,
      pipeline: data.pipeline,
      tasks: data.tasks
    })).sort((a, b) => b.pipeline - a.pipeline).slice(0, 8);
  }, [opportunities, tasks]);

  // ── Chart data: Team Performance Radar ────────────────────────────────────
  const teamRadarData = useMemo(() => {
    return userStats.filter(u => u.assigned > 0).slice(0, 6).map(u => ({
      name: u.username.length > 10 ? u.username.slice(0, 8) + '..' : u.username,
      efficiency: u.pct,
      tasks: Math.min(u.assigned * 10, 100),
      onTime: u.assigned === 0 ? 0 : Math.round(((u.assigned - u.overdue) / u.assigned) * 100)
    }));
  }, [userStats]);

  // ── Chart data: Employee Performance Bar ──────────────────────────────────
  const employeeBarData = useMemo(() => {
    return userStats.filter(u => u.assigned > 0).slice(0, 8).map(u => ({
      name: u.username.length > 12 ? u.username.slice(0, 10) + '..' : u.username,
      completed: u.completed,
      inProgress: u.inProgress,
      pending: u.pending,
      overdue: u.overdue
    }));
  }, [userStats]);

  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'completed').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => t.dueDate && t.status !== 'completed' && new Date(t.dueDate) < new Date()).length;
    const online = users.filter(u => u.isOnline).length;
    const total = tasks.length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { active, completed, overdue, online, total, pct, totalUsers: users.length };
  }, [tasks, users]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0); return d; });
    return days.map(day => {
      const label = day.toLocaleDateString('en', { weekday: 'short' });
      const due = tasks.filter(t => { if (!t.dueDate) return false; const d = new Date(t.dueDate); d.setHours(0,0,0,0); return d.getTime() === day.getTime(); });
      return { name: label, completed: due.filter(t => t.status === 'completed').length, open: due.filter(t => t.status !== 'completed').length };
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterUser !== 'all' && t.employeeId !== filterUser) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      return true;
    });
  }, [tasks, filterUser, filterStatus]);

  const KPI_CARDS = [
    { label: t('pendingTasks'), value: stats.active, icon: <Briefcase size={18}/>, bg: 'bg-indigo-50', color: 'text-indigo-600' },
    { label: t('tasksDone'), value: stats.completed, icon: <Zap size={18}/>, bg: 'bg-emerald-50', color: 'text-emerald-500' },
    { label: 'Pipeline Value', value: kpis.totalPipeline, icon: <DollarSign size={18}/>, bg: 'bg-amber-50', color: 'text-amber-600' },
    { label: 'Win Rate', value: `${kpis.winRate}%`, icon: <Target size={18}/>, bg: 'bg-sky-50', color: 'text-sky-500' },
    { label: t('onlineNow'), value: stats.online, icon: <Users size={18}/>, bg: 'bg-emerald-50', color: 'text-emerald-500' },
    { label: 'Active Opps', value: kpis.activeOpps, icon: <Layers size={18}/>, bg: 'bg-purple-50', color: 'text-purple-500' },
    { label: 'Sectors', value: kpis.activeSectors, icon: <Layers size={18}/>, bg: 'bg-slate-50', color: 'text-slate-500' },
    { label: 'Countries', value: kpis.activeCountries, icon: <Globe size={18}/>, bg: 'bg-sky-50', color: 'text-sky-500' },
  ];

  // ── Custom Pie Label ──────────────────────────────────────────────────────
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight={900}>
        {name} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-8 relative">
      {/* Hamburger */}
      {isAdmin && (
        <div className="absolute top-0 end-0 z-30" ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)} className={`w-10 h-10 border border-slate-200 bg-white rounded-2xl flex items-center justify-center shadow-sm transition-all ${menuOpen ? 'bg-slate-900 border-slate-900 text-white' : 'text-slate-500'}`}>
            {menuOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-12 w-48 bg-white border border-slate-100 rounded-[1.5rem] shadow-2xl p-2 z-50 animate-in zoom-in-95 duration-150">
              <button onClick={() => { navigate('/ai'); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-indigo-50 text-slate-700"><Sparkles size={16} className="text-indigo-500"/><span className="text-xs font-black uppercase tracking-widest">Ask AI</span></button>
              <button onClick={() => { exportTableAsPDF(filteredTasks, users, userStats, opportunities, kpis, { lang, t }); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700"><FileDown size={16} className="text-slate-400"/><span className="text-xs font-black uppercase tracking-widest">Export PDF</span></button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 pt-2 pe-14">
        <div className="bg-indigo-600 p-2.5 rounded-[1.25rem] shadow-lg shadow-indigo-200">{isAdmin ? <BarChart3 className="text-white" size={22}/> : <TrendingUp className="text-white" size={22}/>}</div>
        <div><h2 className="text-2xl font-black text-slate-800 leading-tight">{isAdmin ? t('adminOS') : t('efficiency')}</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Shield size={10} className="text-indigo-400"/> {isAdmin ? t('globalAnalytics') : 'Personal Dashboard'}</p></div>
      </div>

      {/* Non-admin personal card */}
      {!isAdmin && myStats && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-5 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div><p className="font-black text-slate-800 text-lg sm:text-xl">{myStats.username}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{myStats.role}</p></div>
            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full ${myStats.badge.bg} ${myStats.badge.color} uppercase tracking-widest`}>{myStats.badge.label}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-6">
            <div><p className="text-2xl sm:text-3xl font-black text-slate-800">{myStats.assigned}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Assigned</p></div>
            <div><p className="text-2xl sm:text-3xl font-black text-emerald-500">{myStats.completed}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Done</p></div>
            <div><p className="text-2xl sm:text-3xl font-black text-indigo-600">{myStats.pct}%</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Efficiency</p></div>
          </div>
          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${myStats.pct}%` }}/></div>
        </div>
      )}

      {/* Admin KPI Cards */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {KPI_CARDS.map(card => (
            <div key={card.label} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`p-2.5 ${card.bg} ${card.color} rounded-2xl shrink-0`}>{card.icon}</div>
              <div className="min-w-0"><p className="text-lg font-black text-slate-800 truncate">{card.value}</p><p className="text-[8px] font-black uppercase text-slate-400 tracking-widest truncate">{card.label}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* Weekly Throughput Chart */}
      {isAdmin && (
        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
          <div className="flex justify-between items-center mb-6">
            <div><h3 className="text-base font-black text-slate-800">{t('weeklyThroughput')}</h3><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('tasksVsCompleted')}</p></div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"/><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Done</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-300"/><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Open</span></div>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, left: -20, right: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gComp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/><stop offset="95%" stopColor="#34d399" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.25}/><stop offset="95%" stopColor="#818cf8" stopOpacity={0}/></linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} dy={10}/>
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}/>
                <Tooltip content={<CustomTooltip />}/>
                <Area type="monotone" dataKey="completed" stroke="#34d399" strokeWidth={2.5} fillOpacity={1} fill="url(#gComp)"/>
                <Area type="monotone" dataKey="open" stroke="#818cf8" strokeWidth={2.5} fillOpacity={1} fill="url(#gOpen)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabs */}
      {isAdmin && (
        <>
          <div className="flex gap-2">
            {[{v:'tasks',l:t('tasks')},{v:'opportunities',l:t('opportunity')},{v:'kpis',l:t('kpiScorecard')}].map(tab => (
              <button key={tab.v} onClick={() => setActiveTab(tab.v)} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab.v ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>{tab.l}</button>
            ))}
          </div>

          {/* ═══════════════ TASKS TAB ═══════════════ */}
          {activeTab === 'tasks' && (
            <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between gap-3 p-5 border-b border-slate-50">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><Calendar size={16} className="text-indigo-500"/> {t('tasks')}</h3>
                <div className="flex gap-2">
                  <div className="relative"><select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="appearance-none bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 pe-8 text-[10px] font-black text-slate-600 uppercase tracking-widest outline-none"><option value="all">{t('allUsers')}</option>{users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}</select><ChevronDown size={12} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/></div>
                  <div className="relative"><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="appearance-none bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 pe-8 text-[10px] font-black text-slate-600 uppercase tracking-widest outline-none"><option value="all">{t('all')}</option><option value="pending">{t('pending')}</option><option value="in progress">{t('inProgress')}</option><option value="completed">{t('completed')}</option></select><ChevronDown size={12} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/></div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50/80">{[t('task'),t('employee'),t('status'),t('priority'),t('sector'),t('deadline')].map(h => <th key={h} className="px-5 py-3 text-start text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}</tr></thead>
                  <tbody>{filteredTasks.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-slate-300 font-black text-xs uppercase">{t('noTasks')}</td></tr> : filteredTasks.map((task, i) => {
                    const isOverdue = task.dueDate && task.status !== 'completed' && new Date(task.dueDate) < new Date();
                    return (
                      <tr key={task.id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                        <td className="px-5 py-3.5"><p className="font-black text-slate-800 text-xs">{task.title}</p>{task.notes && <p className="text-[10px] text-slate-400 font-medium mt-0.5 italic truncate max-w-[200px]">{task.notes}</p>}</td>
                        <td className="px-5 py-3.5"><span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{task.employee}</span></td>
                        <td className="px-5 py-3.5"><span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${STATUS_STYLE[task.status]||'bg-slate-100 text-slate-500'}`}>{task.status === 'in progress' ? t('inProgress') : task.status === 'completed' ? t('completed') : t('pending')}</span></td>
                        <td className="px-5 py-3.5"><span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${PRIORITY_STYLE[task.priority]||'bg-slate-100 text-slate-500'}`}>{task.priority||t('medium')}</span></td>
                        <td className="px-5 py-3.5"><span className="text-[10px] font-bold text-slate-500">{task.sector || '-'}</span></td>
                        <td className="px-5 py-3.5">{task.dueDate ? <span className={`text-[10px] font-black flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>{isOverdue ? <AlertCircle size={11}/> : <Clock size={11}/>}{new Date(task.dueDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span> : <span className="text-slate-300 text-[10px]">-</span>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-50"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{filteredTasks.length} tasks - {stats.pct}% completion</p></div>
            </div>
          )}

          {/* ═══════════════ OPPORTUNITIES TAB ═══════════════ */}
          {activeTab === 'opportunities' && (
            <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-50"><h3 className="font-black text-slate-800 flex items-center gap-2"><Target size={16} className="text-amber-500"/> {t('pipeline')}</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50/80">{[t('client'),t('companyAnalytics'),t('stage'),t('value'),t('sector'),t('country'),t('phoneNumber')].map(h => <th key={h} className="px-4 py-3 text-start text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}</tr></thead>
                  <tbody>{(!opportunities || opportunities.length === 0) ? <tr><td colSpan={7} className="text-center py-12 text-slate-300 font-black text-xs uppercase">No opportunities yet</td></tr> : opportunities.map((opp, i) => (
                    <tr key={opp.id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-3"><p className="font-black text-slate-800 text-xs">{opp.name}</p></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-bold text-slate-600">{opp.company || '-'}</span></td>
                      <td className="px-4 py-3"><span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${STAGE_STYLE[opp.stage]||'bg-slate-100 text-slate-500'}`}>{stageLabel(opp.stage)}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-black text-emerald-600">{opp.value ? formatCurrency(opp.value, opp.currency) : '-'}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-bold text-slate-500">{opp.sector || '-'}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-black text-slate-500">{opp.country || '-'}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-bold text-slate-500">{opp.contactPerson || '-'}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-50"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{(opportunities||[]).length} opportunities - Pipeline: {kpis.totalPipeline}</p></div>
            </div>
          )}

          {/* ═══════════════ KPI SCORECARD TAB (WITH CHARTS) ═══════════════ */}
          {activeTab === 'kpis' && (
            <div className="space-y-6">

              {/* ── Row 1: Radial Gauges ── */}
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Activity size={16} className="text-indigo-500"/> Performance Gauges</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <RadialGauge value={kpis.taskCompletionRate} label="Task Completion" color="#34d399"/>
                  <RadialGauge value={kpis.winRate} label="Win Rate" color="#6366f1"/>
                  <RadialGauge value={Math.min(100, Math.round((stats.online / Math.max(1, stats.totalUsers)) * 100))} label="Team Online" color="#06b6d4"/>
                  <RadialGauge value={tasks.length === 0 ? 100 : Math.max(0, 100 - Math.round((kpis.overdueTasks / tasks.length) * 100))} label="On-Time Rate" color="#f59e0b"/>
                </div>
              </div>

              {/* ── Row 2: Task Status Pie + Win/Loss Pie ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Task Status Distribution */}
                <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 text-sm"><PieIcon size={14} className="text-indigo-500"/> Task Status Distribution</h3>
                  {taskStatusPieData.length === 0 ? (
                    <p className="text-center text-slate-300 font-black text-xs uppercase py-12">No task data</p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={taskStatusPieData} cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3} dataKey="value" label={renderPieLabel} labelLine={false}>
                            {taskStatusPieData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="none"/>)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {taskStatusPieData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }}/><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{d.name} ({d.value})</span></div>
                    ))}
                  </div>
                </div>

                {/* Win/Loss Ratio */}
                <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 text-sm"><Target size={14} className="text-emerald-500"/> Deal Win / Loss Ratio</h3>
                  {winLossPieData.length === 0 ? (
                    <div className="text-center py-12"><p className="text-slate-300 font-black text-xs uppercase">No closed deals yet</p><p className="text-[10px] text-slate-400 mt-2">Create opportunities and close them to see this chart</p></div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={winLossPieData} cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={5} dataKey="value" label={renderPieLabel} labelLine={false}>
                            {winLossPieData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="none"/>)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex justify-center gap-6 mt-2">
                    <div className="text-center"><p className="text-lg font-black text-emerald-500">{kpis.wonValue}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Won Value</p></div>
                    <div className="text-center"><p className="text-lg font-black text-red-500">{formatCurrency(kpis.lostValueRaw)}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Lost Value</p></div>
                  </div>
                </div>
              </div>

              {/* ── Row 3: Pipeline by Sector (Bar Chart) ── */}
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 text-sm"><BarChart3 size={14} className="text-amber-500"/> Pipeline Value by Sector</h3>
                {sectorBarData.length === 0 ? (
                  <p className="text-center text-slate-300 font-black text-xs uppercase py-12">No sector data yet</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/><stop offset="100%" stopColor="#6366f1" stopOpacity={0.4}/></linearGradient>
                        </defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }} angle={-20} textAnchor="end" height={50}/>
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} tickFormatter={v => formatCompact(v)}/>
                        <Tooltip content={<CustomTooltip />}/>
                        <Bar dataKey="pipeline" name="Pipeline Value" fill="url(#barGrad)" radius={[8, 8, 0, 0]} maxBarSize={40}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* ── Row 4: Employee Performance (Stacked Bar) ── */}
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 text-sm"><Users size={14} className="text-indigo-500"/> Employee Task Breakdown</h3>
                {employeeBarData.length === 0 ? (
                  <p className="text-center text-slate-300 font-black text-xs uppercase py-12">No employee data</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={employeeBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }}/>
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}/>
                        <Tooltip content={<CustomTooltip />}/>
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 900 }}/>
                        <Bar dataKey="completed" name="Completed" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]}/>
                        <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#818cf8" radius={[0, 0, 0, 0]}/>
                        <Bar dataKey="pending" name="Pending" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]}/>
                        <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[8, 8, 0, 0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* ── Row 5: Pipeline Funnel ── */}
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 text-sm"><Layers size={14} className="text-purple-500"/> Sales Pipeline Funnel</h3>
                {pipelineFunnelData.length === 0 ? (
                  <div className="text-center py-12"><p className="text-slate-300 font-black text-xs uppercase">No pipeline data yet</p><p className="text-[10px] text-slate-400 mt-2">Create opportunities to visualize the sales funnel</p></div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <Tooltip content={<CustomTooltip />}/>
                        <Funnel dataKey="value" data={pipelineFunnelData} isAnimationActive nameKey="name">
                          <LabelList position="right" fill="#64748b" fontSize={10} fontWeight={900} formatter={(v) => v}/>
                          <LabelList position="center" fill="#fff" fontSize={11} fontWeight={900} dataKey="name"/>
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* ── Row 6: KPI Summary Cards ── */}
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-indigo-500"/> KPI Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Total Pipeline Value', value: kpis.totalPipeline, icon: <DollarSign size={16}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Won Deals Value', value: kpis.wonValue, icon: <CheckCircle2 size={16}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Win Rate', value: `${kpis.winRate}%`, icon: <Target size={16}/>, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Avg Deal Size', value: kpis.avgDealSize, icon: <DollarSign size={16}/>, color: 'text-sky-600', bg: 'bg-sky-50' },
                    { label: 'Active Opportunities', value: kpis.activeOpps, icon: <Layers size={16}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Task Completion Rate', value: `${kpis.taskCompletionRate}%`, icon: <Zap size={16}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Overdue Tasks', value: kpis.overdueTasks, icon: <AlertCircle size={16}/>, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Active Sectors', value: kpis.activeSectors, icon: <Layers size={16}/>, color: 'text-slate-600', bg: 'bg-slate-50' },
                    { label: 'Countries Covered', value: kpis.activeCountries, icon: <Globe size={16}/>, color: 'text-sky-600', bg: 'bg-sky-50' },
                    { label: 'Online Staff', value: stats.online, icon: <Users size={16}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  ].map(kpi => (
                    <div key={kpi.label} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                      <div className={`p-2.5 ${kpi.bg} ${kpi.color} rounded-xl shrink-0`}>{kpi.icon}</div>
                      <div><p className="text-xl font-black text-slate-800">{kpi.value}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Row 7: Team Leaderboard ── */}
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-5 md:p-7">
                <h4 className="font-black text-slate-800 mb-4 text-sm uppercase tracking-widest flex items-center gap-2"><Users size={14} className="text-indigo-500"/> Team Leaderboard</h4>
                <div className="space-y-2">
                  {userStats.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                      <span className="text-sm font-black text-slate-300 w-6 text-center">{i + 1}</span>
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-sm shrink-0">{u.username.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0"><p className="font-black text-slate-800 text-sm truncate">{u.username}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{u.completed}/{u.assigned} done - {u.overdue} overdue</p></div>
                      <div className="text-end shrink-0"><p className="font-black text-indigo-600 text-sm">{u.pct}%</p><span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${u.badge.bg} ${u.badge.color} uppercase`}>{u.badge.label}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminHQ;
