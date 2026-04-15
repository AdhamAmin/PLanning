import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation2, Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import useT from '../i18n/useT';

// Standard Leaflet Icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom "Snap Map"-style marker: avatar letter + online ring
const createUserIcon = ({ color, letter }) => new L.DivIcon({
  html: `
    <div style="
      width: 42px; height: 42px; border-radius: 999px;
      background: white;
      border: 3px solid ${color};
      box-shadow: 0 10px 20px rgba(15,23,42,0.18);
      display:flex; align-items:center; justify-content:center;
      font-weight:900; font-size:16px;
      color:#0f172a;
    ">
      <div style="
        width: 30px; height: 30px; border-radius: 999px;
        background: ${color}20;
        display:flex; align-items:center; justify-content:center;
      ">${letter}</div>
    </div>
  `,
  className: '',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -18]
});

const LiveMap = () => {
  const { users, lang } = useAppContext();
  const t = useT();
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';

  const locatedUsers = useMemo(() => {
    const now = Date.now();
    const toMs = (ts) => {
      if (!ts) return 0;
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (ts?.seconds != null) return ts.seconds * 1000;
      const d = new Date(ts);
      return isNaN(d) ? 0 : d.getTime();
    };
    return users
      .filter(u => u.location?.lat != null && u.location?.lng != null)
      .map(u => {
        const updatedMs = toMs(u.locationUpdatedAt);
        const ageMin = updatedMs ? Math.round((now - updatedMs) / 60000) : null;
        const isFresh = updatedMs ? (now - updatedMs) <= 10 * 60 * 1000 : false; // 10 minutes
        return {
          ...u,
          position: [u.location.lat, u.location.lng],
          locationAgeMin: ageMin,
          locationFresh: isFresh,
        };
      })
      .sort((a, b) => {
        const aMs = a.locationUpdatedAt?.toMillis ? a.locationUpdatedAt.toMillis() : (a.locationUpdatedAt?.seconds ? a.locationUpdatedAt.seconds * 1000 : 0);
        const bMs = b.locationUpdatedAt?.toMillis ? b.locationUpdatedAt.toMillis() : (b.locationUpdatedAt?.seconds ? b.locationUpdatedAt.seconds * 1000 : 0);
        return bMs - aMs;
      });
  }, [users]);

  const mapCenter = useMemo(() => {
    if (locatedUsers.length === 0) return [30.0444, 31.2357]; // fallback Cairo
    // Center on the most recently updated user
    return locatedUsers[0].position;
  }, [locatedUsers]);

  const onlineCount = users.filter(u => u.isOnline).length;
  const locatedCount = locatedUsers.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2.5 rounded-[1.25rem] shadow-lg shadow-amber-200">
            <MapPin className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 leading-tight">{t('liveTracker')}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('ceoRestricted2')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
           <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">
             {onlineCount} {t('onlineNow')} • {locatedCount} {t('liveTracker')}
           </span>
        </div>
      </div>

      {/* Map Container */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden h-[60vh] relative z-0">
        
        {/* Floating overlay panel */}
        <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl w-48 border border-white">
           <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-800 mb-3"><Users size={14}/> {t('fieldAgents')}</h4>
           <div className="space-y-2 max-h-48 overflow-y-auto">
             {locatedUsers.map(u => (
               <div key={u.id} className="flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-600 truncate mr-2">{u.username}</span>
                 <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${u.locationFresh ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
               </div>
             ))}
           </div>
        </div>

        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {locatedUsers.map((user) => (
            <Marker 
              key={user.id} 
              position={user.position}
              icon={createUserIcon({
                color: user.locationFresh ? '#34d399' : '#f59e0b',
                letter: (user.username || '?').charAt(0).toUpperCase()
              })}
            >
              <Popup className="rounded-2xl">
                <div className="text-center p-1">
                  <div className="w-8 h-8 rounded-full bg-slate-100 mx-auto flex items-center justify-center font-black text-slate-500 mb-2">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <h4 className="font-black text-slate-800 text-sm m-0">{user.username}</h4>
                  <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold m-0 mt-1">{user.role}</p>
                  <p className={`text-[9px] uppercase tracking-widest font-black mt-2 ${user.locationFresh ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {user.locationFresh ? t('online') : t('late')}
                  </p>
                  {user.locationUpdatedAt && (
                    <p className="text-[10px] font-bold text-slate-500 mt-1">
                      {new Date(user.locationUpdatedAt?.toMillis ? user.locationUpdatedAt.toMillis() : user.locationUpdatedAt?.seconds * 1000).toLocaleString(locale)}
                    </p>
                  )}
                  {user.locationAgeMin != null && (
                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                      {user.locationAgeMin} {t('minAgo') || 'min ago'}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Decorative Compass */}
        <div className="absolute bottom-6 right-6 z-[400] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-300">
           <Navigation2 size={24} className="rotate-45" />
        </div>
      </div>

    </div>
  );
};

export default LiveMap;
