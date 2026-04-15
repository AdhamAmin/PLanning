import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Trash2, Calendar, FileText, TrendingUp, Users, 
  Inbox, Briefcase, X, ShieldAlert, Star, Pencil,
  Clock, AlertCircle, CheckCircle2, MessageSquare, BarChart3,
  DollarSign, Globe, Target, Filter, Layers, Building2, Menu, ChevronDown
} from 'lucide-react';
import { db } from '../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useAppContext } from '../context/AppContext';
import { syncTaskCreated, syncTaskUpdated, syncTaskDeleted } from '../services/sheetsService';
import { sendTaskAssignmentEmail } from '../services/emailService';
import { SECTORS, PIPELINE_STAGES, OPPORTUNITY_TYPES, CURRENCIES, COUNTRIES } from '../archive/db';
import { getUserEmployeeId } from '../utils/userIdentity';

const STAGE_TKEY = {
  Lead: 'stageLead',
  Qualified: 'stageQualified',
  Negotiation: 'stageNegotiation',
  Proposal: 'stageProposal',
  Contract: 'stageContract',
  'Closed Won': 'stageClosedWon',
  'Closed Lost': 'stageClosedLost',
};

const OPP_TYPE_TKEY = {
  Shipment: 'oppTypeShipment',
  'Strategic Project': 'oppTypeStrategicProject',
  'Collection Contract': 'oppTypeCollectionContract',
  'Supply Contract': 'oppTypeSupplyContract',
  Partnership: 'oppTypePartnership',
  'Franchise License': 'oppTypeFranchiseLicense',
  'Bulk Purchase': 'oppTypeBulkPurchase',
  Project: 'oppTypeProject',
  Distribution: 'oppTypeDistribution',
};
import useT from '../i18n/useT';

