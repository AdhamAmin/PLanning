import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import useT from '../i18n/useT';

const InstallPrompt = () => {
  const [show, setShow] = useState(false);
  const t = useT();
  const [deviceType, setDeviceType] = useState('android');

  useEffect(() => {
    // Check if running in standalone (PWA) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // Check if dismissed before
    const isDismissed = localStorage.getItem('installPromptDismissed') === 'true';

    if (!isStandalone && !isDismissed) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setDeviceType('ios');
      } else {
        setDeviceType('android');
      }
      
      // Delay showing the prompt slightly to let app load
      const timeout = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('installPromptDismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-500 z-10 mb-20 md:mb-0">
        <button 
          onClick={handleDismiss} 
          className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-inner">
            <Download size={24} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 leading-tight">
              {t('installAppTitle')}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">TaskFlow OS</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl mb-5 space-y-2">
          <p className="text-sm font-bold text-slate-600 leading-relaxed text-center sm:text-start">
            {deviceType === 'ios' ? t('installAppDescIOS') : t('installAppDescAndroid')}
          </p>
          {deviceType === 'ios' && (
            <div className="flex justify-center py-2 text-indigo-500">
              <Share size={24} />
            </div>
          )}
        </div>

        <button 
          onClick={handleDismiss}
          className="w-full py-4 text-[11px] font-black uppercase tracking-widest text-white bg-slate-900 rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98]"
        >
          {t('dismiss')}
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
