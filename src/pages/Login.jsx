import React, { useState } from 'react';
import { ShieldCheck, Phone, Mail, User, Hash } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAppContext } from '../context/AppContext';
import useT from '../i18n/useT';
import { normalizeEmployeeId, userMatchesEmployeeId } from '../utils/userIdentity';

const Login = () => {
  const { users, loginUser, addNotification } = useAppContext();
  const t = useT();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      username: params.get('username') || '',
      id: params.get('id') || '',
      email: '',
      phone: ''
    };
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const { username, id, email, phone } = loginForm;
    const trimmedUsername = username.trim();
    const normalizedId = normalizeEmployeeId(id);

    if (!trimmedUsername || !normalizedId) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isRegistering) {
      if (!email.trim() || !phone.trim()) {
        setError('Email and phone number are required for registration.');
        return;
      }
      const existing = users.find(u => u.id === normalizedId || userMatchesEmployeeId(u, normalizedId));
      if (existing) { setError('Employee ID already exists. Please login instead.'); return; }
      const newUser = {
        username: trimmedUsername,
        employeeId: normalizedId,
        email: email.trim(),
        phone: phone.trim(),
        role: 'user',
        nickname: trimmedUsername,
        permanent: false,
      };
      await setDoc(doc(db, 'users', normalizedId), newUser);
      loginUser({ ...newUser, id: normalizedId });
      addNotification(`Welcome to DrWEEE Flow, ${trimmedUsername}!`, 'success', normalizedId);
      addNotification(`New user registered: ${trimmedUsername} (${normalizedId})`, 'info', 'admin');
    } else {
      const user = users.find(u => u.username === trimmedUsername && userMatchesEmployeeId(u, normalizedId));
      if (user) {
        loginUser(user);
        if (user.role === 'ceo') {
          addNotification(`Welcome back, CEO ${user.username}! Full access granted.`, 'success', user.id);
        } else if (user.role === 'admin') {
          addNotification(`Welcome back, Chief ${user.username}! Admin access granted.`, 'success', user.id);
        } else {
          addNotification(`Welcome back, ${user.username}!`, 'info', user.id);
        }
      } else {
        setError('Invalid credentials. Please check your name and Employee ID.');
      }
    }
  };

  const updateField = (field, value) => {
    setError('');
    setLoginForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-[100dvh] bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden w-full"
      style={{ paddingTop: 'calc(var(--app-safe-top) + 1rem)', paddingRight: 'calc(var(--app-safe-right) + 1rem)', paddingBottom: 'calc(var(--app-safe-bottom) + 1rem)', paddingLeft: 'calc(var(--app-safe-left) + 1rem)' }}>
      {/* Clean geometric background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"/>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"/>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-block bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-400/30 mb-4">
            <ShieldCheck className="text-white" size={32}/>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">DrWEEE Flow</h2>
          <p className="text-slate-400 font-medium text-sm mt-2">Smart Control System</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-3">
          {/* Username */}
          <div className="relative">
            <User size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-300"/>
            <input type="text" required placeholder={t('fullName')}
              className="w-full p-4 ps-11 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 text-base focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={loginForm.username} onChange={e => updateField('username', e.target.value)}/>
          </div>

          {/* Employee ID */}
          <div className="relative">
            <Hash size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-300"/>
            <input type="text" required placeholder={t('employeeId')}
              className="w-full p-4 ps-11 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 text-base focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={loginForm.id} onChange={e => updateField('id', e.target.value)}/>
          </div>

          {/* Registration fields */}
          {isRegistering && (
            <>
              {/* Email */}
              <div className="relative">
                <Mail size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                <input type="email" required placeholder={t('emailAddress')}
                  className="w-full p-4 ps-11 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 text-base focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  value={loginForm.email} onChange={e => updateField('email', e.target.value)}/>
              </div>

              {/* Phone Number */}
              <div className="relative">
                <Phone size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                <input type="tel" required placeholder={t('phoneNumber') || 'Phone Number'}
                  className="w-full p-4 ps-11 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 text-base focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  value={loginForm.phone} onChange={e => updateField('phone', e.target.value)}/>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-2xl">
              <p className="text-xs font-bold text-red-500 text-center">{error}</p>
            </div>
          )}

          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-400/30 hover:bg-indigo-700 transition-all active:scale-[0.98] uppercase tracking-widest text-sm">
            {isRegistering ? t('register') : t('login')}
          </button>
        </form>

        <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
          className="w-full mt-6 text-slate-400 font-black text-[10px] uppercase text-center tracking-widest hover:text-slate-600 transition-colors">
          {isRegistering ? t('backToLogin') : t('newAccount')}
        </button>
      </div>
    </div>
  );
};

export default Login;
