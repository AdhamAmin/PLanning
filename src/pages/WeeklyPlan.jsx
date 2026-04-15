import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Plus, CalendarDays, AlertCircle, Pencil, Trash2, Check, Users, User } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import useT from '../i18n/useT';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_AR = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const STATUS_DOT = { completed: 'bg-emerald-400', 'in progress': 'bg-indigo-400', pending: 'bg-amber-400' };
const EVENT_STATUS = { done: 'bg-emerald-50 text-emerald-600 border-emerald-200', cancelled: 'bg-red-50 text-red-500 border-red-200', active: 'bg-violet-50 text-violet-600 border-violet-200' };
const PRIORITY_STYLE = { High: 'bg-red-50 text-red-500', Medium: 'bg-amber-50 text-amber-500', Low: 'bg-blue-50 text-blue-500' };

// ─── Event Form (Add / Edit) ─────────────────────────────────────────────────
const EventPopup = ({ date, event, onClose, existingEvents, readOnly, dayTasksSource, dayOppsSource }) => {
  const { currentUser, users, groups, isAdmin, addNotification, lang } = useAppContext();
  const t = useT();
  const isEdit = !!event;
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
  const oppTypeLabel = (ot) => {
    const map = {
      'Shipment': 'oppTypeShipment',
      'Strategic Project': 'oppTypeStrategicProject',
      'Collection Contract': 'oppTypeCollectionContract',
      'Supply Contract': 'oppTypeSupplyContract',
      'Partnership': 'oppTypePartnership',
      'Franchise License': 'oppTypeFranchiseLicense',
      'Bulk Purchase': 'oppTypeBulkPurchase',
      'Project': 'oppTypeProject',
      'Distribution': 'oppTypeDistribution',
    };
    return t(map[ot] || 'opportunityType');
  };

  const [title, setTitle] = useState(event?.title || '');
  const [notes, setNotes] = useState(event?.notes || '');
  const [time, setTime] = useState(event?.time || '09:00');
  const [assignType, setAssignType] = useState(event?.assignedType || 'none'); // 'none' | 'user' | 'group'
  const [assignedTo, setAssignedTo] = useState(event?.assignedTo || '');
  const [saving, setSaving] = useState(false);

  const dayStr = date.toDateString();
  const dayEvents = existingEvents.filter(e => e.date === dayStr && e.id !== event?.id);
  const dayTasks = (dayTasksSource || []).filter(tk => {
    if (tk.dueDate) { const d = new Date(tk.dueDate); d.setHours(0,0,0,0); return d.toDateString() === dayStr; }
    return tk.status === 'in progress' && new Date().toDateString() === dayStr;
  });
  const dayOpps = (dayOppsSource || []).filter(opp => {
    if (opp._archived) return false;
    if (opp.nextActionDate) {
      const d = new Date(opp.nextActionDate);
      d.setHours(0,0,0,0);
      return d.toDateString() === dayStr;
    }
    return false;
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (!title.trim()) return;
    setSaving(true);
    try {
      const data = {
        title: title.trim(), notes, time, date: dayStr,
        assignedType: assignType,
        assignedTo: assignType !== 'none' ? assignedTo : '',
        updatedAt: serverTimestamp()
      };
      if (isEdit) {
        await updateDoc(doc(db, 'events', event.id), data);
        addNotification(`Event "${title}" updated.`, 'info', 'admin');
      } else {
        data.creatorId = currentUser.id;
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'events'), data);
        addNotification(`New event "${title}" on ${dayStr}.`, 'info', 'admin');
        // Notify assigned user/group
        if (assignType === 'user' && assignedTo) {
          addNotification(`You have been assigned to event "${title}" on ${dayStr}.`, 'info', assignedTo);
        }
        if (assignType === 'group' && assignedTo) {
          const grp = (groups || []).find(g => g.id === assignedTo);
          if (grp) (grp.members || []).forEach(mid => addNotification(`Group "${grp.name}" assigned to event "${title}".`, 'info', mid));
        }
      }
      onClose();
    } catch (err) { console.error('[EventSave]', err); }
    finally { setSaving(false); }
  };

  const removeEvent = async (id) => {
    if (readOnly) return;
    if (!window.confirm('Delete this event?')) return;
    await deleteDoc(doc(db, 'events', id));
    addNotification(`Event deleted.`, 'info', 'admin');
  };

  const markEventDone = async (id) => {
    if (readOnly) return;
    await updateDoc(doc(db, 'events', id), { eventStatus: 'done', updatedAt: serverTimestamp() });
    addNotification('Event marked as done.', 'success', 'admin');
  };

  const cancelEvent = async (id) => {
    if (readOnly) return;
    if (!window.confirm('Cancel this event?')) return;
    await updateDoc(doc(db, 'events', id), { eventStatus: 'cancelled', updatedAt: serverTimestamp() });
    addNotification('Event cancelled.', 'info', 'admin');
  };

  const getAssignLabel = (ev) => {
    if (!ev.assignedTo) return null;
    if (ev.assignedType === 'user') { const u = users.find(x => x.id === ev.assignedTo); return u ? u.username : ev.assignedTo; }
    if (ev.assignedType === 'group') { const g = (groups||[]).find(x => x.id === ev.assignedTo); return g ? g.name : ev.assignedTo; }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">
                {readOnly ? t('planner') : (isEdit ? t('editEvent') : date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' }))}
              </p>
              <h2 className="text-3xl font-black">{date.getDate()}</h2>
              <p className="text-indigo-200 text-xs font-bold mt-0.5">{date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long' })}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 rounded-xl text-white hover:bg-white/30"><X size={16}/></button>
          </div>
        </div>

        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
          {/* Opportunities due today */}
          {dayOpps.length > 0 && (
            <div><p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-2">{t('followUpOpportunities')}</p>
              <div className="space-y-1.5">{dayOpps.map(opp => {
                const assignedIds = Array.isArray(opp.assignedTo) ? opp.assignedTo : (opp.assignedTo ? [opp.assignedTo] : []);
                return (
                  <div key={opp.id} className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{stageLabel(opp.stage)}</span>
                      <div className="flex gap-1">
                        {assignedIds.map(uid => {
                          const u = users.find(x => x.id === uid);
                          return u ? <span key={uid} className="text-[8px] font-black px-1.5 py-0.5 bg-white text-rose-400 rounded-md border border-rose-100">{u.username}</span> : null;
                        })}
                      </div>
                    </div>
                    <p className="text-sm font-black text-slate-800">{opp.client}</p>
                    {opp.opportunityType && <p className="text-[10px] text-rose-500 font-bold mt-0.5">{oppTypeLabel(opp.opportunityType)}</p>}
                    {opp.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">"{opp.notes}"</p>}
                  </div>
                );
              })}</div>
            </div>
          )}

          {/* Tasks due today */}
          {dayTasks.length > 0 && (
            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('tasksDue')}</p>
              <div className="space-y-1.5">{dayTasks.map(tk => (
                <div key={tk.id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[tk.status]||'bg-slate-300'}`}/>
                  <span className="text-xs font-bold text-slate-700 truncate">{tk.title}</span>
                  <span className={`ms-auto text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${tk.status==='completed'?'bg-emerald-50 text-emerald-600':tk.status==='in progress'?'bg-indigo-50 text-indigo-600':'bg-amber-50 text-amber-600'}`}>{tk.status}</span>
                </div>
              ))}</div>
            </div>
          )}

          {/* Existing events */}
          {dayEvents.length > 0 && (
            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('events')}</p>
              <div className="space-y-1.5">{dayEvents.map(ev => (
                <div key={ev.id} className={`flex items-start gap-2 p-3 rounded-xl group border ${EVENT_STATUS[ev.eventStatus || 'active'] || EVENT_STATUS.active}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Clock size={10} className="shrink-0 opacity-60"/>
                      <span className="text-[9px] font-black uppercase opacity-60">{ev.time}</span>
                      {ev.eventStatus === 'done' && <span className="text-[8px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">{t('done')}</span>}
                      {ev.eventStatus === 'cancelled' && <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full line-through">{t('cancelled')}</span>}
                    </div>
                    <p className={`text-sm font-black mt-0.5 truncate ${ev.eventStatus === 'cancelled' ? 'line-through opacity-50' : ''}`}>{ev.title}</p>
                    {ev.notes && <p className="text-xs font-medium mt-0.5 italic opacity-60">{ev.notes}</p>}
                    {getAssignLabel(ev) && <p className="text-[9px] font-bold mt-1 flex items-center gap-1 opacity-70">{ev.assignedType === 'group' ? <Users size={9}/> : <User size={9}/>} {getAssignLabel(ev)}</p>}
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1 shrink-0">
                      {ev.eventStatus !== 'done' && ev.eventStatus !== 'cancelled' && (
                        <button onClick={() => markEventDone(ev.id)} title={t('markDone')} className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg transition-colors"><Check size={12}/></button>
                      )}
                      {ev.eventStatus !== 'cancelled' && (
                        <button onClick={() => cancelEvent(ev.id)} title={t('cancelEvent')} className="p-1.5 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"><X size={12}/></button>
                      )}
                      <button onClick={() => removeEvent(ev.id)} title={t('deleteEvent')} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-white transition-colors"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
              ))}</div>
            </div>
          )}

          {/* Form */}
          {!readOnly && (
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{isEdit ? t('editEvent') : t('addEvent')}</p>
            <form onSubmit={handleSave} className="space-y-2">
              <input placeholder={t('eventTitle')} value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder-slate-300"/>
              <div className="flex gap-2">
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-32 px-3 py-2.5 bg-slate-50 rounded-xl text-sm font-bold text-slate-800 outline-none"/>
                <input placeholder={t('eventNotes')} value={notes} onChange={e => setNotes(e.target.value)} className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold text-slate-800 outline-none placeholder-slate-300"/>
              </div>

              {/* Assign To */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('assignTo')}</label>
                <div className="flex gap-2">
                  {[{v:'none',l:t('none')},{v:'user',l:t('employee')},{v:'group',l:t('team')}].map(o => (
                    <button key={o.v} type="button" onClick={() => { setAssignType(o.v); setAssignedTo(''); }}
                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${assignType === o.v ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{o.l}</button>
                  ))}
                </div>
                {assignType === 'user' && (
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full p-3 bg-slate-50 rounded-2xl outline-none font-bold text-slate-800 text-sm">
                    <option value="">{t('selectEmployee')}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                  </select>
                )}
                {assignType === 'group' && (
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full p-3 bg-slate-50 rounded-2xl outline-none font-bold text-slate-800 text-sm">
                    <option value="">{t('selectTeam')}</option>
                    {(groups||[]).map(g => <option key={g.id} value={g.id}>{g.name} ({(g.members||[]).length} members)</option>)}
                  </select>
                )}
              </div>

              <button type="submit" disabled={!title.trim() || saving}
                className="w-full py-3 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 transition-all">
                {isEdit ? <><Check size={14}/> {t('updateEvent')}</> : <><Plus size={14}/> {t('addEvent')}</>}
              </button>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Upcoming Agenda (Tasks + Opps) ──────────────────────────────────────────
const UpcomingAgenda = ({ tasks, opportunities, today, currentUser, users, isAdmin }) => {
  const t = useT();
  const days = useMemo(() => { const arr = []; for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(today.getDate() + i); arr.push(d); } return arr; }, [today]);
  
  const relevantTasks = useMemo(() => tasks.filter(task => isAdmin ? true : task.employeeId === currentUser?.id || task.taskType === 'bonus'), [tasks, isAdmin, currentUser]);
  const relevantOpps = useMemo(() => (opportunities || []).filter(opp => {
    if (opp._archived) return false;
    if (isAdmin) return true;
    const assignedIds = Array.isArray(opp.assignedTo) ? opp.assignedTo : (opp.assignedTo ? [opp.assignedTo] : []);
    return assignedIds.includes(currentUser?.id);
  }), [opportunities, isAdmin, currentUser]);

  const grouped = useMemo(() => {
    const map = {}; const todayStr = today.toDateString();
    relevantTasks.forEach(task => {
      if (task.status === 'completed') return;
      let key = null;
      if (task.dueDate) { const d = new Date(task.dueDate); d.setHours(0,0,0,0); key = d.toDateString(); }
      else if (task.status === 'in progress') key = todayStr;
      if (key) { map[key] = map[key] || { tasks: [], opps: [] }; map[key].tasks.push(task); }
    });
    relevantOpps.forEach(opp => {
      if (!opp.nextActionDate) return;
      const d = new Date(opp.nextActionDate); d.setHours(0,0,0,0); const key = d.toDateString();
      if (days.some(day => day.toDateString() === key)) {
        map[key] = map[key] || { tasks: [], opps: [] }; map[key].opps.push(opp);
      }
    });
    return map;
  }, [relevantTasks, relevantOpps, today, days]);
  
  const daysWithAgenda = days.filter(d => {
    const dayData = grouped[d.toDateString()];
    return dayData && (dayData.tasks.length > 0 || dayData.opps.length > 0);
  });

  if (daysWithAgenda.length === 0) return null;

  const getStatusStyle = (status) => {
    if (status === 'in progress') return { dot: 'bg-indigo-400', label: 'bg-indigo-50 text-indigo-600' };
    if (status === 'completed') return { dot: 'bg-emerald-400', label: 'bg-emerald-50 text-emerald-600' };
    return { dot: 'bg-amber-400', label: 'bg-amber-50 text-amber-600' };
  };

  const formatDayLabel = (d) => {
    const locale = (document?.documentElement?.lang === 'ar') ? 'ar-EG' : 'en-GB';
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center gap-2"><CalendarDays size={16} className="text-indigo-500"/><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('upcomingAgenda')}</span></div>
      {daysWithAgenda.map(day => {
        const dayStr = day.toDateString(); 
        const { tasks: dayTasks = [], opps: dayOpps = [] } = grouped[dayStr] || {};
        const isToday = isSameDay(day, today);
        const isTomorrow = isSameDay(day, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
        const dayLabel = isToday ? t('today') : isTomorrow ? t('tomorrow') : formatDayLabel(day);
        
        return (
          <div key={dayStr} className={`bg-white rounded-[1.5rem] border shadow-sm overflow-hidden ${isToday ? 'border-indigo-200' : 'border-slate-100'}`}>
            <div className={`flex items-center justify-between px-4 py-2.5 ${isToday ? 'bg-indigo-600' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black uppercase tracking-widest ${isToday ? 'text-white' : 'text-slate-600'}`}>{dayLabel}</span>
              </div>
              <div className="flex gap-1">
                {dayTasks.length > 0 && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500'}`}>{dayTasks.length} {t('tasks')}</span>}
                {dayOpps.length > 0 && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isToday ? 'bg-rose-400 text-white' : 'bg-rose-50 text-rose-500'}`}>{dayOpps.length} {t('followUps')}</span>}
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {dayOpps.map(opp => (
                <div key={opp.id} className="flex items-center gap-3 px-4 py-3 bg-rose-50/30">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-rose-400"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{opp.client}</p>
                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">{opp.stage}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(Array.isArray(opp.assignedTo) ? opp.assignedTo : (opp.assignedTo ? [opp.assignedTo] : [])).slice(0, 2).map(uid => {
                      const u = users.find(x => x.id === uid);
                      return u ? <span key={uid} className="text-[8px] font-black px-1.5 py-0.5 bg-white text-rose-400 rounded-md border border-rose-100">{u.username}</span> : null;
                    })}
                  </div>
                </div>
              ))}
              {dayTasks.map(task => {
                const s = getStatusStyle(task.status);
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`}/>
                    <div className="flex-1 min-w-0"><p className="text-sm font-black text-slate-800 truncate">{task.title}</p></div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${PRIORITY_STYLE[task.priority]||'bg-slate-50 text-slate-400'}`}>{task.priority||'Med'}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${s.label}`}>{task.status === 'in progress' ? t('active') : task.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── All Events Viewer ────────────────────────────────────────────────────────
const AllEventsList = ({ events, users, groups, onEditEvent, onMarkDone, onCancelEvent, onDeleteEvent }) => {
  if (!events || events.length === 0) return null;
  const groupedEvents = events.reduce((acc, ev) => { const key = ev.date || 'Unknown'; if (!acc[key]) acc[key] = []; acc[key].push(ev); return acc; }, {});
  const sortedDates = Object.keys(groupedEvents).sort((a, b) => { const da = new Date(a); const db2 = new Date(b); if (isNaN(da) || isNaN(db2)) return 0; return da - db2; });
  const formatLabel = (dateStr) => { const d = new Date(dateStr); if (isNaN(d)) return dateStr; const today = new Date(); today.setHours(0,0,0,0); const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1); if (d.toDateString()===today.toDateString()) return 'Today'; if (d.toDateString()===tomorrow.toDateString()) return 'Tomorrow'; return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}); };
  const getAssignLabel = (ev) => {
    if (!ev.assignedTo) return null;
    if (ev.assignedType === 'user') { const u = users.find(x => x.id === ev.assignedTo); return u ? u.username : ev.assignedTo; }
    if (ev.assignedType === 'group') { const g = (groups||[]).find(x => x.id === ev.assignedTo); return g ? g.name : ev.assignedTo; }
    return null;
  };
  return (
    <div className="space-y-3 pb-6 pt-6 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><CalendarDays size={16} className="text-violet-500"/><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">All Scheduled Events</span></div>
        <span className="text-[10px] font-black bg-violet-50 text-violet-500 px-3 py-1 rounded-full border border-violet-100">{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedDates.map(dateKey => {
          const label = formatLabel(dateKey); const isToday = label === 'Today';
          return (
            <div key={dateKey} className={`rounded-2xl border p-4 shadow-sm ${isToday ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-3 border-b border-slate-100/80 pb-2">
                <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-violet-600' : 'text-slate-400'}`}>{label}</p>
                <span className="text-[9px] font-black bg-white text-slate-400 border border-slate-100 px-2 py-0.5 rounded-full">{groupedEvents[dateKey].length}</span>
              </div>
              <div className="space-y-2">{groupedEvents[dateKey].map(ev => (
                <div key={ev.id} className={`flex gap-3 items-start p-3 rounded-xl border transition-all group ${ev.eventStatus === 'done' ? 'bg-emerald-50 border-emerald-200' : ev.eventStatus === 'cancelled' ? 'bg-red-50 border-red-200 opacity-60' : 'bg-white border-slate-100/50 hover:border-violet-200 hover:shadow-sm'}`}>
                  <div className={`mt-0.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0 ${ev.eventStatus === 'done' ? 'bg-emerald-500 text-white' : ev.eventStatus === 'cancelled' ? 'bg-red-400 text-white' : isToday ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-600'}`}>{ev.time}</div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEditEvent(ev)}>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black text-slate-800 leading-tight truncate ${ev.eventStatus === 'cancelled' ? 'line-through opacity-50' : ''}`}>{ev.title}</p>
                      {ev.eventStatus === 'done' && <span className="text-[7px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">DONE</span>}
                      {ev.eventStatus === 'cancelled' && <span className="text-[7px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">CANCELLED</span>}
                    </div>
                    {ev.notes && <p className="text-[11px] text-slate-400 font-medium mt-0.5 italic">{ev.notes}</p>}
                    {getAssignLabel(ev) && <p className="text-[9px] font-bold text-violet-500 mt-1 flex items-center gap-1">{ev.assignedType === 'group' ? <Users size={9}/> : <User size={9}/>} {getAssignLabel(ev)}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {ev.eventStatus !== 'done' && ev.eventStatus !== 'cancelled' && (
                      <button onClick={() => onMarkDone(ev.id)} title="Done" className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg transition-colors"><Check size={12}/></button>
                    )}
                    {ev.eventStatus !== 'cancelled' && (
                      <button onClick={() => onCancelEvent(ev.id)} title="Cancel" className="p-1.5 bg-red-50 text-red-400 hover:bg-red-100 rounded-lg transition-colors"><X size={12}/></button>
                    )}
                    <button onClick={() => onEditEvent(ev)} className="p-1 text-slate-200 group-hover:text-violet-500 transition-colors"><Pencil size={12}/></button>
                    <button onClick={() => onDeleteEvent(ev.id)} title="Delete" className="p-1 text-slate-200 group-hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Planner ─────────────────────────────────────────────────────────────
const WeeklyPlan = () => {
  const { tasks, events, opportunities, users, groups, isAdmin, currentUser, lang, addNotification } = useAppContext();
  const t = useT();

  const today = new Date(); today.setHours(0,0,0,0);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthLabel = (lang === 'ar' ? MONTHS_AR : MONTHS)[month] + ' ' + year;
  const dayLabels = lang === 'ar' ? DAYS_AR : DAYS;

  const calGrid = useMemo(() => {
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
    return grid;
  }, [year, month, daysInMonth, firstDay]);

  const visibleTasks = useMemo(() => {
    if (isAdmin) return tasks;
    return tasks.filter(tk => {
      if (tk.taskType === 'bonus') return (!tk.employeeId || tk.employeeId === currentUser?.id);
      return tk.employeeId === currentUser?.id;
    });
  }, [tasks, isAdmin, currentUser]);

  const visibleOpps = useMemo(() => {
    if (isAdmin) return opportunities || [];
    return (opportunities || []).filter(opp => {
      if (opp._archived) return false;
      const assignedIds = Array.isArray(opp.assignedTo) ? opp.assignedTo : (opp.assignedTo ? [opp.assignedTo] : []);
      return assignedIds.includes(currentUser?.id);
    });
  }, [opportunities, isAdmin, currentUser]);

  const visibleEvents = useMemo(() => {
    if (isAdmin) return events;
    const myGroups = (groups || []).filter(g => (g.members || []).includes(currentUser?.id)).map(g => g.id);
    return (events || []).filter(ev => {
      if (ev.creatorId === currentUser?.id) return true;
      if (ev.assignedType === 'user' && ev.assignedTo === currentUser?.id) return true;
      if (ev.assignedType === 'group' && myGroups.includes(ev.assignedTo)) return true;
      return false;
    });
  }, [events, groups, isAdmin, currentUser]);

  const eventsByDay = useMemo(() => { const map = {}; visibleEvents.forEach(ev => { (map[ev.date] = map[ev.date] || []).push(ev); }); return map; }, [visibleEvents]);
  const tasksByDay = useMemo(() => {
    const map = {}; const todayStr = today.toDateString();
    visibleTasks.forEach(tk => { let key = null; if (tk.dueDate) { const d = new Date(tk.dueDate); d.setHours(0,0,0,0); key = d.toDateString(); } else if (tk.status === 'in progress') key = todayStr; if (key) (map[key] = map[key] || []).push(tk); });
    return map;
  }, [visibleTasks, today]);
  const oppsByDay = useMemo(() => {
    const map = {};
    (visibleOpps || []).forEach(opp => {
      if (opp._archived || !opp.nextActionDate) return;
      const d = new Date(opp.nextActionDate);
      d.setHours(0,0,0,0);
      const key = d.toDateString();
      (map[key] = map[key] || []).push(opp);
    });
    return map;
  }, [visibleOpps]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const handleEditEvent = (ev) => {
    if (!isAdmin) return;
    const evDate = new Date(ev.date);
    if (isNaN(evDate)) return;
    setEditingEvent(ev);
    setSelectedDay(evDate);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-slate-800">{monthLabel}</h2>
          <button onClick={goToday} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors">{t('today')}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 shadow-sm"><ChevronLeft size={18}/></button>
          <button onClick={nextMonth} className="w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 shadow-sm"><ChevronRight size={18}/></button>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-50">{dayLabels.map(d => <div key={d} className="py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {calGrid.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} className="aspect-square md:aspect-auto md:min-h-[90px] border-b border-e border-slate-50 last:border-e-0"/>;
            const dayStr = day.toDateString(); const isToday = isSameDay(day, today); const isPast = day < today;
            const dayEvents_ = eventsByDay[dayStr] || [];
            const dayTasks_ = tasksByDay[dayStr] || [];
            const dayOpps_ = oppsByDay[dayStr] || [];
            const hasContent = dayTasks_.length > 0 || dayOpps_.length > 0 || dayEvents_.length > 0;
            const colIdx = idx % 7; const isLastCol = colIdx === 6; const isLastRow = idx >= calGrid.length - 7;
            return (
              <button
                key={dayStr}
                onClick={() => { setEditingEvent(null); setSelectedDay(day); }}
                className={`aspect-square md:aspect-auto md:min-h-[90px] p-2 border-b border-e border-slate-50 text-start transition-all relative group hover:bg-indigo-50/50 ${isLastCol ? 'border-e-0' : ''} ${isLastRow ? 'border-b-0' : ''}`}
              >
                <div className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-sm font-black transition-colors ${isToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : isPast ? 'text-slate-300' : 'text-slate-700 group-hover:text-indigo-600'}`}>{day.getDate()}</div>
                {hasContent && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {dayTasks_.slice(0,3).map((tk,i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[tk.status]||'bg-slate-300'}`}/>)}
                    {dayOpps_.slice(0,3).map((_,i) => <div key={`o${i}`} className="w-1.5 h-1.5 rounded-full bg-rose-400"/>)}
                    {dayEvents_.slice(0,2).map((_,i) => <div key={`e${i}`} className="w-1.5 h-1.5 rounded-full bg-violet-400"/>)}
                  </div>
                )}
                {isAdmin && (
                  <div className="hidden md:block mt-1 space-y-0.5">
                    {dayOpps_.slice(0,1).map((opp, i) => <div key={`o${i}`} className="text-[9px] font-bold text-rose-600 bg-rose-50 rounded-md px-1.5 py-0.5 truncate">{opp.client}</div>)}
                    {dayEvents_.slice(0,1).map((ev,i) => <div key={i} className="text-[9px] font-bold text-violet-600 bg-violet-50 rounded-md px-1.5 py-0.5 truncate">{ev.title}</div>)}
                    {dayTasks_.slice(0,1).map((tk,i) => <div key={i} className={`text-[9px] font-bold rounded-md px-1.5 py-0.5 truncate ${STATUS_DOT[tk.status]==='bg-emerald-400'?'bg-emerald-50 text-emerald-600':STATUS_DOT[tk.status]==='bg-indigo-400'?'bg-indigo-50 text-indigo-600':'bg-amber-50 text-amber-600'}`}>{tk.title}</div>)}
                    {(dayEvents_.length + dayTasks_.length + dayOpps_.length) > 3 && <div className="text-[8px] font-black text-slate-400 ps-1">+{dayEvents_.length + dayTasks_.length + dayOpps_.length - 3} more</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3 px-1">
          {[{ label: 'Event', color: 'bg-violet-400' }, { label: 'Follow-up', color: 'bg-rose-400' }, { label: 'Completed', color: 'bg-emerald-400' }, { label: 'In Progress', color: 'bg-indigo-400' }, { label: 'Pending', color: 'bg-amber-400' }].map(leg => (
            <div key={leg.label} className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${leg.color}`}/><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{leg.label}</span></div>
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <UpcomingAgenda tasks={tasks} opportunities={opportunities} today={today} currentUser={currentUser} users={users} isAdmin={isAdmin}/>
          <AllEventsList events={events} users={users} groups={groups} onEditEvent={handleEditEvent}
            onMarkDone={async (id) => { await updateDoc(doc(db, 'events', id), { eventStatus: 'done', updatedAt: serverTimestamp() }); }}
            onCancelEvent={async (id) => { if (window.confirm('Cancel this event?')) await updateDoc(doc(db, 'events', id), { eventStatus: 'cancelled', updatedAt: serverTimestamp() }); }}
            onDeleteEvent={async (id) => { if (window.confirm('Delete this event permanently?')) { await deleteDoc(doc(db, 'events', id)); addNotification('Event deleted.', 'info', 'admin'); } }}
          />
        </>
      )}

      {selectedDay && (
        <EventPopup
          date={selectedDay}
          event={editingEvent}
          existingEvents={visibleEvents}
          onClose={() => { setSelectedDay(null); setEditingEvent(null); }}
          readOnly={!isAdmin}
          dayTasksSource={visibleTasks}
          dayOppsSource={visibleOpps}
        />
      )}
    </div>
  );
};

export default WeeklyPlan;
