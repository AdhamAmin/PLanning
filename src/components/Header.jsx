import React, { useState, useRef, useEffect } from 'react';
import {
  Globe, RefreshCw, Briefcase, ShieldCheck, Bell, LogOut,
  X, UserPlus, Copy, Check, Mail, Loader2, Menu, Shield, Pencil, Phone, User, Hash, Save
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { PROTECTED_IDS } from '../archive/db';
import useT from '../i18n/useT';
import { sendCredentialsEmail } from '../services/emailService';
import { getUserEmployeeId, normalizeEmployeeId, userMatchesEmployeeId } from '../utils/userIdentity';

// ─── Logout Confirm Modal ─────────────────────────────────────────────────────
const LogoutConfirm = ({ onConfirm, onCancel, t }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onCancel}/>
    <div className="bg-white rounded-[2rem] p-8 shadow-2xl relative w-full max-w-sm animate-in zoom-in-95 duration-200 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4"><LogOut size={28} className="text-red-500"/></div>
      <h3 className="text-lg font-black text-slate-800 mb-2">{t('logoutConfirm')}</h3>
      <div className="flex gap-3 mt-6">
        <button onClick={onCancel} className="flex-1 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest bg-slate-50 rounded-2xl hover:bg-slate-100">{t('logoutCancel')}</button>
        <button onClick={onConfirm} className="flex-1 py-3 font-black text-white bg-red-500 rounded-2xl hover:bg-red-600 uppercase text-[10px] tracking-widest shadow-md shadow-red-200">{t('logoutYes')}</button>
      </div>
    </div>
  </div>
);

