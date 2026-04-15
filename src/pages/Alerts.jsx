import React from 'react';
import { Bell, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { db } from '../firebase';
import { getDocs, collection, writeBatch } from 'firebase/firestore';
import useT from '../i18n/useT';

const Alerts = () => {
  const { currentUser, notifications, isAdmin, lang } = useAppContext();
  const t = useT();

  // Filter notifications relevant to this user
  const myNotifs = notifications.filter(n => 
    n.targetUserId === 'all' || 
    n.targetUserId === currentUser.id || 
    (isAdmin && n.targetUserId === 'admin')
  );

  const clearAllNotifications = async () => {
    if (!window.confirm(lang === 'ar' ? 'مسح جميع التنبيهات؟' : 'Clear all your alerts?')) return;
    
    const batch = writeBatch(db);
    const snap = await getDocs(collection(db, 'notifications'));
    snap.forEach(d => {
      const data = d.data();
      if (data.targetUserId === 'all' || data.targetUserId === currentUser.id || (isAdmin && data.targetUserId === 'admin')) {
         batch.delete(d.ref);
      }
    });
    await batch.commit();
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between px-2 mb-2">
        <h3 className="font-black text-2xl text-slate-900 flex items-center gap-2">
          <Bell className="text-indigo-600" />
          {t('smartAlerts')}
        </h3>
        <button 
          onClick={clearAllNotifications} 
          className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-colors flex items-center gap-1"
        >
          <Trash2 size={12} /> {t('clearAll')}
        </button>
      </div>

      {myNotifs.length === 0 ? (
        <div className="text-center py-32 bg-white flex flex-col items-center gap-4 rounded-[3rem] border border-slate-100 shadow-sm text-slate-400 font-bold max-w-sm mx-auto">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2">
            <Bell size={32} className="text-slate-300" />
          </div>
          <h4 className="text-lg font-black text-slate-800">{t('nothingToReport')}</h4>
          <p className="text-xs text-slate-400">{t('noAlertsNow')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {myNotifs.map(n => (
            <div key={n.id} className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-100 flex items-start gap-5 shadow-sm hover:shadow-md transition-shadow">
              <div className={`p-3 rounded-2xl shrink-0 ${n.type === 'success' ? 'bg-emerald-50 text-emerald-500 shadow-emerald-100' : 'bg-indigo-50 text-indigo-500 shadow-indigo-100'} shadow-sm`}>
                {n.type === 'success' ? <CheckCircle2 size={24}/> : <Bell size={24}/>}
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm md:text-base font-black text-slate-800 leading-relaxed">{n.text}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                    <Clock size={12} /> {n.time}
                  </span>
                  {n.targetUserId === 'all' && (
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">{t('broadcast')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;