// --- Status Details Modal (Task / Opportunity) --------------------------------
const StatusDetailsModal = ({ type, itemId, onClose }) => {
  const { currentUser, users, tasks, opportunities, isAdmin, isCEO, lang, addNotification } = useAppContext();
  const t = useT();

  const item = useMemo(() => {
    if (type === 'task') return tasks.find(x => x.id === itemId) || null;
    return (opportunities || []).find(x => x.id === itemId) || null;
  }, [type, itemId, tasks, opportunities]);

  const assignedIds = useMemo(() => {
    if (!item) return [];
    if (type === 'task') return item.employeeId ? [item.employeeId] : [];
    const arr = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
    return arr.filter(Boolean);
  }, [item, type]);

  const canAddUpdate = useMemo(() => {
    if (!item || !currentUser?.id) return false;
    if (isAdmin || isCEO) return true;
    if (type === 'task') return item.employeeId === currentUser.id;
    return assignedIds.includes(currentUser.id);
  }, [item, currentUser?.id, isAdmin, isCEO, type, assignedIds]);

  const canManageUpdates = useMemo(() => isAdmin || isCEO, [isAdmin, isCEO]);

  const rawUpdates = useMemo(() => Array.isArray(item?.statusUpdates) ? item.statusUpdates : [], [item?.statusUpdates]);

  const updates = useMemo(() => {
    const toMs = (ts) => {
      if (!ts) return 0;
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (ts?.seconds != null) return ts.seconds * 1000;
      const d = new Date(ts);
      return isNaN(d) ? 0 : d.getTime();
    };
    return rawUpdates
      .map((u, idx) => ({ ...u, _rawIndex: idx }))
      .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  }, [rawUpdates]);

  const lastUpdate = updates.length ? updates[updates.length - 1] : null;
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    setText('');
    setEditingIndex(null);
    setEditingText('');
  }, [itemId, type]);

  const formatDateTime = (ts) => {
    const ms = ts?.toMillis ? ts.toMillis() : (ts?.seconds != null ? ts.seconds * 1000 : Date.parse(ts));
    if (!ms || Number.isNaN(ms)) return '';
    return new Date(ms).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!item || !text.trim()) return;
    if (!canAddUpdate) return;
    setSaving(true);
    try {
      const collName = type === 'task' ? 'tasks' : 'opportunities';
      const newUpdate = {
        uid: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: text.trim(),
        byId: currentUser.id,
        byName: currentUser.username,
        createdAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, collName, item.id), {
        statusUpdates: arrayUnion(newUpdate)
      });

      // Mention notifications: supports @username and @employeeId
      const mentionTokens = [...new Set((text.match(/@([A-Za-z0-9_.-]+)/g) || []).map(m => m.slice(1).toLowerCase()))];
      const mentionedUserIds = users
        .filter(u => mentionTokens.includes((u.username || '').toLowerCase()) || mentionTokens.includes(getUserEmployeeId(u).toLowerCase()))
        .map(u => u.id)
        .filter(uid => uid && uid !== currentUser.id);
      const title = type === 'task' ? (item.title || t('task')) : (item.client || t('opportunity'));
      for (const uid of [...new Set(mentionedUserIds)]) {
        await addNotification(`${currentUser.username} mentioned you in ${type} "${title}"`, 'info', uid);
      }

      addNotification(t('statusUpdateAdded'), 'success', currentUser.id);
      setText('');
    } catch (err) {
      console.warn('[StatusUpdate]', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (u) => {
    if (!canManageUpdates) return;
    setEditingIndex(u._rawIndex);
    setEditingText(u.text || '');
  };

  const handleSaveEdit = async () => {
    if (!canManageUpdates || editingIndex == null) return;
    const nextText = editingText.trim();
    if (!nextText) return;
    try {
      const collName = type === 'task' ? 'tasks' : 'opportunities';
      const next = [...rawUpdates];
      if (!next[editingIndex]) return;
      next[editingIndex] = {
        ...next[editingIndex],
        text: nextText,
        editedAt: new Date().toISOString(),
        editedById: currentUser.id,
        editedByName: currentUser.username,
      };
      await updateDoc(doc(db, collName, item.id), { statusUpdates: next });
      setEditingIndex(null);
      setEditingText('');
      addNotification(t('saveChanges'), 'success', currentUser.id);
    } catch (err) {
      console.warn('[StatusUpdateEdit]', err);
    }
  };

  const handleDeleteUpdate = async (u) => {
    if (!canManageUpdates) return;
    if (!window.confirm(t('deleteMessage') || 'Delete update?')) return;
    try {
      const collName = type === 'task' ? 'tasks' : 'opportunities';
      const next = rawUpdates.filter((_, idx) => idx !== u._rawIndex);
      await updateDoc(doc(db, collName, item.id), { statusUpdates: next });
      if (editingIndex === u._rawIndex) {
        setEditingIndex(null);
        setEditingText('');
      }
    } catch (err) {
      console.warn('[StatusUpdateDelete]', err);
    }
  };

  if (!item) return null;

  const title = type === 'task' ? (item.title || t('task')) : (item.client || t('opportunity'));
  const stageLabel = (st) => t(STAGE_TKEY[st] || 'stageLead');
  const oppTypeLabel = (ot) => t(OPP_TYPE_TKEY[ot] || 'opportunityType');

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800">{t('statusDetails')}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
              {type === 'task' ? t('task') : t('opportunity')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
          <p className="text-sm font-black text-slate-800 break-words">{title}</p>
          {item.notes && (
            <p className="mt-2 text-xs font-medium text-slate-600 whitespace-pre-wrap break-words">
              {item.notes}
            </p>
          )}
          {type === 'opportunity' && item.source && (
            <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {t('source')}: {item.source}
            </p>
          )}
          {type === 'task' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-white border border-slate-100 text-slate-600">{t('status')}: {item.status}</span>
              <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-white border border-slate-100 text-slate-600">{t('priority')}: {item.priority || t('medium')}</span>
              {item.employee && <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-white border border-slate-100 text-slate-600">{t('assignee')}: {item.employee}</span>}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-white border border-slate-100 text-slate-600">{t('stage')}: {stageLabel(item.stage || 'Lead')}</span>
              {item.opportunityType && <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-white border border-slate-100 text-slate-600">{t('opportunityType')}: {oppTypeLabel(item.opportunityType)}</span>}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('previousUpdates')}</p>
            {lastUpdate && (
              <p className="text-[9px] font-bold text-slate-400">
                {t('lastUpdate')}: {formatDateTime(lastUpdate.createdAt)}
              </p>
            )}
          </div>

          {updates.length === 0 ? (
            <div className="p-4 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400">{t('noUpdatesYet')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {updates.slice().reverse().map((u, idx) => (
                <div key={`${u.byId || 'x'}-${idx}`} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate">
                      {u.byName || users.find(x => x.id === u.byId)?.username || t('employee')}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-[9px] font-bold text-slate-400">{formatDateTime(u.createdAt)}</p>
                      {canManageUpdates && (
                        <>
                          <button onClick={() => handleStartEdit(u)} className="text-[9px] font-black text-indigo-500 hover:text-indigo-700">{t('editTask')}</button>
                          <button onClick={() => handleDeleteUpdate(u)} className="text-[9px] font-black text-red-500 hover:text-red-700">{t('deleteMessage')}</button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingIndex === u._rawIndex ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        rows="3"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-50 outline-none font-bold text-sm border-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest">{t('saveChanges')}</button>
                        <button onClick={() => { setEditingIndex(null); setEditingText(''); }} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">{t('logoutCancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 font-medium mt-1 whitespace-pre-wrap break-words">{u.text}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {canAddUpdate && (
          <form onSubmit={handleAdd} className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('addStatusUpdate')}</p>
            {lastUpdate?.text && (
              <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('continueFrom')}</p>
                <p className="font-medium italic line-clamp-2">"{lastUpdate.text}"</p>
              </div>
            )}
            <textarea
              rows="3"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('typeUpdate')}
              className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800 resize-none text-sm border-none"
            />
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="w-full bg-slate-900 text-white font-black py-3.5 rounded-2xl shadow-xl hover:bg-black disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {saving ? '...' : t('saveUpdate')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// --- Edit Task Modal ----------------------------------------------------------
const EditTaskModal = ({ task, onClose }) => {
  const { currentUser, users, isAdmin, isCEO, addNotification, lang } = useAppContext();
  const t = useT();
  const [form, setForm] = useState({
    title: task.title || '', notes: task.notes || '',
    dueDate: task.dueDate || '', priority: task.priority || 'Medium',
    adminNote: task.adminNote || '', sector: task.sector || '',
    country: task.country || '', amount: task.amount || '',
    currency: task.currency || 'USD',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const updates = {
      title: form.title, notes: form.notes, dueDate: form.dueDate,
      priority: form.priority, sector: form.sector, country: form.country,
      amount: form.amount ? Number(form.amount) : null, currency: form.currency,
    };
    if (isAdmin && form.adminNote && form.adminNote !== task.adminNote) {
      updates.adminNote = form.adminNote;
      if (task.employeeId && task.employeeId !== currentUser.id) {
        await addNotification(`Admin note on "${form.title}": "${form.adminNote}"`, 'info', task.employeeId);
      }
    }
    await updateDoc(doc(db, 'tasks', task.id), updates);
    syncTaskUpdated({ ...task, ...updates }, task.status);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-black text-slate-800">{t('editTask')}</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{task.employee}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><FileText size={10}/> {t('taskName')}</label>
            <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800 text-sm border-none"/>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><MessageSquare size={10}/> {t('notes')}</label>
            <textarea rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800 resize-none text-sm border-none"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><Building2 size={10}/> {t('sector')}</label>
              <select value={form.sector} onChange={e => setForm({...form, sector: e.target.value})}
                className="w-full p-3 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none">
                <option value="">--</option>
                {SECTORS.map(s => <option key={s.id} value={s.name}>{lang === 'ar' ? s.nameAr : s.name}</option>)}
              </select>
            </div>

          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1"><Calendar size={10}/> {t('deadline')}</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}
                className="w-full p-3 rounded-2xl bg-slate-50 border-none outline-none font-bold text-sm"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1"><TrendingUp size={10}/> {t('priority')}</label>
              <div className="flex gap-1">
                {['High','Medium','Low'].map(p => (
                  <button type="button" key={p} onClick={() => setForm({...form, priority: p})}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${form.priority === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}
                  >{p[0]}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><DollarSign size={10}/> {t('addMoney')}</label>
            <div className="flex gap-2">
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                className="flex-1 p-3 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/>
              <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}
                className="w-20 p-3 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ms-1 flex items-center gap-1"><ShieldAlert size={10}/> {t('adminNote')}</label>
              <textarea rows="2" value={form.adminNote} onChange={e => setForm({...form, adminNote: e.target.value})}
                placeholder={lang === 'ar' ? 'اكتب ملاحظة للموظف...' : 'Leave a note for the assignee...'}
                className="w-full p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 outline-none font-bold text-indigo-800 placeholder-indigo-300 resize-none text-sm"/>
            </div>
          )}
          <button type="submit" disabled={saving}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black disabled:opacity-60 transition-all active:scale-[0.98] mt-2">
            {saving ? '...' : t('saveChanges')}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Multi-Select Dropdown Component ──────────────────────────────────────────
const MultiSelectAssignee = ({ users, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedUsers = users.filter(u => selected.includes(u.id));
  const label = selectedUsers.length === 0 ? '--' : selectedUsers.map(u => u.username).join(', ');

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none text-start flex justify-between items-center group">
        <span className="truncate flex-1">{label}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl p-2 max-h-48 overflow-y-auto animate-in zoom-in-95 duration-150">
          {users.map(u => {
            const isSel = selected.includes(u.id);
            return (
              <button key={u.id} type="button" onClick={() => {
                const newArr = isSel ? selected.filter(id => id !== u.id) : [...selected, u.id];
                onChange(newArr);
              }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all mb-0.5 last:mb-0 ${isSel ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="text-xs font-black uppercase tracking-widest">{u.username}</span>
                {isSel && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Edit Opportunity Modal ---------------------------------------------------
const EditOpportunityModal = ({ opp, onClose }) => {
  const { users, lang } = useAppContext();
  const t = useT();
  const stageLabel = (st) => t(STAGE_TKEY[st] || 'stageLead');
  const oppTypeLabel = (ot) => t(OPP_TYPE_TKEY[ot] || 'opportunityType');
  const [form, setForm] = useState({
    sector: opp.sector||'', opportunityType: opp.opportunityType||'', client: opp.client||'',
    country: opp.country||'', source: opp.source||'', estValue: opp.estValue||'',
    currency: opp.currency||'USD',
    assignedTo: Array.isArray(opp.assignedTo) ? opp.assignedTo : (opp.assignedTo ? [opp.assignedTo] : []),
    nextActionDate: opp.nextActionDate||'', 
    notes: opp.notes||'',
  });
  const [saving, setSaving] = useState(false);
  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    await updateDoc(doc(db, 'opportunities', opp.id), { ...form, estValue: form.estValue ? Number(form.estValue) : 0 });
    setSaving(false); onClose();
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-black text-slate-800">{t('opportunity')}</h3>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('sector')}</label>
              <select value={form.sector} onChange={e => setForm({...form, sector: e.target.value})} required className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"><option value="">--</option>{SECTORS.map(s => <option key={s.id} value={s.name}>{lang==='ar'?s.nameAr:s.name}</option>)}</select></div>
            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('opportunityType')}</label>
              <select value={form.opportunityType} onChange={e => setForm({...form, opportunityType: e.target.value})} required className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"><option value="">--</option>{OPPORTUNITY_TYPES.map(ot => <option key={ot} value={ot}>{oppTypeLabel(ot)}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('client')}</label>
              <input required value={form.client} onChange={e => setForm({...form, client: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/></div>
            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('country')}</label>
              <select value={form.country} onChange={e => setForm({...form, country: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"><option value="">--</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>
          </div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('source')}</label>
            <input value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('estValue')}</label>
              <input type="number" min="0" value={form.estValue} onChange={e => setForm({...form, estValue: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none" placeholder="0"/></div>
            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('currency')}</label>
              <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('assignee')}</label>
            <MultiSelectAssignee users={users} selected={form.assignedTo} onChange={(newArr) => setForm({...form, assignedTo: newArr})} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('nextActionDate')}</label>
              <input type="date" value={form.nextActionDate} onChange={e => setForm({...form, nextActionDate: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/></div>
          </div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('notes')}</label>
            <textarea rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none resize-none"/></div>
          <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-emerald-700 disabled:opacity-60 transition-all active:scale-[0.98] mt-2">
            {saving ? '...' : t('saveChanges')}</button>
        </form>
      </div>
    </div>
  );
};

// --- Main TaskEngine ----------------------------------------------------------
const TaskEngine = () => {
  const { currentUser, users, tasks, opportunities, isAdmin, isCEO, addNotification, lang, smartInsights } = useAppContext();
  const [smartToast, setSmartToast] = useState(null);
  const t = useT();
  const stageLabel = (st) => t(STAGE_TKEY[st] || 'stageLead');
  const oppTypeLabel = (ot) => t(OPP_TYPE_TKEY[ot] || 'opportunityType');
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState('tasks');
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [createMode, setCreateMode] = useState('task');
  const [editingTask, setEditingTask] = useState(null);
  const [editingOpp, setEditingOpp] = useState(null);
  const [statusModal, setStatusModal] = useState(null); // { type: 'task'|'opportunity', id: string }
  const [formData, setFormData] = useState({ 
    title: '', notes: '', dueDate: '', assignedUserId: '', priority: 'Medium', 
    taskType: 'standard', sector: '', country: '', amount: '', currency: 'USD'
  });
  const [oppForm, setOppForm] = useState({
    sector: '', opportunityType: '', client: '', country: '', source: '',
    estValue: '', currency: 'USD', stage: 'Lead', probability: '',
    assignedTo: [], nextActionDate: '', status: 'Active', notes: ''
  });
  const [showAttachAfterCreate, setShowAttachAfterCreate] = useState(false);
  const [pendingAttachId, setPendingAttachId] = useState(null);
  const [pendingAttachType, setPendingAttachType] = useState('task'); // 'task' | 'opportunity'
  const taskFileInputRef = React.useRef(null);

  useEffect(() => {
    setStatusFilter('all');
  }, [viewMode]);

  const getTaskTrackingStatus = (task) => {
    if (!task.dueDate) return null;
    const due = new Date(task.dueDate).getTime();
    if (task.status === 'completed') {
      const completedAt = task.completedAt?.toMillis ? task.completedAt.toMillis() : Date.now();
      return completedAt <= due ? t('onTime') : t('late');
    }
    return Date.now() > due ? t('overdue') : null;
  };

  const visibleTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task._archived) return false;
      if (isAdmin || isCEO) return true;
      // User sees only tasks assigned to them
      if (task.employeeId === currentUser.id) return true;
      return false;
    }).filter(task => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'bonus') return task.taskType === 'bonus';
      return task.status === statusFilter;
    }).filter(task => {
      if (!sectorFilter) return true;
      if (sectorFilter === '_payments') return task.amount && Number(task.amount) > 0;
      return task.sector === sectorFilter;
    });
  }, [tasks, statusFilter, sectorFilter, isAdmin, isCEO, currentUser]);

  const visibleOpps = useMemo(() => {
    return (opportunities || []).filter(opp => {
      if (opp._archived) return false;
      if (!isAdmin && !isCEO) {
        const assignedIds = Array.isArray(opp.assignedTo) ? opp.assignedTo : (opp.assignedTo ? [opp.assignedTo] : []);
        if (!assignedIds.includes(currentUser.id)) return false;
      }
      if (!sectorFilter) return true;
      if (sectorFilter === '_payments') return opp.estValue && Number(opp.estValue) > 0;
      return opp.sector === sectorFilter;
    }).filter(opp => {
      if (statusFilter === 'all') return true;
      const stage = opp.stage || 'Lead';
      return opp.status === statusFilter || stage === statusFilter;
    });
  }, [opportunities, statusFilter, sectorFilter]);

  const miniStats = useMemo(() => {
    const myTasks = isAdmin ? tasks : tasks.filter(t => t.employeeId === currentUser.id);
    const total = myTasks.length;
    const completed = myTasks.filter(t => t.status === 'completed').length;
    const inProg = myTasks.filter(t => t.status === 'in progress').length;
    const pending = myTasks.filter(t => t.status === 'pending').length;
    const overdue = myTasks.filter(t => { if (!t.dueDate || t.status === 'completed') return false; return new Date(t.dueDate) < new Date(); }).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    const oppArr = opportunities || [];
    const totalPipelineValue = oppArr.reduce((s, o) => s + (o.estValue || 0), 0);
    // Profit: sum of money from completed tasks + completed/won opportunities
    const profitByCurrency = {};
    const payments = myTasks.filter(t => t.amount && Number(t.amount) > 0).length + oppArr.filter(o => o.estValue && Number(o.estValue) > 0).length;
    myTasks.filter(t => t.status === 'completed' && t.amount).forEach(t => {
      const cur = t.currency || 'USD';
      profitByCurrency[cur] = (profitByCurrency[cur] || 0) + Number(t.amount);
    });
    oppArr.filter(o => o.status === 'Closed Won' || o.stage === 'Closed Won').forEach(o => {
      if (o.estValue) {
        const cur = o.currency || 'USD';
        profitByCurrency[cur] = (profitByCurrency[cur] || 0) + Number(o.estValue);
      }
    });
    const profitEntries = Object.entries(profitByCurrency);
    const totalProfit = profitEntries.reduce((s, [, v]) => s + v, 0);
    const mainCurrency = profitEntries.length > 0 ? profitEntries.sort((a, b) => b[1] - a[1])[0][0] : 'USD';
    return { total, completed, inProg, pending, overdue, pct, totalPipelineValue, oppCount: oppArr.length, totalProfit, mainCurrency, profitByCurrency, payments };
  }, [tasks, opportunities, isAdmin, currentUser]);

  const createTask = async (e) => {
    e.preventDefault();
    let assignedUser = currentUser;
    if (isAdmin && formData.assignedUserId) {
      assignedUser = users.find(u => u.id === formData.assignedUserId) || currentUser;
    }
    const isBonus = formData.taskType === 'bonus';
    const newTask = {
      title: formData.title, notes: formData.notes,
      employee: isBonus ? 'Open to Claim' : assignedUser.username,
      employeeId: isBonus ? null : assignedUser.id,
      creatorId: currentUser.id, status: 'pending',
      priority: formData.priority || 'Medium', dueDate: formData.dueDate,
      taskType: formData.taskType, sector: formData.sector || null,
      country: formData.country || null,
      amount: formData.amount ? Number(formData.amount) : null,
      currency: formData.currency || 'USD', createdAt: serverTimestamp(),
      statusUpdates: [],
    };
    const ref = await addDoc(collection(db, 'tasks'), newTask);
    syncTaskCreated({ ...newTask, id: ref.id });
    if (!isBonus && assignedUser.email && assignedUser.id !== currentUser.id) {
      sendTaskAssignmentEmail({ toEmail: assignedUser.email, toName: assignedUser.username, taskTitle: formData.title, taskNotes: formData.notes, dueDate: formData.dueDate, priority: formData.priority, assignedBy: currentUser.username }).catch(() => {});
    }
    // If task has money, show attachment popup
    if (formData.amount && Number(formData.amount) > 0) {
      setPendingAttachId(ref.id);
      setPendingAttachType('task');
      setShowAttachAfterCreate(true);
    }
    setFormData({ title: '', notes: '', dueDate: '', assignedUserId: '', priority: 'Medium', taskType: 'standard', sector: '', country: '', amount: '', currency: 'USD' });
    setIsTaskDrawerOpen(false);
    if (isBonus) { addNotification('New Bonus Task available!', 'info', 'all'); }
    else if (assignedUser.id !== currentUser.id) { addNotification(`New task: "${formData.title}"`, 'info', assignedUser.id); }
  };

  const createOpportunity = async (e) => {
    e.preventDefault();
    const oppRef = await addDoc(collection(db, 'opportunities'), {
      ...oppForm, estValue: oppForm.estValue ? Number(oppForm.estValue) : 0,
      probability: oppForm.probability ? Number(oppForm.probability) : 0,
      creatorId: currentUser.id, createdAt: serverTimestamp(),
      statusUpdates: [],
    });
    // If opportunity has money, show attachment popup
    if (oppForm.estValue && Number(oppForm.estValue) > 0) {
      setPendingAttachId(oppRef.id);
      setPendingAttachType('opportunity');
      setShowAttachAfterCreate(true);
    }
    setOppForm({ sector: '', opportunityType: '', client: '', country: '', source: '', estValue: '', currency: 'USD', stage: 'Lead', probability: '', assignedTo: [], nextActionDate: '', status: 'Active', notes: '' });
    setIsTaskDrawerOpen(false);
    addNotification(`Opportunity "${oppForm.client}" added.`, 'info', 'admin');
  };

  const claimBonusTask = async (task) => {
    if (task.status !== 'pending' || task.employeeId) return;
    await updateDoc(doc(db, 'tasks', task.id), { employee: currentUser.username, employeeId: currentUser.id, status: 'in progress' });
    addNotification(`Bonus claimed by ${currentUser.username}!`, 'info', 'all');
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    const updates = { status: newStatus };
    if (newStatus === 'completed') updates.completedAt = serverTimestamp();
    await updateDoc(doc(db, 'tasks', taskId), updates);
    syncTaskUpdated(task, newStatus);
    if (newStatus === 'completed') {
      addNotification('Task completed!', 'success', task.employeeId);
      if (task.employeeId !== currentUser.id) addNotification(`"${task.title}" completed by ${currentUser.username}`, 'success', 'admin');

      // Smart: Check if completed before deadline
      if (task.dueDate) {
        const due = new Date(task.dueDate).getTime();
        if (Date.now() < due) {
          const daysEarly = Math.round((due - Date.now()) / (1000 * 60 * 60 * 24));
          setSmartToast({ type: 'success', message: `Completed ${daysEarly} day${daysEarly !== 1 ? 's' : ''} early! Will auto-archive in 2 hours.` });
          setTimeout(() => setSmartToast(null), 5000);
        }
      }

      // Smart: Streak notification
      const userId = task.employeeId || currentUser.id;
      const streak = (smartInsights?.streaks?.[userId] || 0) + 1;
      if (streak >= 5 && streak % 5 === 0) {
        addNotification(`${currentUser.username} is on a ${streak}-task streak!`, 'success', 'all');
      }
    }
  };

  const updateOpportunityStage = async (oppId, stage) => {
    const updates = { stage };
    if (stage === 'Closed Won' || stage === 'Closed Lost') updates.status = stage;
    else updates.status = 'Active';
    await updateDoc(doc(db, 'opportunities', oppId), updates);
  };

  const deleteTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !window.confirm(`Delete "${task.title}"?`)) return;
    await deleteDoc(doc(db, 'tasks', taskId));
    syncTaskDeleted(task);
  };

  const deleteOpp = async (oppId) => {
    const opp = (opportunities||[]).find(o => o.id === oppId);
    if (!opp || !window.confirm(`Delete "${opp.client}"?`)) return;
    await deleteDoc(doc(db, 'opportunities', oppId));
  };

  const FILTER_LABELS = { all: t('all'), pending: t('pending'), 'in progress': t('inProgress'), completed: t('completed'), bonus: t('bonus') };
  const STAGE_COLORS = { Lead:'bg-blue-50 text-blue-600', Qualified:'bg-cyan-50 text-cyan-600', Negotiation:'bg-amber-50 text-amber-600', Proposal:'bg-violet-50 text-violet-600', Contract:'bg-emerald-50 text-emerald-600', 'Closed Won':'bg-green-100 text-green-700', 'Closed Lost':'bg-red-50 text-red-500' };
  const canSeeManagementInsights = isAdmin || isCEO;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Smart Toast */}
      {smartToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2 animate-in slide-in-from-top-4 duration-300 ${smartToast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
          <CheckCircle2 size={16}/> {smartToast.message}
          <button onClick={() => setSmartToast(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14}/></button>
        </div>
      )}

      {/* Smart Insights Bar */}
      {smartInsights && (smartInsights.urgentDeadlines?.length > 0 || smartInsights.archivedTasks > 0) && (
        <div className="flex flex-wrap gap-2">
          {smartInsights.urgentDeadlines?.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl">
              <Clock size={12}/>
              <span className="text-[10px] font-black uppercase tracking-widest">{smartInsights.urgentDeadlines.length} deadline{smartInsights.urgentDeadlines.length !== 1 ? 's' : ''} in 48h</span>
            </div>
          )}
          {canSeeManagementInsights && smartInsights.archivedTasks > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl">
              <CheckCircle2 size={12}/>
              <span className="text-[10px] font-black uppercase tracking-widest">{smartInsights.archivedTasks} auto-archived</span>
            </div>
          )}
          {canSeeManagementInsights && smartInsights.topPerformer && (
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl">
              <Star size={12}/>
              <span className="text-[10px] font-black uppercase tracking-widest">Top: {smartInsights.topPerformer.username} ({smartInsights.topPerformer.completed})</span>
            </div>
          )}
          {currentUser && smartInsights.streaks?.[currentUser.id] >= 3 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl">
              <TrendingUp size={12}/>
              <span className="text-[10px] font-black uppercase tracking-widest">Streak: {smartInsights.streaks[currentUser.id]} days</span>
            </div>
          )}
        </div>
      )}

      {/* Overview Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-indigo-500"/>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Overview</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <div><p className="text-2xl md:text-3xl font-black text-slate-900 leading-none">{miniStats.total}</p><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('total')}</p></div>
          <div><p className="text-2xl md:text-3xl font-black text-amber-500 leading-none">{miniStats.pending}</p><p className="text-[8px] md:text-[10px] font-black text-amber-400 uppercase tracking-widest mt-1">{t('pending')}</p></div>
          <div><p className="text-2xl md:text-3xl font-black text-indigo-500 leading-none">{miniStats.inProg}</p><p className="text-[8px] md:text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">{t('inProgress')}</p></div>
          <div><p className="text-2xl md:text-3xl font-black text-emerald-500 leading-none">{miniStats.completed}</p><p className="text-[8px] md:text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">{t('completed')}</p></div>
          <div><p className="text-2xl md:text-3xl font-black text-violet-500 leading-none">{miniStats.payments}</p><p className="text-[8px] md:text-[10px] font-black text-violet-400 uppercase tracking-widest mt-1">{t('payments')}</p></div>
        </div>
        <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{width:`${miniStats.pct}%`}}/></div>
        {miniStats.overdue > 0 && <div className="mt-3 inline-flex items-center gap-1.5 bg-red-50 text-red-500 px-3 py-1.5 rounded-xl"><AlertCircle size={12}/><span className="text-[10px] font-black uppercase tracking-widest">{miniStats.overdue} Overdue</span></div>}
      </div>

      {/* View Toggle & Filters */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800">{t('missionControl')}</h2>
          <div className="flex gap-1.5">
            <button onClick={() => setViewMode('tasks')} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode==='tasks'?'bg-indigo-600 text-white shadow-md':'bg-white text-slate-400 border border-slate-100'}`}>{t('tasks')}</button>
            <button onClick={() => setViewMode('opportunities')} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode==='opportunities'?'bg-emerald-600 text-white shadow-md':'bg-white text-slate-400 border border-slate-100'}`}>{t('opportunity')}</button>
          </div>
        </div>
        {/* Status Filter + Sector Filter -- Same Row */}
        <div className="flex items-center gap-2">
          {viewMode === 'tasks' && (
            <div className="flex gap-1.5 overflow-x-auto flex-1" style={{scrollbarWidth:'none'}}>
              {['all','pending','in progress','completed','bonus'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 transition-all flex items-center gap-1 ${statusFilter===f?'bg-indigo-600 text-white shadow-md':'bg-white text-slate-400 border border-slate-100'}`}>
                  {f==='bonus' && <Star size={11}/>}
                  {f==='all' ? t('all') : f==='bonus' ? t('bonus') : FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          )}
          {viewMode === 'opportunities' && (
            <div className="flex gap-1.5 overflow-x-auto flex-1" style={{scrollbarWidth:'none'}}>
              <button type="button" onClick={() => setStatusFilter('all')}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 transition-all ${statusFilter==='all'?'bg-emerald-600 text-white shadow-md':'bg-white text-slate-400 border border-slate-100'}`}>
                {t('all')}
              </button>
              {PIPELINE_STAGES.map((st) => (
                <button key={st} type="button" onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight whitespace-nowrap shrink-0 transition-all ${statusFilter===st?'bg-emerald-600 text-white shadow-md':'bg-white text-slate-400 border border-slate-100'}`}>
                  {stageLabel(st)}
                </button>
              ))}
            </div>
          )}
          {/* Sector Filter -- Icon Only */}
          <div className="relative shrink-0">
            <button onClick={() => setFilterMenuOpen(!filterMenuOpen)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${sectorFilter ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100 shadow-sm hover:bg-slate-50'}`} title={sectorFilter || t('allSectors')}>
              <Menu size={18}/>
            </button>
            {filterMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setFilterMenuOpen(false)}/>
                <div className="fixed md:absolute bottom-0 md:bottom-auto md:top-full left-0 right-0 md:left-auto md:right-0 md:mt-1 md:end-0 bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-slate-100 py-3 z-50 md:min-w-[220px] max-h-[60vh] md:max-h-[50vh] overflow-y-auto overscroll-contain" style={{scrollbarWidth:'thin',scrollbarColor:'#cbd5e1 transparent',WebkitOverflowScrolling:'touch'}}>
                  <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2 md:hidden"/>
                  <button onClick={() => { setSectorFilter(''); setFilterMenuOpen(false); }}
                    className={`w-full px-4 py-2.5 text-start text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${!sectorFilter?'bg-indigo-50 text-indigo-600':'text-slate-500 hover:bg-slate-50'}`}>
                    <Layers size={12}/> {t('allSectors')}
                  </button>
                  {SECTORS.map(s => (
                    <button key={s.id} onClick={() => { setSectorFilter(s.name); setFilterMenuOpen(false); }}
                      className={`w-full px-4 py-2.5 text-start text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${sectorFilter===s.name?'bg-indigo-50 text-indigo-600':'text-slate-500 hover:bg-slate-50'}`}>
                      <Building2 size={12}/> {lang==='ar'?s.nameAr:s.name}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 my-1"/>
                  <button onClick={() => { setSectorFilter('_payments'); setFilterMenuOpen(false); }}
                    className={`w-full px-4 py-2.5 text-start text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${sectorFilter==='_payments'?'bg-violet-50 text-violet-600':'text-slate-500 hover:bg-slate-50'}`}>
                    <DollarSign size={12}/> {t('payments')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Task Grid */}
      {viewMode === 'tasks' && (
        visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center mb-4"><Inbox className="text-slate-200" size={40}/></div>
            <h3 className="text-lg font-black text-slate-800">{t('noTasks')}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleTasks.map(task => {
              const isAssignedToMe = task.employeeId === currentUser.id;
              const isUnclaimedBonus = task.taskType === 'bonus' && !task.employeeId;
              const canChangeStatus = isAdmin || isAssignedToMe;
              const canEdit = isAdmin;
              const tracking = getTaskTrackingStatus(task);
              return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setStatusModal({ type: 'task', id: task.id })}
                  onKeyDown={(e) => { if (e.key === 'Enter') setStatusModal({ type: 'task', id: task.id }); }}
                  className={`p-4 md:p-5 rounded-[1.5rem] border relative overflow-hidden transition-all cursor-pointer ${task.taskType==='bonus'&&task.status==='pending'?'bg-amber-50 border-amber-200':'bg-white border-slate-100 shadow-sm hover:shadow-md'}`}
                >
                  <div className={`absolute top-0 start-0 w-1 h-full ${task.status==='completed'?'bg-emerald-400':task.status==='in progress'?'bg-indigo-400':task.taskType==='bonus'?'bg-amber-400':'bg-slate-200'}`}/>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${task.priority==='High'?'bg-red-50 text-red-500':task.priority==='Medium'?'bg-amber-50 text-amber-500':'bg-blue-50 text-blue-500'}`}>{task.priority||'Med'}</span>
                      {task.sector && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-violet-50 text-violet-500 flex items-center gap-1"><Layers size={10}/> {task.sector.split(' ')[0]}</span>}
                      {task.country && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-slate-100 text-slate-500">{task.country}</span>}
                      {task.taskType==='bonus' && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-yellow-400 text-white flex items-center gap-1"><Star size={10}/></span>}
                      {tracking && <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1 ${tracking===t('onTime')?'bg-emerald-100 text-emerald-600':'bg-rose-100 text-rose-600'}`}>{tracking===t('onTime')?<CheckCircle2 size={10}/>:<AlertCircle size={10}/>} {tracking}</span>}
                    </div>
                    <div className="flex gap-1.5 items-center shrink-0">
                      <span className="text-[9px] font-black uppercase text-indigo-600 px-1.5 py-0.5 bg-indigo-50 rounded-lg truncate max-w-[80px]">{task.employee}</span>
                      {isAdmin && canEdit && <button onClick={(e) => { e.stopPropagation(); setEditingTask(task); }} className="p-1.5 text-slate-300 hover:text-indigo-500 rounded-lg hover:bg-indigo-50"><Pencil size={14}/></button>}
                      {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14}/></button>}
                    </div>
                  </div>
                  <h4 className="text-base md:text-lg font-black text-slate-800 mb-1.5 leading-snug">{task.title}</h4>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setStatusModal({ type: 'task', id: task.id }); }}
                    className="mb-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                  >
                    {t('statusDetails')}
                  </button>
                  {task.notes && <p className="text-sm text-slate-400 mb-1.5 italic line-clamp-2">"{task.notes}"</p>}
                  {task.adminNote && <div className="my-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Admin</p><p className="text-sm text-indigo-700 font-medium">{task.adminNote}</p></div>}
                  <div className="flex items-center gap-3 mb-3">
                    {task.dueDate && <p className="text-xs font-bold text-slate-400 flex items-center gap-1"><Calendar size={12}/> {new Date(task.dueDate).toLocaleDateString()}</p>}
                    {task.amount && <p className="text-xs font-bold text-emerald-600 flex items-center gap-1"><DollarSign size={12}/> {Number(task.amount).toLocaleString()} {task.currency||'USD'}</p>}
                  </div>
                  {isUnclaimedBonus ? (
                    <button onClick={(e) => { e.stopPropagation(); claimBonusTask(task); }} className="w-full py-2.5 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all active:scale-95">{t('claimBonus')}</button>
                  ) : (
                    <div className="flex gap-1.5 mt-1">
                      {[{key:'pending',label:t('pending')},{key:'in progress',label:t('inProgress')},{key:'completed',label:t('completed')}].map(s => (
                        <button key={s.key} onClick={(e) => { e.stopPropagation(); canChangeStatus && updateTaskStatus(task.id, s.key); }}
                          className={`flex-1 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all ${task.status===s.key?'bg-slate-900 text-white shadow-lg':`bg-slate-50 text-slate-400 ${canChangeStatus?'hover:bg-slate-100':'opacity-50 cursor-not-allowed'}`}`}>{s.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Opportunities Grid */}
      {viewMode === 'opportunities' && (
        visibleOpps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center mb-4"><Target className="text-slate-200" size={40}/></div>
            <h3 className="text-lg font-black text-slate-800">{t('noOpportunities')}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleOpps.map(opp => {
              const assignedIds = Array.isArray(opp.assignedTo) ? opp.assignedTo : (opp.assignedTo ? [opp.assignedTo] : []);
              const canChangeOppStage = isAdmin || isCEO || assignedIds.includes(currentUser.id);
              const currentStage = opp.stage || 'Lead';
              return (
                <div
                  key={opp.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setStatusModal({ type: 'opportunity', id: opp.id })}
                  onKeyDown={(e) => { if (e.key === 'Enter') setStatusModal({ type: 'opportunity', id: opp.id }); }}
                  className="p-4 md:p-5 rounded-[1.5rem] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
                >
                  <div className={`absolute top-0 start-0 w-1 h-full ${opp.status==='Closed Won'||currentStage==='Closed Won'?'bg-green-400':opp.status==='Closed Lost'||currentStage==='Closed Lost'?'bg-red-400':'bg-emerald-400'}`}/>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-wrap gap-1.5">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${STAGE_COLORS[currentStage]||'bg-slate-50 text-slate-400'}`}>{stageLabel(currentStage)}</span>
                      {opp.sector && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-violet-50 text-violet-500 flex items-center gap-1"><Layers size={10}/> {opp.sector.split(' ')[0]}</span>}
                      {opp.country && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-slate-100 text-slate-500">{opp.country}</span>}
                      {opp.probability > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-blue-50 text-blue-500">{opp.probability}%</span>}
                    </div>
                    <div className="flex gap-1.5 items-center shrink-0">
                      {isAdmin && <><button onClick={(e) => { e.stopPropagation(); setEditingOpp(opp); }} className="p-1.5 text-slate-300 hover:text-emerald-500 rounded-lg hover:bg-emerald-50"><Pencil size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteOpp(opp.id); }} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14}/></button></>}
                    </div>
                  </div>
                  <h4 className="text-base md:text-lg font-black text-slate-800 mb-1.5 leading-snug">{opp.client}</h4>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setStatusModal({ type: 'opportunity', id: opp.id }); }}
                    className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-800"
                  >
                    {t('statusDetails')}
                  </button>
                  <p className="text-[10px] text-slate-400 font-bold mb-1">{oppTypeLabel(opp.opportunityType)}{opp.source ? ` - ${opp.source}` : ''}</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    {opp.estValue > 0 && <p className="text-sm font-black text-emerald-600 flex items-center gap-0.5"><DollarSign size={12}/> {Number(opp.estValue).toLocaleString()} {opp.currency}</p>}
                    <div className="flex flex-wrap gap-1">
                      {assignedIds.map(uid => {
                        const u = users.find(x => x.id === uid);
                        return u ? <span key={uid} className="text-[8px] font-black uppercase text-indigo-600 px-1.5 py-0.5 bg-indigo-50 rounded">{u.username}</span> : null;
                      })}
                    </div>
                  </div>
                  {opp.notes && <p className="text-[10px] text-slate-400 italic line-clamp-1">"{opp.notes}"</p>}
                  {opp.nextActionDate && <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-1"><Calendar size={9}/> Next: {new Date(opp.nextActionDate).toLocaleDateString()}</p>}
                  <div className="mt-3 pt-3 border-t border-slate-50">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{t('pipeline')}</label>
                    <select
                      value={currentStage}
                      disabled={!canChangeOppStage}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateOpportunityStage(opp.id, e.target.value)}
                      className={`w-full p-2.5 rounded-xl text-xs font-bold bg-slate-50 border border-transparent outline-none focus:ring-2 focus:ring-emerald-500/20 ${!canChangeOppStage ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {PIPELINE_STAGES.map((st) => (
                        <option key={st} value={st}>{stageLabel(st)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* FAB -- Admin/CEO only */}
      {isAdmin && (
        <button onClick={() => { setIsTaskDrawerOpen(true); setCreateMode(viewMode==='opportunities'?'opportunity':'task'); }}
          className={`fixed end-4 md:end-6 w-14 h-14 md:w-16 md:h-16 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-all ring-4 ring-[#F8FAFC] ${viewMode==='opportunities'?'bg-emerald-600 text-white shadow-emerald-400':'bg-indigo-600 text-white shadow-indigo-400'}`}
          style={{ bottom: 'calc(var(--app-safe-bottom) + 5rem)' }}>
          <Plus size={28} strokeWidth={3}/>
        </button>
      )}

      {/* Create Modal */}
      {isTaskDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsTaskDrawerOpen(false)}/>
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-5 md:p-6 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div><h3 className="text-lg font-black text-slate-900">{t('createNew')}</h3><p className="text-[10px] text-slate-400 font-bold mt-0.5">{t('createNewRecord')}</p></div>
              <button onClick={() => setIsTaskDrawerOpen(false)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900"><X size={18}/></button>
            </div>
            {/* Toggle */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setCreateMode('task')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${createMode==='task'?'bg-indigo-600 text-white shadow-md':'bg-slate-50 text-slate-400'}`}><Briefcase size={12}/> {t('task')}</button>
              <button onClick={() => setCreateMode('opportunity')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${createMode==='opportunity'?'bg-emerald-600 text-white shadow-md':'bg-slate-50 text-slate-400'}`}><Target size={12}/> {t('opportunity')}</button>
            </div>

            {createMode === 'task' ? (
              <form onSubmit={createTask} className="space-y-3">
                {isAdmin && <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1">Task Type</label>
                  <div className="flex gap-1.5">{[{id:'standard',label:t('standard')},{id:'bonus',label:t('bonusPool')},{id:'restricted',label:t('ceoRestricted')}].map(type => (
                    <button type="button" key={type.id} onClick={() => setFormData({...formData, taskType: type.id, assignedUserId: type.id==='bonus'?'':formData.assignedUserId})}
                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.taskType===type.id?'bg-slate-900 text-white shadow-md':'bg-slate-50 text-slate-400'}`}>{type.label}</button>
                  ))}</div></div>}
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><FileText size={9}/> {t('taskName')}</label>
                  <input required placeholder="E.g. Project Review" className="w-full p-3 rounded-2xl bg-slate-50 border-none outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800 text-sm" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}/></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('notes')}</label>
                  <textarea rows="2" placeholder="Optional context..." className="w-full p-3 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-800 resize-none text-sm" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}/></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><Building2 size={9}/> {t('sector')}</label>
                  <select value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} className="w-full p-3 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"><option value="">--</option>{SECTORS.map(s => <option key={s.id} value={s.name}>{lang==='ar'?s.nameAr:s.name}</option>)}</select></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('priority')}</label>
                  <div className="flex gap-1.5">{['High','Medium','Low'].map(p => (
                    <button type="button" key={p} onClick={() => setFormData({...formData, priority: p})} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.priority===p?'bg-indigo-600 text-white shadow-md':'bg-slate-50 text-slate-400'}`}>{p}</button>
                  ))}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><Calendar size={9}/> {t('deadline')}</label>
                    <input type="date" required className="w-full p-3 rounded-2xl bg-slate-50 border-none outline-none font-bold text-sm" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})}/></div>
                  {isAdmin && formData.taskType !== 'bonus' && <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><Users size={9}/> {t('assignee')}</label>
                    <select required className="w-full p-3 rounded-2xl bg-slate-50 border-none outline-none font-bold text-sm" value={formData.assignedUserId} onChange={e => setFormData({...formData, assignedUserId: e.target.value})}><option value="" disabled>{t('selectEmployee')}</option>{users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}</select></div>}
                </div>
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ms-1 flex items-center gap-1"><DollarSign size={9}/> {t('addMoney')}</label>
                  <div className="flex gap-2"><input type="number" min="0" step="0.01" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="flex-1 p-3 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/>
                    <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-20 p-3 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                <button className="w-full bg-slate-900 text-white font-black py-3.5 rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 text-sm"><Plus size={16}/> {t('confirmTask')}</button>
              </form>
            ) : (
              <form onSubmit={createOpportunity} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('sector')}</label>
                    <select value={oppForm.sector} onChange={e => setOppForm({...oppForm, sector: e.target.value})} required className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"><option value="">--</option>{SECTORS.map(s => <option key={s.id} value={s.name}>{lang==='ar'?s.nameAr:s.name}</option>)}</select></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('opportunityType')}</label>
                    <select value={oppForm.opportunityType} onChange={e => setOppForm({...oppForm, opportunityType: e.target.value})} required className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"><option value="">--</option>{OPPORTUNITY_TYPES.map(ot => <option key={ot} value={ot}>{oppTypeLabel(ot)}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('client')}</label>
                    <input required value={oppForm.client} onChange={e => setOppForm({...oppForm, client: e.target.value})} placeholder="Client name..." className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('country')}</label>
                    <select value={oppForm.country} onChange={e => setOppForm({...oppForm, country: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"><option value="">--</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>
                </div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('source')}</label>
                  <input value={oppForm.source} onChange={e => setOppForm({...oppForm, source: e.target.value})} placeholder={t('source')} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('estValue')}</label>
                    <input type="number" min="0" value={oppForm.estValue} onChange={e => setOppForm({...oppForm, estValue: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none" placeholder="0"/></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('currency')}</label>
                    <select value={oppForm.currency} onChange={e => setOppForm({...oppForm, currency: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('assignee')}</label>
                  <MultiSelectAssignee users={users} selected={oppForm.assignedTo} onChange={(newArr) => setOppForm({...oppForm, assignedTo: newArr})} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('nextActionDate')}</label>
                    <input type="date" value={oppForm.nextActionDate} onChange={e => setOppForm({...oppForm, nextActionDate: e.target.value})} className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none"/></div>
                </div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">{t('notes')}</label>
                  <textarea rows="2" value={oppForm.notes} onChange={e => setOppForm({...oppForm, notes: e.target.value})} placeholder="Additional notes..." className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-none resize-none"/></div>
                <button className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-2xl shadow-xl hover:bg-emerald-700 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 text-sm"><Plus size={16}/> Add Opportunity</button>
              </form>
            )}
          </div>
        </div>
      )}

      {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)}/>}
      {editingOpp && <EditOpportunityModal opp={editingOpp} onClose={() => setEditingOpp(null)}/>}
      {statusModal && (
        <StatusDetailsModal
          type={statusModal.type}
          itemId={statusModal.id}
          onClose={() => setStatusModal(null)}
        />
      )}

      {/* Attachment Popup -- shown after creating task/opportunity with money */}
      {showAttachAfterCreate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAttachAfterCreate(false)}/>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">{t('addAttachment') || 'Add Attachment'}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {pendingAttachType === 'task' ? t('task') : t('opportunity')} -- {t('withMoney') || 'With Payment'}
                </p>
              </div>
              <button onClick={() => setShowAttachAfterCreate(false)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-5">{t('attachFileHint') || 'Upload an invoice, receipt, or supporting document for this payment.'}</p>
            <input ref={taskFileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5MB.'); return; }
              const reader = new FileReader();
              reader.onload = async () => {
                const collName = pendingAttachType === 'task' ? 'tasks' : 'opportunities';
                await updateDoc(doc(db, collName, pendingAttachId), {
                  attachment: { name: file.name, size: file.size, type: file.type, data: reader.result }
                });
                addNotification('Attachment uploaded successfully!', 'success', currentUser.id);
                setShowAttachAfterCreate(false);
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}/>
            <div className="space-y-3">
              <button onClick={() => taskFileInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition-all">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center"><FileText size={20} className="text-indigo-600"/></div>
                <div className="text-start"><p className="text-sm font-black text-indigo-700">{t('uploadFile') || 'Upload File'}</p><p className="text-[10px] text-indigo-400 font-bold">PDF, DOC, XLS, Image (max 5MB)</p></div>
              </button>
              <button onClick={() => setShowAttachAfterCreate(false)}
                className="w-full p-3 text-center text-sm font-bold text-slate-400 hover:text-slate-600 transition-all">
                {t('skipForNow') || 'Skip for now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskEngine;