// ─── Profile Popup with Edit ──────────────────────────────────────────────────
const ProfilePopup = ({ onClose, onLogoutRequest, t }) => {
  const { currentUser, updateUserProfile, addNotification } = useAppContext();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    username: currentUser.username || '',
    employeeId: getUserEmployeeId(currentUser),
    email: currentUser.email || '',
    phone: currentUser.phone || '',
    nickname: currentUser.nickname || currentUser.username || ''
  });
  const [notifEnabled, setNotifEnabled] = useState(true);

  const handleSave = async () => {
    if (!editForm.username.trim() || !editForm.employeeId.trim()) return;
    setSaving(true);
    const updates = {
      username: editForm.username.trim(),
      employeeId: normalizeEmployeeId(editForm.employeeId),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      nickname: editForm.nickname.trim() || editForm.username.trim()
    };
    const result = await updateUserProfile(currentUser.id, updates);
    if (result.success) {
      addNotification('Profile updated successfully.', 'success', currentUser.id);
      setEditing(false);
    } else {
      alert('Failed to update profile: ' + (result.error || 'Unknown error'));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end md:items-start md:justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/10"/>
      <div className="relative bg-white w-full md:w-80 md:me-6 md:mt-16 rounded-t-[2rem] md:rounded-[2rem] p-6 shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-4 md:slide-in-from-top-2 duration-300 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setEditing(!editing)} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-full"><Pencil size={14}/></button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full"><X size={16}/></button>
        </div>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-black mb-3 shadow-lg shadow-indigo-200">
            {(currentUser.username || 'U').charAt(0).toUpperCase()}
          </div>
          {editing ? (
            <input value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="text-lg font-black text-slate-800 text-center bg-slate-50 rounded-xl px-3 py-1 outline-none border border-slate-200 w-full"/>
          ) : (
            <h3 className="text-lg font-black text-slate-800">{currentUser.username}</h3>
          )}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{currentUser.role}</p>
        </div>

        <div className="space-y-2 mb-5">
          <div className="p-3 bg-slate-50 rounded-2xl">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Hash size={10}/> ID</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-700">{getUserEmployeeId(currentUser)}</span>
              </div>
            </div>
          </div>

          {editing ? (
            <>
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Hash size={10}/> Employee ID</span>
                <input value={editForm.employeeId} onChange={e => setEditForm({...editForm, employeeId: e.target.value})} className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none border border-slate-200"/>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Mail size={10}/> Email</span>
                <input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none border border-slate-200"/>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Phone size={10}/> Phone</span>
                <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none border border-slate-200"/>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><User size={10}/> Nickname</span>
                <input value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none border border-slate-200"/>
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                <Save size={14}/> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              {currentUser.email && (
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 flex items-center gap-1"><Mail size={10}/> Email</span>
                  <span className="text-xs font-bold text-slate-700 truncate">{currentUser.email}</span>
                </div>
              )}
              {currentUser.phone && (
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 flex items-center gap-1"><Phone size={10}/> Phone</span>
                  <span className="text-xs font-bold text-slate-700">{currentUser.phone}</span>
                </div>
              )}
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-2"><Bell size={14} className="text-slate-400"/><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('notifications2')}</span></div>
                <button onClick={() => setNotifEnabled(v => !v)} className={`relative w-10 h-5 rounded-full transition-colors ${notifEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${notifEnabled ? 'start-5' : 'start-0.5'}`}/>
                </button>
              </div>
            </>
          )}
        </div>

        {!editing && (
          <button onClick={() => { onClose(); onLogoutRequest(); }} className="w-full py-3 bg-red-50 text-red-500 font-black uppercase text-[10px] tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100">
            <LogOut size={16}/> {t('logout')}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Invite / Add User Modal (Admin) ─────────────────────────────────────────
const InviteModal = ({ onClose, t }) => {
  const { users, addNotification, currentUser, updateUserProfile } = useAppContext();
  const [tab, setTab] = useState('add');
  const [form, setForm] = useState({ username: '', id: '', email: '', phone: '', role: 'user', allowedPages: ['tasks','planner','ai'] });
  const [editTargetId, setEditTargetId] = useState('');
  const [editForm, setEditForm] = useState({ username: '', id: '', email: '', phone: '', role: 'user', allowedPages: ['tasks','planner','ai'] });
  const [adminConfirmId, setAdminConfirmId] = useState('');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const inviteLink = `${window.location.origin}/login?invite=taskflow2024`;
  const pageOptions = [
    { k: 'tasks', l: t('tasks') },
    { k: 'planner', l: t('planner') },
    { k: 'ai', l: t('ai') },
    { k: 'chat', l: t('chat') },
  ];

  const copyLink = () => { navigator.clipboard.writeText(inviteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const createUser = async (e) => {
    e.preventDefault();
    setError('');
    const nextEmployeeId = normalizeEmployeeId(form.id);
    if (normalizeEmployeeId(adminConfirmId) !== getUserEmployeeId(currentUser)) { setError('Admin ID does not match.'); return; }
    if (!nextEmployeeId) { setError('Employee ID is required.'); return; }
    if (users.find(u => u.id === nextEmployeeId || userMatchesEmployeeId(u, nextEmployeeId))) { setError('Employee ID already exists!'); return; }
    setSending(true);
    const basePages = Array.isArray(form.allowedPages) ? form.allowedPages : [];
    const sanitizedPages = basePages.filter(p => ['tasks','planner','ai','chat','efficiency','live-map'].includes(p));
    const newUser = {
      username: form.username.trim(),
      employeeId: nextEmployeeId,
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      allowedPages: sanitizedPages,
      permanent: false,
      isOnline: false,
      nickname: form.username.trim(),
    };
    await setDoc(doc(db, 'users', nextEmployeeId), newUser);
    addNotification(`New team member "${form.username}" added.`, 'info', 'all');
    addNotification(`Welcome ${form.username}! You've been added to the system.`, 'success', nextEmployeeId);
    if (form.email) {
      const result = await sendCredentialsEmail({ username: form.username, id: nextEmployeeId, email: form.email, role: form.role });
      if (!result.success) addNotification(`Email could not be sent to ${form.email}.`, 'warning', currentUser.id);
    }
    setSending(false); setSent(true);
    setTimeout(() => { setSent(false); onClose(); }, 2000);
  };

  useEffect(() => {
    if (!editTargetId) return;
    const target = users.find(u => u.id === editTargetId);
    if (!target) return;
    const defaults = target.role === 'ceo'
      ? ['tasks', 'planner', 'chat', 'ai', 'efficiency', 'live-map']
      : target.role === 'admin'
        ? ['tasks', 'planner', 'chat', 'ai', 'efficiency']
        : ['tasks', 'planner', 'chat', 'ai'];
    setEditForm({
      username: target.username || '',
      id: getUserEmployeeId(target),
      email: target.email || '',
      phone: target.phone || '',
      role: target.role || 'user',
      allowedPages: Array.isArray(target.allowedPages) && target.allowedPages.length > 0 ? target.allowedPages : defaults,
    });
  }, [editTargetId, users]);

  const updateExistingUser = async (e) => {
    e.preventDefault();
    setError('');
    if (!editTargetId) { setError('Please select a user first.'); return; }
    if (normalizeEmployeeId(adminConfirmId) !== getUserEmployeeId(currentUser)) { setError('Admin ID does not match.'); return; }
    setSending(true);
    try {
      const originalId = editTargetId;
      const nextId = normalizeEmployeeId(editForm.id);
      if (!nextId) { setError('User ID is required.'); setSending(false); return; }

      const allowed = (Array.isArray(editForm.allowedPages) ? editForm.allowedPages : [])
        .filter(p => ['tasks', 'planner', 'ai', 'chat', 'efficiency', 'live-map'].includes(p));
      const updates = {
        username: editForm.username.trim(),
        employeeId: nextId,
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        nickname: editForm.username.trim() || editForm.id.trim(),
        allowedPages: allowed,
      };
      const result = await updateUserProfile(originalId, updates);
      if (!result.success) {
        setError(result.error || 'Failed to update user profile.');
        setSending(false);
        return;
      }
      addNotification(`User "${updates.username}" updated.`, 'success', currentUser.id);
      setSent(true);
      setTimeout(() => { setSent(false); onClose(); }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to update user.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><UserPlus size={20} className="text-indigo-500"/> {t('inviteUser')}</h3><button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button></div>
        <div className="flex gap-2 mb-5">{['add','edit','invite'].map(tab_ => (
          <button key={tab_} onClick={() => setTab(tab_)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === tab_ ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>{tab_ === 'add' ? t('addUser') : tab_ === 'edit' ? 'Edit User' : t('inviteUser')}</button>
        ))}</div>

        {tab === 'add' ? (
          <form onSubmit={createUser} className="space-y-3">
            {[
              { key: 'username', label: t('newUsername'), type: 'text', icon: User },
              { key: 'id', label: t('newUserId'), type: 'text', icon: Hash },
              { key: 'email', label: t('newUserEmail'), type: 'email', icon: Mail },
              { key: 'phone', label: t('phoneNumber'), type: 'tel', icon: Phone },
            ].map(f => (
              <div key={f.key} className="relative">
                <f.icon size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300"/>
                <input type={f.type} required placeholder={f.label}
                  className="w-full p-3.5 ps-10 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 border border-transparent focus:border-indigo-200"
                  value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}/>
              </div>
            ))}
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full p-3.5 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 border border-transparent">
              <option value="user">{t('roleUser')}</option>
              <option value="admin">{t('roleAdmin')}</option>
              <option value="ceo">{t('roleCEO')}</option>
            </select>

            {/* Page access (alerts always available) */}
            <div className="p-4 bg-white border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('pageAccess') || 'Page Access'}</p>
              <div className="grid grid-cols-2 gap-2">
                {pageOptions.map(opt => {
                  const checked = (form.allowedPages || []).includes(opt.k);
                  return (
                    <button
                      type="button"
                      key={opt.k}
                      onClick={() => {
                        const cur = Array.isArray(form.allowedPages) ? form.allowedPages : [];
                        const next = checked ? cur.filter(x => x !== opt.k) : [...cur, opt.k];
                        setForm({ ...form, allowedPages: next });
                      }}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        checked ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}
                    >
                      {opt.l}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] font-bold text-slate-400 mt-3">
                {t('alerts')} {t('alwaysOn') || 'is always available.'}
              </p>
              {form.role === 'user' && (
                <p className="text-[9px] font-bold text-amber-600 mt-1">
                  {t('userPlannerNote') || 'User Planner will show assigned due dates only.'}
                </p>
              )}
            </div>
            <div className="bg-indigo-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1"><Shield size={14} className="text-indigo-500"/><p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Admin Confirmation</p></div>
              <input type="text" placeholder="Enter YOUR Admin Employee ID" value={adminConfirmId} onChange={e => { setAdminConfirmId(e.target.value); setError(''); }}
                className="w-full p-3 bg-white border border-indigo-200 rounded-xl outline-none text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10"/>
            </div>
            {error && <p className="text-[11px] font-bold text-red-500 px-1">{error}</p>}
            <button type="submit" disabled={sending || sent}
              className={`w-full font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest ${sent ? 'bg-emerald-500 text-white' : sending ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-black'}`}>
              {sent ? <><Check size={16}/> Created!</> : sending ? <><Loader2 size={16} className="animate-spin"/> Creating...</> : <><Mail size={16}/> {t('createUser')}</>}
            </button>
          </form>
        ) : tab === 'edit' ? (
          <form onSubmit={updateExistingUser} className="space-y-3">
            <select value={editTargetId} onChange={e => { setEditTargetId(e.target.value); setError(''); }} className="w-full p-3.5 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 border border-transparent">
              <option value="">Select user...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username} ({getUserEmployeeId(u)})</option>)}
            </select>
            <div className="relative">
              <User size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300"/>
              <input type="text" required placeholder={t('newUsername')} className="w-full p-3.5 ps-10 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 border border-transparent" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })}/>
            </div>
            <div className="relative">
              <Hash size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300"/>
              <input type="text" required placeholder={t('newUserId')} className="w-full p-3.5 ps-10 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 border border-transparent" value={editForm.id} onChange={e => setEditForm({ ...editForm, id: e.target.value })}/>
            </div>
            <div className="relative">
              <Mail size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300"/>
              <input type="email" placeholder={t('newUserEmail')} className="w-full p-3.5 ps-10 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 border border-transparent" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}/>
            </div>
            <div className="relative">
              <Phone size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300"/>
              <input type="tel" placeholder={t('phoneNumber')} className="w-full p-3.5 ps-10 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 border border-transparent" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}/>
            </div>
            <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="w-full p-3.5 bg-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-800 border border-transparent">
              <option value="user">{t('roleUser')}</option>
              <option value="admin">{t('roleAdmin')}</option>
              <option value="ceo">{t('roleCEO')}</option>
            </select>

            <div className="p-4 bg-white border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('pageAccess') || 'Page Access'}</p>
              <div className="grid grid-cols-2 gap-2">
                {pageOptions.map(opt => {
                  const checked = (editForm.allowedPages || []).includes(opt.k);
                  return (
                    <button
                      type="button"
                      key={opt.k}
                      onClick={() => {
                        const cur = Array.isArray(editForm.allowedPages) ? editForm.allowedPages : [];
                        const next = checked ? cur.filter(x => x !== opt.k) : [...cur, opt.k];
                        setEditForm({ ...editForm, allowedPages: next });
                      }}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${checked ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-100'}`}
                    >
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-indigo-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1"><Shield size={14} className="text-indigo-500"/><p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Admin Confirmation</p></div>
              <input type="text" placeholder="Enter YOUR Admin Employee ID" value={adminConfirmId} onChange={e => { setAdminConfirmId(e.target.value); setError(''); }} className="w-full p-3 bg-white border border-indigo-200 rounded-xl outline-none text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10"/>
            </div>
            {error && <p className="text-[11px] font-bold text-red-500 px-1">{error}</p>}
            <button type="submit" disabled={sending || sent} className={`w-full font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest ${sent ? 'bg-emerald-500 text-white' : sending ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-black'}`}>
              {sent ? <><Check size={16}/> Updated!</> : sending ? <><Loader2 size={16} className="animate-spin"/> Updating...</> : <><Save size={16}/> Update User</>}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('inviteCode')}</p><p className="text-sm font-bold text-slate-700 break-all">{inviteLink}</p></div>
            <button onClick={copyLink} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${copied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
              {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? t('inviteSent') : t('copyInvite')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Header ──────────────────────────────────────────────────────────────
const Header = () => {
  const { currentUser, loading, isCEO, isAdmin, lang, setLang, logoutUser } = useAppContext();
  const t = useT();
  const location = useLocation();
  const mobileMenuRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const handler = (e) => { if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) setMobileMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!currentUser) return null;

  return (
    <>
      <header className={`bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 md:px-6 py-3 flex justify-between items-center gap-3 z-40 shadow-sm w-full min-w-0 ${location.pathname === '/ai' ? 'sticky top-0' : 'relative'}`}
        style={{ paddingTop: 'calc(var(--app-safe-top) + 0.75rem)' }}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-md shadow-indigo-200"><Briefcase className="text-white" size={16}/></div>
          <div className="min-w-0">
            <h1 className="text-sm font-black leading-none flex items-center gap-1.5 min-w-0">
              <span className="hidden sm:inline truncate">{t('appName')}</span>
              <span className="sm:hidden">DrWEEE</span>
              {isAdmin && !isCEO && <ShieldCheck size={12} className="text-indigo-500"/>}
            </h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate">@{currentUser.nickname || currentUser.username}</p>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {loading && <RefreshCw size={13} className="animate-spin text-indigo-400"/>}
          {isAdmin && <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title={t('inviteUser')}><UserPlus size={18}/></button>}
          <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="flex items-center gap-1 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Globe size={18}/><span className="text-[9px] font-black uppercase tracking-widest">{lang === 'en' ? 'EN' : 'عربي'}</span></button>
          <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center shadow-md shadow-indigo-200 hover:ring-2 hover:ring-indigo-300 text-sm">{(currentUser.username || 'U').charAt(0).toUpperCase()}</button>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {loading && <RefreshCw size={12} className="animate-spin text-indigo-400"/>}
          <div className="relative" ref={mobileMenuRef}>
            <button onClick={() => setMobileMenuOpen(v => !v)} className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${mobileMenuOpen ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>
              {mobileMenuOpen ? <X size={16}/> : <Menu size={16}/>}
            </button>
            {mobileMenuOpen && (
              <div className="absolute end-0 top-11 w-52 bg-white border border-slate-100 rounded-[1.5rem] shadow-2xl p-2 z-50 animate-in zoom-in-95 duration-150">
                {isAdmin && <button onClick={() => { setShowInvite(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-indigo-50 text-slate-700"><UserPlus size={16} className="text-indigo-500"/><span className="text-xs font-black uppercase tracking-widest">Add Member</span></button>}
                <button onClick={() => { setLang(lang === 'en' ? 'ar' : 'en'); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700"><Globe size={16} className="text-slate-400"/><span className="text-xs font-black uppercase tracking-widest">{lang === 'en' ? 'Arabic' : 'English'}</span></button>
              </div>
            )}
          </div>
          <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center shadow-md shadow-indigo-200 text-sm">{(currentUser.username || 'U').charAt(0).toUpperCase()}</button>
        </div>
      </header>

      {showProfile && <ProfilePopup t={t} onClose={() => setShowProfile(false)} onLogoutRequest={() => setShowLogoutConfirm(true)}/>}
      {showInvite && <InviteModal t={t} onClose={() => setShowInvite(false)}/>}
      {showLogoutConfirm && <LogoutConfirm t={t} onCancel={() => setShowLogoutConfirm(false)} onConfirm={async () => { setShowLogoutConfirm(false); await logoutUser(); }}/>}
    </>
  );
};

export default Header;
