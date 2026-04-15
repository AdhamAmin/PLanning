import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { mergeWithSeed, SEED_USERS } from '../archive/db';
import {
  collection, doc, onSnapshot, setDoc, addDoc, deleteDoc,
  updateDoc, query, orderBy, serverTimestamp, getDocs
} from 'firebase/firestore';

export const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

// ─── Smart Automation Config ────────────────────────────────────────────────
const SMART_CONFIG = {
  autoArchiveDelayMs: 2 * 60 * 60 * 1000,   // 2 hours after completion
  priorityEscalationHours: 24,                // escalate if <24h to deadline
  workloadThreshold: 8,                        // max active tasks per person
  streakBonusAt: 5,                            // notify at 5-task streak
  staleOpportunityDays: 14,                    // flag opps with no action for 14 days
  autoArchiveCheckInterval: 5 * 60 * 1000,    // check every 5 minutes
};

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser]   = useState(null);
  const [users, setUsers]               = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [messages, setMessages]         = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents]             = useState([]);
  const [groups, setGroups]             = useState([]);
  /** Always false — UI mounts immediately; tasks/opps stream via onSnapshot (no global blocking spinner). */
  const loading = false;
  const [lang, setLang]                 = useState('en');
  const [isGlobalAIOpen, setGlobalAIOpen] = useState(false);

  // Refs for smart logic (avoid re-subscribing listeners on data changes)
  const tasksRef = useRef(tasks);
  const oppsRef = useRef(opportunities);
  const usersRef = useRef(users);
  const eventsRef = useRef(events);
  const currentUserRef = useRef(currentUser);
  tasksRef.current = tasks;
  oppsRef.current = opportunities;
  usersRef.current = users;
  eventsRef.current = events;
  currentUserRef.current = currentUser;

  // Derived Admin Check
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ceo';
  const isCEO = currentUser?.role === 'ceo';

  // Page access (per-user). Alerts are always available.
  const getDefaultPagesForRole = useCallback((role) => {
    if (role === 'ceo') return ['tasks', 'planner', 'chat', 'ai', 'efficiency', 'live-map'];
    if (role === 'admin') return ['tasks', 'planner', 'chat', 'ai', 'efficiency'];
    // user
    return ['tasks', 'planner', 'chat', 'ai'];
  }, []);

  const canAccessPage = useCallback((pageKey) => {
    if (!currentUser) return false;
    if (pageKey === 'alerts') return true;
    const pages = Array.isArray(currentUser.allowedPages) && currentUser.allowedPages.length > 0
      ? currentUser.allowedPages
      : getDefaultPagesForRole(currentUser.role);
    // Safety: never allow non-admin to access admin-only pages via allowedPages
    if (pageKey === 'efficiency' && !isAdmin) return false;
    if (pageKey === 'live-map' && !isCEO) return false;
    return pages.includes(pageKey);
  }, [currentUser, getDefaultPagesForRole, isAdmin, isCEO]);

  // RTL/LTR Body Direction Manager
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Session Restore
  useEffect(() => {
    const session = localStorage.getItem('tf_session');
    if (session) setCurrentUser(JSON.parse(session));
  }, []);

  // Keep session user in sync with Firestore (role/username/email changes)
  // So when an admin changes a user's role, access updates immediately.
  useEffect(() => {
    if (!currentUser?.id || users.length === 0) return;
    const fresh = users.find(u => u.id === currentUser.id);
    if (!fresh) return;
    const merged = { ...currentUser, ...fresh };

    // If role changed, also reset allowedPages to the role defaults to ensure
    // access instantly matches the updated role on the user's device.
    if (fresh.role && fresh.role !== currentUser.role) {
      const defaults = getDefaultPagesForRole(fresh.role);
      merged.allowedPages = defaults;
      // Write back so other devices/admin panels stay consistent
      updateDoc(doc(db, 'users', currentUser.id), { allowedPages: defaults }).catch(() => {});
    }
    // Avoid re-render loop: only update if something meaningful changed
    const keysToCheck = ['role', 'allowedPages', 'username', 'email', 'phone', 'nickname', 'isOnline', 'permanent'];
    const changed = keysToCheck.some(k => merged[k] !== currentUser[k]);
    if (changed) {
      setCurrentUser(merged);
      localStorage.setItem('tf_session', JSON.stringify(merged));
    }
  }, [users, currentUser?.id]); // intentionally not depending on full currentUser object

  // Seed DB (run once)
  useEffect(() => {
    const seedFirestore = async () => {
      for (const u of SEED_USERS) {
        const ref = doc(db, 'users', u.id);
        await setDoc(ref, u, { merge: true });
      }
    };
    seedFirestore();
  }, []);

  // Presence
  useEffect(() => {
    if (!currentUser?.id) return;
    const userRef = doc(db, 'users', currentUser.id);
    updateDoc(userRef, { isOnline: true });
    const handleUnload = () => { updateDoc(userRef, { isOnline: false }); };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      updateDoc(userRef, { isOnline: false });
    };
  }, [currentUser?.id]);

  // Live Location (Snap-map style)
  // Each logged-in user periodically updates their location in Firestore.
  useEffect(() => {
    if (!currentUser?.id) return;
    if (!('geolocation' in navigator)) return;

    const userRef = doc(db, 'users', currentUser.id);
    let watchId = null;
    let lastWriteMs = 0;
    let lastLat = null;
    let lastLng = null;

    const shouldWrite = (lat, lng, nowMs) => {
      const minIntervalMs = 25 * 1000; // throttle writes
      if (nowMs - lastWriteMs < minIntervalMs) return false;
      if (lastLat == null || lastLng == null) return true;
      const dLat = Math.abs(lat - lastLat);
      const dLng = Math.abs(lng - lastLng);
      // ~0.0002 deg ~ 20m-ish (very rough). Avoid writing tiny jitter.
      return (dLat + dLng) > 0.0002;
    };

    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords || {};
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
        const nowMs = Date.now();
        if (!shouldWrite(latitude, longitude, nowMs)) return;

        lastWriteMs = nowMs;
        lastLat = latitude;
        lastLng = longitude;

        try {
          await updateDoc(userRef, {
            location: { lat: latitude, lng: longitude, accuracy: accuracy ?? null },
            locationUpdatedAt: serverTimestamp(),
          });
        } catch (err) {
          // silent: offline/permissions/network
        }
      },
      () => {
        // permission denied or unavailable — do nothing
      },
      { enableHighAccuracy: true, maximumAge: 15 * 1000, timeout: 12 * 1000 }
    );

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentUser?.id]);

  // ── Helpers (defined early so smart logic can use them) ────────────────────
  const addNotificationFn = useCallback(async (text, type = 'info', targetUserId = 'all') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        text, type, targetUserId,
        time: new Date().toLocaleTimeString(),
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('[addNotification] Error:', err.message);
    }
  }, []);

  const addNotification = addNotificationFn;

  // ══════════════════════════════════════════════════════════════════════════
  // SMART LOGIC 1: Auto-Archive completed tasks/opportunities
  // Uses refs to avoid re-running effect on every data change
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.id || !isAdmin) return;

    const autoArchive = async () => {
      const now = Date.now();
      const currentTasks = tasksRef.current;
      const currentOpps = oppsRef.current;

      for (const task of currentTasks) {
        if (task.status !== 'completed' || task._archived) continue;
        const completedAt = task.completedAt?.toMillis
          ? task.completedAt.toMillis()
          : (task.completedAt?.seconds ? task.completedAt.seconds * 1000 : null);
        if (!completedAt) continue;
        const dueDate = task.dueDate ? new Date(task.dueDate).getTime() : null;
        const completedBeforeDeadline = dueDate ? completedAt < dueDate : true;
        const graceElapsed = (now - completedAt) > SMART_CONFIG.autoArchiveDelayMs;
        if (completedBeforeDeadline && graceElapsed) {
          try {
            await updateDoc(doc(db, 'tasks', task.id), {
              _archived: true, _archivedAt: serverTimestamp(), _archivedReason: 'auto_completed_early'
            });
          } catch (err) { console.warn('[SmartLogic] Archive error:', err.message); }
        }
      }

      for (const opp of (currentOpps || [])) {
        if (opp._archived) continue;
        if (opp.stage !== 'Closed Won' && opp.stage !== 'Closed Lost') continue;
        const createdAt = opp.createdAt?.toMillis
          ? opp.createdAt.toMillis()
          : (opp.createdAt?.seconds ? opp.createdAt.seconds * 1000 : now);
        if ((now - createdAt) > SMART_CONFIG.autoArchiveDelayMs) {
          try {
            await updateDoc(doc(db, 'opportunities', opp.id), {
              _archived: true, _archivedAt: serverTimestamp(),
              _archivedReason: opp.stage === 'Closed Won' ? 'auto_won' : 'auto_lost'
            });
          } catch (err) { console.warn('[SmartLogic] Opp archive error:', err.message); }
        }
      }
    };

    autoArchive();
    const interval = setInterval(autoArchive, SMART_CONFIG.autoArchiveCheckInterval);
    return () => clearInterval(interval);
  }, [currentUser?.id, isAdmin]); // Only re-run when user/role changes, not on every data change

  // ══════════════════════════════════════════════════════════════════════════
  // SMART LOGIC 2: Priority Auto-Escalation & Overdue Alerts
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.id || !isAdmin) return;

    const checkEscalation = async () => {
      const now = new Date();
      const currentTasks = tasksRef.current;

      for (const task of currentTasks) {
        if (task.status === 'completed' || task._archived || !task.dueDate) continue;
        const due = new Date(task.dueDate);
        const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
        const escalationKey = `escalation_${task.id}`;
        const alreadyEscalated = localStorage.getItem(escalationKey);

        if (hoursLeft > 0 && hoursLeft <= SMART_CONFIG.priorityEscalationHours && task.priority !== 'High' && !alreadyEscalated) {
          try {
            await updateDoc(doc(db, 'tasks', task.id), { priority: 'High', _autoEscalated: true });
            await addNotificationFn(
              `Priority auto-escalated to HIGH: "${task.title}" (due in ${Math.round(hoursLeft)}h)`,
              'warning', task.employeeId || 'admin'
            );
            localStorage.setItem(escalationKey, 'true');
          } catch (err) { console.warn('[SmartLogic] Escalation error:', err.message); }
        }

        const overdueKey = `overdue_alert_${task.id}`;
        if (hoursLeft < 0 && !localStorage.getItem(overdueKey)) {
          await addNotificationFn(
            `OVERDUE: "${task.title}" was due ${new Date(task.dueDate).toLocaleDateString()}`,
            'warning', task.employeeId || 'admin'
          );
          localStorage.setItem(overdueKey, 'true');
        }
      }
    };

    checkEscalation();
    const interval = setInterval(checkEscalation, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser?.id, isAdmin, addNotificationFn]);

  // ══════════════════════════════════════════════════════════════════════════
  // SMART LOGIC 3: Workload Balancing Alerts
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.id || !isAdmin) return;

    const checkWorkload = () => {
      const workloadKey = `workload_check_${new Date().toDateString()}`;
      if (localStorage.getItem(workloadKey)) return;

      const currentUsers = usersRef.current;
      const currentTasks = tasksRef.current;
      const overloaded = [];
      const idle = [];

      currentUsers.forEach(u => {
        const activeTasks = currentTasks.filter(t => t.employeeId === u.id && t.status !== 'completed' && !t._archived);
        if (activeTasks.length >= SMART_CONFIG.workloadThreshold) {
          overloaded.push({ name: u.username, count: activeTasks.length });
        }
        if (activeTasks.length === 0 && currentTasks.some(t => t.employeeId === u.id)) {
          idle.push(u.username);
        }
      });

      if (overloaded.length > 0) {
        const names = overloaded.map(o => `${o.name} (${o.count})`).join(', ');
        addNotificationFn(`Workload alert: ${names} have ${SMART_CONFIG.workloadThreshold}+ active tasks. Consider redistributing.`, 'warning', 'admin');
      }

      if (idle.length > 0 && overloaded.length > 0) {
        addNotificationFn(`Available team members: ${idle.join(', ')} — consider assigning tasks to them.`, 'info', 'admin');
      }

      localStorage.setItem(workloadKey, 'true');
    };

    const timeout = setTimeout(checkWorkload, 5000);
    return () => clearTimeout(timeout);
  }, [currentUser?.id, isAdmin, addNotificationFn]);

  // ══════════════════════════════════════════════════════════════════════════
  // SMART LOGIC 4: Stale Opportunity Detection
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.id || !isAdmin) return;

    const checkStaleOpps = () => {
      const staleKey = `stale_opp_check_${new Date().toDateString()}`;
      if (localStorage.getItem(staleKey)) return;

      const now = Date.now();
      const staleDays = SMART_CONFIG.staleOpportunityDays;
      const staleOpps = [];
      const currentOpps = oppsRef.current;

      (currentOpps || []).forEach(opp => {
        if (opp._archived || opp.stage === 'Closed Won' || opp.stage === 'Closed Lost') return;
        const nextAction = opp.nextActionDate ? new Date(opp.nextActionDate).getTime() : null;
        const createdAt = opp.createdAt?.toMillis
          ? opp.createdAt.toMillis()
          : (opp.createdAt?.seconds ? opp.createdAt.seconds * 1000 : now);
        const lastActivity = nextAction || createdAt;
        const daysSince = (now - lastActivity) / (1000 * 60 * 60 * 24);
        if (daysSince >= staleDays) {
          staleOpps.push(opp.client || opp.company || 'Unnamed');
        }
      });

      if (staleOpps.length > 0) {
        addNotificationFn(
          `${staleOpps.length} stale opportunit${staleOpps.length === 1 ? 'y' : 'ies'} (no action for ${staleDays}+ days): ${staleOpps.slice(0, 3).join(', ')}${staleOpps.length > 3 ? '...' : ''}`,
          'warning', 'admin'
        );
      }

      localStorage.setItem(staleKey, 'true');
    };

    const timeout = setTimeout(checkStaleOpps, 8000);
    return () => clearTimeout(timeout);
  }, [currentUser?.id, isAdmin, addNotificationFn]);

  // ══════════════════════════════════════════════════════════════════════════
  // Event Reminder System
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.id || !isAdmin) return;

    const checkReminders = () => {
      const now = new Date();
      const currentEvents = eventsRef.current;
      currentEvents.forEach(event => {
        if (!event.date || !event.time) return;
        const eventDate = new Date(event.date);
        const [hours, minutes] = (event.time || '09:00').split(':').map(Number);
        eventDate.setHours(hours, minutes, 0, 0);

        const diff = eventDate.getTime() - now.getTime();
        const diffMinutes = diff / (1000 * 60);
        const diffHours = diffMinutes / 60;

        const reminderKey = `reminder_${event.id}`;
        const sentReminders = JSON.parse(localStorage.getItem(reminderKey) || '[]');

        if (diffHours <= 24 && diffHours > 23.5 && !sentReminders.includes('1d')) {
          addNotificationFn(`Reminder: "${event.title}" is tomorrow at ${event.time}`, 'warning', currentUser.id);
          sentReminders.push('1d');
          localStorage.setItem(reminderKey, JSON.stringify(sentReminders));
        }
        if (diffHours <= 4 && diffHours > 3.5 && !sentReminders.includes('4h')) {
          addNotificationFn(`Reminder: "${event.title}" is in 4 hours at ${event.time}`, 'warning', currentUser.id);
          sentReminders.push('4h');
          localStorage.setItem(reminderKey, JSON.stringify(sentReminders));
        }
        if (diffHours <= 2 && diffHours > 1.5 && !sentReminders.includes('2h')) {
          addNotificationFn(`Reminder: "${event.title}" is in 2 hours at ${event.time}`, 'warning', currentUser.id);
          sentReminders.push('2h');
          localStorage.setItem(reminderKey, JSON.stringify(sentReminders));
        }
        if (diffMinutes <= 30 && diffMinutes > 25 && !sentReminders.includes('30m')) {
          addNotificationFn(`URGENT: "${event.title}" starts in 30 minutes!`, 'warning', currentUser.id);
          sentReminders.push('30m');
          localStorage.setItem(reminderKey, JSON.stringify(sentReminders));
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Event Starting Soon!', {
              body: `"${event.title}" starts in 30 minutes at ${event.time}`,
              icon: '/favicon.svg'
            });
          }
        }
      });
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [currentUser?.id, isAdmin, addNotificationFn]);

  // ══════════════════════════════════════════════════════════════════════════
  // Real-time Listeners — subscribe ONCE, never re-subscribe on data changes
  // Tasks/opportunities: no orderBy so documents missing createdAt still appear; sort client-side.
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const createdMs = (data) => {
      const c = data?.createdAt;
      if (!c) return 0;
      if (typeof c.toMillis === 'function') return c.toMillis();
      if (c.seconds != null) return c.seconds * 1000;
      return 0;
    };
    const sortByCreatedDesc = (a, b) => createdMs(b) - createdMs(a);

    const unsubs = [];

    unsubs.push(onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    }, err => console.warn('[Firestore] users listener error:', err.message)));

    unsubs.push(onSnapshot(collection(db, 'tasks'), snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort(sortByCreatedDesc);
      setTasks(list);
    }, err => console.warn('[Firestore] tasks listener error:', err.message)));

    unsubs.push(onSnapshot(collection(db, 'opportunities'), snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort(sortByCreatedDesc);
      setOpportunities(list);
    }, err => console.warn('[Firestore] opportunities listener error:', err.message)));

    const mq = query(collection(db, 'messages'), orderBy('createdAt', 'asc'));
    unsubs.push(onSnapshot(mq, snap => {
      setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id })));

      // Desktop notifications for new messages (only when hidden)
      const cu = currentUserRef.current;
      if (cu?.id && 'Notification' in window && Notification.permission === 'granted') {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.receiverId === cu.id && document.hidden) {
              const sender = usersRef.current.find(u => u.id === data.senderId)?.username || 'Someone';
              new Notification(`New message from ${sender}`, {
                body: data.text?.length > 40 ? data.text.slice(0, 37) + '...' : (data.text || 'Voice note'),
                icon: '/favicon.svg'
              });
            }
          }
        });
      }
    }, err => console.warn('[Firestore] messages listener error:', err.message)));

    const nq = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    unsubs.push(onSnapshot(nq, snap => {
      setNotifications(snap.docs.map(d => ({ ...d.data(), id: d.id })));

      const cu = currentUserRef.current;
      if (cu?.id && 'Notification' in window && Notification.permission === 'granted') {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const isAdminView = cu.role === 'admin' || cu.role === 'ceo';
            if (data.targetUserId === 'all' || data.targetUserId === cu.id || (isAdminView && data.targetUserId === 'admin')) {
              if (document.hidden) {
                new Notification(data.type === 'success' ? 'DrWEEE Flow' : 'DrWEEE Alert', {
                  body: data.text, icon: '/favicon.svg'
                });
              }
            }
          }
        });
      }
    }, err => console.warn('[Firestore] notifications listener error:', err.message)));

    const eq = query(collection(db, 'events'), orderBy('date', 'asc'));
    unsubs.push(onSnapshot(eq, snap => {
      setEvents(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    }, err => console.warn('[Firestore] events listener error:', err.message)));

    const gq = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    unsubs.push(onSnapshot(gq, snap => {
      setGroups(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    }, err => console.warn('[Firestore] groups listener error:', err.message)));

    return () => unsubs.forEach(u => u());
  }, []); // Subscribe ONCE — never re-subscribe

  // Force push notification even when app is in background/closed
  const pushNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body, icon: '/favicon.svg', badge: '/favicon.svg',
            vibrate: [200, 100, 200],
            tag: `drweee-${Date.now()}`,
            requireInteraction: true,
            actions: [{ action: 'open', title: 'Open App' }]
          });
        }).catch(() => {
          new Notification(title, { body, icon: '/favicon.svg' });
        });
      } else {
        new Notification(title, { body, icon: '/favicon.svg' });
      }
    }
  }, []);

  const loginUser = useCallback((user) => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    setCurrentUser(user);
    localStorage.setItem('tf_session', JSON.stringify(user));
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      const cu = currentUserRef.current;
      if (cu?.id) await updateDoc(doc(db, 'users', cu.id), { isOnline: false });
    } catch (err) {
      console.warn('[logout] Could not update online status (offline?):', err.message);
    }
    setCurrentUser(null);
    localStorage.removeItem('tf_session');
  }, []);

  const updateUserProfile = useCallback(async (userId, updates) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updates);

      if (currentUserRef.current?.id === userId) {
        const updatedUser = { ...currentUserRef.current, ...updates };
        setCurrentUser(updatedUser);
        localStorage.setItem('tf_session', JSON.stringify(updatedUser));
      }

      return { success: true };
    } catch (err) {
      console.error('[updateUserProfile] Error:', err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // ── Change User ID (system-wide update) ──────────────────────────────────
  const changeUserId = useCallback(async (oldId, newId) => {
    if (!oldId || !newId || oldId === newId) return { success: false, error: 'Invalid IDs' };
    const existingUser = usersRef.current.find(u => u.id === newId);
    if (existingUser) return { success: false, error: 'ID already in use' };

    try {
      const oldUserData = usersRef.current.find(u => u.id === oldId);
      if (!oldUserData) return { success: false, error: 'User not found' };

      const { id: _, ...userData } = oldUserData;
      await setDoc(doc(db, 'users', newId), { ...userData, id: newId, previousId: oldId });

      const tasksSnap = await getDocs(collection(db, 'tasks'));
      for (const taskDoc of tasksSnap.docs) {
        const data = taskDoc.data();
        if (data.employeeId === oldId) await updateDoc(doc(db, 'tasks', taskDoc.id), { employeeId: newId });
        if (data.creatorId === oldId) await updateDoc(doc(db, 'tasks', taskDoc.id), { creatorId: newId });
      }

      const oppsSnap = await getDocs(collection(db, 'opportunities'));
      for (const oppDoc of oppsSnap.docs) {
        const actualAssignedTo = oppDoc.data().assignedTo;
        if (Array.isArray(actualAssignedTo)) {
          if (actualAssignedTo.includes(oldId)) {
            await updateDoc(doc(db, 'opportunities', oppDoc.id), {
              assignedTo: actualAssignedTo.map(id => id === oldId ? newId : id)
            });
          }
        } else if (actualAssignedTo === oldId) {
          await updateDoc(doc(db, 'opportunities', oppDoc.id), { assignedTo: newId });
        }
      }

      const msgsSnap = await getDocs(collection(db, 'messages'));
      for (const msgDoc of msgsSnap.docs) {
        const data = msgDoc.data();
        const msgUpdates = {};
        if (data.senderId === oldId) msgUpdates.senderId = newId;
        if (data.receiverId === oldId) msgUpdates.receiverId = newId;
        if (Object.keys(msgUpdates).length > 0) await updateDoc(doc(db, 'messages', msgDoc.id), msgUpdates);
      }

      const groupsSnap = await getDocs(collection(db, 'groups'));
      for (const grpDoc of groupsSnap.docs) {
        const data = grpDoc.data();
        const grpUpdates = {};
        if ((data.members || []).includes(oldId)) grpUpdates.members = data.members.map(m => m === oldId ? newId : m);
        if ((data.adminIds || []).includes(oldId)) grpUpdates.adminIds = data.adminIds.map(m => m === oldId ? newId : m);
        if (Object.keys(grpUpdates).length > 0) await updateDoc(doc(db, 'groups', grpDoc.id), grpUpdates);
      }

      const eventsSnap = await getDocs(collection(db, 'events'));
      for (const evDoc of eventsSnap.docs) {
        const data = evDoc.data();
        if (data.assignedTo === oldId || data.creatorId === oldId) {
          const evUpdates = {};
          if (data.assignedTo === oldId) evUpdates.assignedTo = newId;
          if (data.creatorId === oldId) evUpdates.creatorId = newId;
          await updateDoc(doc(db, 'events', evDoc.id), evUpdates);
        }
      }

      await deleteDoc(doc(db, 'users', oldId));

      if (currentUserRef.current?.id === oldId) {
        const updatedUser = { ...currentUserRef.current, id: newId };
        setCurrentUser(updatedUser);
        localStorage.setItem('tf_session', JSON.stringify(updatedUser));
      }

      await addNotificationFn(`User ID changed from ${oldId} to ${newId}`, 'info', 'admin');
      return { success: true };
    } catch (err) {
      console.error('[changeUserId] Error:', err);
      return { success: false, error: err.message };
    }
  }, [addNotificationFn]);

  // ══════════════════════════════════════════════════════════════════════════
  // SMART INSIGHTS (computed, available to all components)
  // ══════════════════════════════════════════════════════════════════════════
  const smartInsights = useMemo(() => {
    const now = Date.now();

    // Streak tracking per user
    const streaks = {};
    users.forEach(u => {
      const userTasks = tasks
        .filter(t => t.employeeId === u.id && t.status === 'completed')
        .sort((a, b) => {
          const aTime = a.completedAt?.toMillis ? a.completedAt.toMillis() : (a.completedAt?.seconds ? a.completedAt.seconds * 1000 : 0);
          const bTime = b.completedAt?.toMillis ? b.completedAt.toMillis() : (b.completedAt?.seconds ? b.completedAt.seconds * 1000 : 0);
          return bTime - aTime;
        });

      let streak = 0;
      let lastDate = null;
      for (const t of userTasks) {
        const cAt = t.completedAt?.toMillis ? t.completedAt.toMillis() : (t.completedAt?.seconds ? t.completedAt.seconds * 1000 : 0);
        if (!cAt) break;
        const day = new Date(cAt).toDateString();
        if (!lastDate || lastDate !== day) {
          if (lastDate) {
            const diff = (new Date(lastDate).getTime() - new Date(day).getTime()) / (1000 * 60 * 60 * 24);
            if (diff > 2) break;
          }
          streak++;
          lastDate = day;
        }
      }
      streaks[u.id] = streak;
    });

    // Productivity score
    const productivityScores = {};
    users.forEach(u => {
      const completed = tasks.filter(t => t.employeeId === u.id && t.status === 'completed');
      const onTime = completed.filter(t => {
        if (!t.dueDate) return true;
        const due = new Date(t.dueDate).getTime();
        const cAt = t.completedAt?.toMillis ? t.completedAt.toMillis() : (t.completedAt?.seconds ? t.completedAt.seconds * 1000 : now);
        return cAt <= due;
      });
      productivityScores[u.id] = completed.length === 0 ? 100 : Math.round((onTime.length / completed.length) * 100);
    });

    // Upcoming deadlines (next 48h)
    const urgentDeadlines = tasks.filter(t => {
      if (t.status === 'completed' || t._archived || !t.dueDate) return false;
      const due = new Date(t.dueDate).getTime();
      const hoursLeft = (due - now) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft <= 48;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const archivedTasks = tasks.filter(t => t._archived).length;
    const archivedOpps = (opportunities || []).filter(o => o._archived).length;

    const topPerformer = users.reduce((best, u) => {
      const completed = tasks.filter(t => t.employeeId === u.id && t.status === 'completed').length;
      if (completed > (best?.completed || 0)) return { ...u, completed };
      return best;
    }, null);

    return { streaks, productivityScores, urgentDeadlines, archivedTasks, archivedOpps, topPerformer };
  }, [users, tasks, opportunities]);

  // ══════════════════════════════════════════════════════════════════════════
  // Memoized context value — prevents re-renders when unrelated state changes
  // ══════════════════════════════════════════════════════════════════════════
  const contextValue = useMemo(() => ({
    currentUser, setCurrentUser,
    users, setUsers,
    tasks, setTasks,
    opportunities, setOpportunities,
    messages, setMessages,
    notifications, setNotifications,
    loading, isAdmin, isCEO, addNotification,
    loginUser, logoutUser, updateUserProfile, changeUserId,
    pushNotification,
    lang, setLang,
    events, setEvents,
    groups, setGroups,
    isGlobalAIOpen, setGlobalAIOpen,
    smartInsights,
    canAccessPage,
  }), [
    currentUser, users, tasks, opportunities, messages, notifications,
    isAdmin, isCEO, addNotification, loginUser, logoutUser,
    updateUserProfile, changeUserId, pushNotification, lang, events,
    groups, isGlobalAIOpen, smartInsights, canAccessPage
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
