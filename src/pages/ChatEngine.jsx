import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ShieldCheck, MessageSquare, Trash2, Send,
  Link, ClipboardList, X, Sparkles, Pencil, Check,
  Users, Plus, Mic, MicOff, Image, Info, Copy,
  QrCode, UserPlus, LogOut, MoreVertical, Search, FileUp, File
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, writeBatch, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { PROTECTED_IDS } from '../archive/db';
import useT from '../i18n/useT';
// --- Task Detail Popup --------------------------------------------------------
const TaskDetailPopup = ({ task, onClose }) => {
  const navigate = useNavigate();
  const t = useT();
  if (!task) return null;
  const STATUS_COLOR = { completed: 'bg-emerald-50 text-emerald-600', 'in progress': 'bg-indigo-50 text-indigo-600', pending: 'bg-amber-50 text-amber-600' };
  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-5">
          <div><h3 className="text-lg font-black text-slate-800">{t('taskDetails')}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{task.taskType || 'standard'}</p></div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button>
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-4">{task.title}</h2>
        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span><span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${STATUS_COLOR[task.status]||'bg-slate-100 text-slate-500'}`}>{task.status}</span></div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</span><span className="text-[10px] font-black text-slate-700">{task.priority||'Medium'}</span></div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned To</span><span className="text-[10px] font-black text-slate-700">{task.employee}</span></div>
          {task.dueDate && <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</span><span className="text-[10px] font-black text-slate-700">{new Date(task.dueDate).toLocaleDateString()}</span></div>}
          {task.notes && <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p><p className="text-sm text-slate-600 font-medium italic">{task.notes}</p></div>}
        </div>
        <button onClick={() => { onClose(); navigate('/ai', { state: { taskContext: task } }); }} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-md"><Sparkles size={14}/> {t('askAI')}</button>
      </div>
    </div>
  );
};

// --- Edit User Role Popup (Admin) ---------------------------------------------
const EditUserRolePopup = ({ user, onClose }) => {
  const { currentUser, addNotification } = useAppContext();
  const [role, setRole] = useState(user.role || 'user');
  const [adminId, setAdminId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ROLES = ['user', 'admin', 'ceo'];
  const handleSave = async (e) => {
    e.preventDefault();
    if (PROTECTED_IDS.includes(user.id) && role !== user.role) { setError('This user is protected. Role cannot be changed.'); return; }
    if (adminId !== currentUser.id) { setError('Admin ID does not match.'); return; }
    setSaving(true);
    await updateDoc(doc(db, 'users', user.id), { role });
    addNotification(`Role updated to "${role}" by Admin.`, 'info', user.id);
    setSaving(false); onClose();
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Pencil size={16} className="text-indigo-500"/> Edit Role</h3><button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button></div>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-5"><div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-lg">{user.username.charAt(0).toUpperCase()}</div><div><p className="font-black text-slate-800 text-sm">{user.username}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.id}</p></div></div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">New Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-2xl outline-none font-black text-slate-800 text-sm">{ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ms-1 flex items-center gap-1"><ShieldCheck size={10}/> Your Admin ID</label>
            <input required type="text" placeholder="Enter your Employee ID..." value={adminId} onChange={e => { setAdminId(e.target.value); setError(''); }} className="w-full p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl outline-none font-bold text-slate-800 text-sm placeholder-indigo-200"/>
            {error && <p className="text-[10px] font-bold text-red-500 ms-1 mt-1">{error}</p>}</div>
          <button type="submit" disabled={saving||!adminId} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"><Check size={16}/> {saving ? '...' : 'Confirm'}</button>
        </form>
      </div>
    </div>
  );
};

// --- Delete User Confirm ------------------------------------------------------
const DeleteUserConfirm = ({ user, onClose }) => {
  const { addNotification } = useAppContext();
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (PROTECTED_IDS.includes(user.id)) { alert('This user is protected and cannot be removed.'); onClose(); return; }
    setDeleting(true);
    await deleteDoc(doc(db, 'users', user.id));
    addNotification(`User "${user.username}" removed.`, 'info', 'all');
    setDeleting(false); onClose();
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-red-500"/></div>
        <h3 className="text-lg font-black text-slate-800 mb-1">Remove User?</h3>
        <p className="text-sm text-slate-400 font-medium mb-6"><span className="font-black text-slate-700">{user.username}</span> will be removed.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest bg-slate-50 rounded-2xl">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 font-black text-white bg-red-500 rounded-2xl uppercase text-[10px] tracking-widest shadow-md shadow-red-200 disabled:opacity-60">{deleting ? '...' : 'Remove'}</button>
        </div>
      </div>
    </div>
  );
};

// --- Create Group Modal -------------------------------------------------------
const CreateGroupModal = ({ onClose }) => {
  const { currentUser, users, addNotification } = useAppContext();
  const [name, setName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([currentUser.id]);
  const [saving, setSaving] = useState(false);
  const toggleMember = (id) => {
    if (id === currentUser.id) return;
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || selectedMembers.length < 2) return;
    setSaving(true);
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    await addDoc(collection(db, 'groups'), {
      name: name.trim(), members: selectedMembers, adminIds: [currentUser.id],
      inviteCode, createdBy: currentUser.id, createdAt: serverTimestamp()
    });
    addNotification(`Group "${name}" created.`, 'info', 'all');
    setSaving(false); onClose();
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-black text-slate-800">Create Group</h3><button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button></div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">Group Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="E.g. Marketing Team" className="w-full p-3.5 rounded-2xl bg-slate-50 outline-none font-bold text-slate-800 text-sm border-none"/></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ms-1">Select Members</label>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {users.map(u => (
                <button type="button" key={u.id} onClick={() => toggleMember(u.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all text-start ${selectedMembers.includes(u.id) ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 hover:bg-slate-100'}`}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-sm shrink-0">{u.username.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{u.username}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{u.role} {u.id === currentUser.id ? '(You)' : ''}</p></div>
                  {selectedMembers.includes(u.id) && <Check size={16} className="text-indigo-600 shrink-0"/>}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving || selectedMembers.length < 2} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black disabled:opacity-50 transition-all"><Plus size={16} className="inline mr-1"/> Create Group</button>
        </form>
      </div>
    </div>
  );
};

// --- Group Info Modal ---------------------------------------------------------
const GroupInfoModal = ({ group, onClose, onDeleteGroup }) => {
  const { currentUser, users } = useAppContext();
  const [copied, setCopied] = useState(false);
  const isGroupAdmin = (group.adminIds || []).includes(currentUser.id) || currentUser.role === 'admin' || currentUser.role === 'ceo';
  const inviteLink = `${window.location.origin}/join/${group.inviteCode || 'NOCODE'}`;
  const copyLink = () => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const members = (group.members || []).map(id => users.find(u => u.id === id)).filter(Boolean);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}/>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-black text-slate-800">{group.name}</h3><button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700"><X size={16}/></button></div>
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Members ({members.length})</p>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-sm">{m.username.charAt(0).toUpperCase()}</div>
                  <div><p className="font-bold text-sm text-slate-800">{m.username}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{m.role} {(group.adminIds||[]).includes(m.id) ? '- Group Admin' : ''}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-2xl">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Invite Link</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="flex-1 p-2 bg-white rounded-xl text-xs font-mono text-slate-600 border-none outline-none"/>
              <button onClick={copyLink} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Copy size={12}/> {copied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">QR Code</p>
            <div className="w-32 h-32 mx-auto bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(inviteLink)}`} alt="QR" className="w-28 h-28 rounded-xl"/>
            </div>
          </div>
          {isGroupAdmin && (
            <button onClick={() => {
              if (window.confirm(`Are you sure you want to delete the group "${group.name}"? All group messages will also be deleted.`)) {
                onDeleteGroup(group.id);
                onClose();
              }
            }} className="w-full py-3 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-md shadow-red-200">
              <Trash2 size={14}/> Delete Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Chat Engine ---------------------------------------------------------
const ChatEngine = () => {
  const { currentUser, users, messages, tasks, groups, isAdmin, addNotification } = useAppContext();
  const t = useT();
  const navigate = useNavigate();
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(null);
  const [viewTab, setViewTab] = useState('contacts'); // 'contacts' | 'groups'
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [swipedUserId, setSwipedUserId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [swipedMsgId, setSwipedMsgId] = useState(null);
  const ringtoneRef = useRef(null);  const listRef = useRef(null);
  const messagesEndRef = useRef(null);
  const touchStartXRef = useRef(0);
  const lastSwipeTimeRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const msgTouchStartXRef = useRef(0);
  const msgTouchStartYRef = useRef(0);
  const inputRef = useRef(null);

  const chatTarget = selectedChatUser || selectedGroup;
  const isGroupChat = !!selectedGroup;

  const filteredMessages = useMemo(() => {
    if (!currentUser) return [];
    if (isGroupChat && selectedGroup) {
      return messages.filter(m => m.groupId === selectedGroup.id);
    }
    if (selectedChatUser) {
      return messages.filter(m =>
        (m.senderId === currentUser.id && m.receiverId === selectedChatUser.id) ||
        (m.senderId === selectedChatUser.id && m.receiverId === currentUser.id)
      );
    }
    return [];
  }, [messages, currentUser, selectedChatUser, selectedGroup, isGroupChat]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [filteredMessages]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (swipedUserId) { const card = document.getElementById(`contact-card-${swipedUserId}`); if (card && !card.contains(e.target)) setSwipedUserId(null); }
      if (contextMenu) setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('touchstart', handleClickOutside); };
  }, [swipedUserId, contextMenu]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msgData = {
      senderId: currentUser.id,
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: serverTimestamp()
    };
    if (replyTo) {
      msgData.replyToId = replyTo.id;
      msgData.replyToText = replyTo.type === 'voice' ? 'Voice note' : (replyTo.text || '').slice(0, 80);
      msgData.replyToSender = replyTo.senderId;
    }
    if (isGroupChat) { msgData.groupId = selectedGroup.id; }
    else if (selectedChatUser) { msgData.receiverId = selectedChatUser.id; }
    else return;
    await addDoc(collection(db, 'messages'), msgData);
    setChatInput('');
    setReplyTo(null);
  };

  const deleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    await deleteDoc(doc(db, 'messages', msgId));
  };

  const deleteGroup = async (groupId) => {
    try {
      // Delete all group messages first
      const groupMsgs = messages.filter(m => m.groupId === groupId && m.id);
      const chunkSize = 450;
      for (let i = 0; i < groupMsgs.length; i += chunkSize) {
        const batch = writeBatch(db);
        groupMsgs.slice(i, i + chunkSize).forEach(m => batch.delete(doc(db, 'messages', m.id)));
        await batch.commit();
      }
      // Delete the group document
      await deleteDoc(doc(db, 'groups', groupId));
      addNotification('Group deleted.', 'info', currentUser.id);
      setSelectedGroup(null);
      setShowGroupInfo(null);
    } catch (err) {
      console.error('[DeleteGroup]', err);
      alert('Failed to delete group. Please try again.');
    }
  };

  const clearChat = async () => {
    if (!window.confirm('Clear all messages in this chat?')) return;
    try {
      // Firestore batch limit is 500, so chunk if needed
      const msgs = filteredMessages.filter(m => m.id);
      const chunkSize = 450;
      for (let i = 0; i < msgs.length; i += chunkSize) {
        const batch = writeBatch(db);
        msgs.slice(i, i + chunkSize).forEach(m => batch.delete(doc(db, 'messages', m.id)));
        await batch.commit();
      }
      addNotification('Chat cleared.', 'info', currentUser.id);
    } catch (err) {
      console.error('[ClearChat]', err);
      alert('Failed to clear chat. Please try again.');
    }
  };

  // -- Audio / Video Call Functions (Real WebRTC with Firestore Signaling) ----
  const formatCallDuration = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const callDocIdRef = useRef(null);

  // Check available devices before requesting
  const checkDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(d => d.kind === 'audioinput');
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      return { hasAudio, hasVideo };
    } catch { return { hasAudio: false, hasVideo: false }; }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer audio/webm, fallback to whatever is supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Stop all tracks immediately
        stream.getTracks().forEach(track => track.stop());
        // Build blob from collected chunks
        const chunks = [...audioChunksRef.current];
        if (chunks.length === 0) { setIsRecording(false); return; }
        const blob = new Blob(chunks, { type: mimeType });
        // Convert to base64 and save
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Data = reader.result;
            if (!base64Data || base64Data.length < 100) return; // skip empty
            const msgData = {
              senderId: currentUser.id, text: '', voiceNote: base64Data, type: 'voice',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: serverTimestamp()
            };
            if (replyTo) {
              msgData.replyToId = replyTo.id;
              msgData.replyToText = replyTo.type === 'voice' ? 'Voice note' : (replyTo.text || '').slice(0, 80);
              msgData.replyToSender = replyTo.senderId;
            }
            if (isGroupChat) msgData.groupId = selectedGroup.id;
            else if (selectedChatUser) msgData.receiverId = selectedChatUser.id;
            else return;
            await addDoc(collection(db, 'messages'), msgData);
            setReplyTo(null);
          } catch (err) { console.error('[VoiceSave]', err); }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      // Use timeslice to ensure ondataavailable fires periodically
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.warn('Mic access denied:', err);
      alert('Microphone access is required for voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Message swipe handlers
  const handleMsgTouchStart = (e) => {
    msgTouchStartXRef.current = e.touches[0].clientX;
    msgTouchStartYRef.current = e.touches[0].clientY;
  };
  const handleMsgTouchEnd = (e, msg) => {
    const dx = e.changedTouches[0].clientX - msgTouchStartXRef.current;
    const dy = Math.abs(e.changedTouches[0].clientY - msgTouchStartYRef.current);
    if (dy > 40) return; // vertical scroll, ignore
    const isMe = msg.senderId === currentUser.id;
    if (dx < -60) {
      // Swipe left = Reply
      setReplyTo(msg);
      setSwipedMsgId(null);
      inputRef.current?.focus();
    } else if (dx > 60 && isMe) {
      // Swipe right on own message = show delete
      setSwipedMsgId(msg.id);
    }
  };

  const renderMessageContent = (msg) => {
    if (msg.type === 'voice' && msg.voiceNote) {
      const isMe = msg.senderId === currentUser.id;
      return (
        <div className="flex items-center gap-2 min-w-[180px]">
          <Mic size={14} className={isMe ? 'text-white/70 shrink-0' : 'text-indigo-400 shrink-0'}/>
          <audio controls src={msg.voiceNote} className="max-w-full flex-1" style={{ height: 36, filter: isMe ? 'invert(1) brightness(2)' : 'none' }}/>
        </div>
      );
    }
    if (msg.type === 'system') {
      return <span className="text-xs italic opacity-80">{msg.text}</span>;
    }
    const text = msg.text || '';
    const taskPattern = /\[Task: (.*?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = taskPattern.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(<span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>);
      const taskTitle = match[1];
      const foundTask = tasks.find(t => t.title === taskTitle);
      parts.push(
        <button key={match.index} onClick={() => { if (foundTask) setSelectedTask(foundTask); }}
          className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-xs font-black transition-all active:scale-95 w-full text-start">
          <ClipboardList size={12} className="shrink-0"/><span className="truncate">{taskTitle}</span>
        </button>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
    return parts.length > 0 ? <>{parts}</> : text;
  };

  const myGroups = useMemo(() => (groups || []).filter(g => (g.members || []).includes(currentUser?.id)), [groups, currentUser]);
  const filteredUsers = useMemo(() => {
    const others = users.filter(u => u.id !== currentUser?.id);
    if (!searchQuery.trim()) return others;
    const q = searchQuery.toLowerCase();
    return others.filter(u => u.username.toLowerCase().includes(q) || u.id.includes(q));
  }, [users, currentUser, searchQuery]);

  // -- Contact / Group List ----------------------------------------------------
  if (!chatTarget) {
    return (
      <>
        <div className="bg-white rounded-[2.5rem] p-4 md:p-5 shadow-sm border border-slate-100 min-h-[60vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2"><MessageSquare size={16} className="text-indigo-600"/> {t('chat')}</h3>
            {isAdmin && <button onClick={() => setShowCreateGroup(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"><Plus size={16}/></button>}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setViewTab('contacts')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewTab === 'contacts' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Contacts</button>
            <button onClick={() => setViewTab('groups')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${viewTab === 'groups' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}><Users size={10}/> Groups</button>
          </div>

          {/* Search */}
          <div className="mb-3 relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full ps-9 pe-3 py-2.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm text-slate-800 border-none"/>
          </div>

          {viewTab === 'contacts' ? (
            <div ref={listRef} className="space-y-2 flex-1 overflow-y-auto">
              {filteredUsers.map(u => {
                const lastMsg = [...messages].reverse().find(m => (m.senderId === currentUser.id && m.receiverId === u.id) || (m.senderId === u.id && m.receiverId === currentUser.id));
                const liveUser = users.find(lu => lu.id === u.id) || u;
                return (
                  <div key={u.id} id={`contact-card-${u.id}`} className="flex items-center gap-2 bg-slate-50 rounded-[2rem] hover:bg-white hover:border hover:border-indigo-100 hover:shadow-md transition-all border border-transparent group p-1">
                    <div className="flex-1 min-w-0 relative overflow-hidden rounded-[1.5rem] bg-slate-50">
                      <div className={`w-full flex items-center justify-between gap-3 p-2 text-start outline-none bg-slate-50 relative z-10 transition-transform duration-300 hover:bg-white cursor-pointer ${swipedUserId === u.id ? '-translate-x-[4.5rem]' : 'translate-x-0'}`}
                        onClick={(e) => { if (Date.now() - lastSwipeTimeRef.current < 200) return; if (e.target.closest('button')) return; if (swipedUserId === u.id) { setSwipedUserId(null); return; } if (swipedUserId) { setSwipedUserId(null); return; } setSelectedChatUser(u); }}
                        onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
                        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchStartXRef.current; if (dx < -40 && swipedUserId !== u.id) { lastSwipeTimeRef.current = Date.now(); setSwipedUserId(u.id); } else if (dx > 30 && swipedUserId === u.id) { lastSwipeTimeRef.current = Date.now(); setSwipedUserId(null); } }}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative shrink-0"><div className="w-11 h-11 rounded-full bg-indigo-50 flex items-center justify-center font-black text-indigo-600 shadow-sm">{u.username.charAt(0).toUpperCase()}</div>{liveUser.isOnline && <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow-sm"/>}</div>
                          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 flex-wrap"><p className="font-black text-slate-800 text-[15px] truncate max-w-[140px]">{u.username}</p><span className="text-[8px] font-black bg-white shadow-sm text-slate-400 px-1.5 py-0.5 rounded-md uppercase">{u.role}</span></div>
                            <p className="text-[13px] text-slate-400 truncate mt-0.5 font-medium block">{lastMsg ? (lastMsg.type === 'voice' ? 'Voice note' : lastMsg.text?.length > 38 ? lastMsg.text.slice(0,35)+'...' : lastMsg.text) : t('noMessages')}</p></div>
                        </div>
                        <div className="md:hidden flex items-center shrink-0"><button onClick={(e) => { e.stopPropagation(); setSelectedChatUser(u); }} className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm"><MessageSquare size={16}/></button></div>
                        <div className="hidden md:flex flex-row items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedChatUser(u); }} className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><MessageSquare size={14}/></button>
                          {isAdmin && <><button onClick={(e) => { e.stopPropagation(); setEditUser(u); }} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-600 hover:text-white transition-all shadow-sm"><Pencil size={14}/></button>
                            {!u.permanent && !PROTECTED_IDS.includes(u.id) && <button onClick={(e) => { e.stopPropagation(); setDeleteUser(u); }} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={14}/></button>}</>}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="md:hidden absolute inset-y-0 end-0 flex items-center gap-1 pe-2 z-0 justify-end w-[4.5rem]">
                          <button onClick={() => setEditUser(u)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shadow-sm"><Pencil size={14}/></button>
                          {!u.permanent && !PROTECTED_IDS.includes(u.id) && <button onClick={() => setDeleteUser(u)} className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-sm"><Trash2 size={14}/></button>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto">
              {myGroups.length === 0 ? (
                <div className="text-center py-12"><Users size={32} className="text-slate-200 mx-auto mb-3"/><p className="text-sm font-bold text-slate-400">No groups yet</p></div>
              ) : myGroups.map(g => {
                const canDeleteGroup = isAdmin || (g.adminIds || []).includes(currentUser.id);
                return (
                  <div key={g.id} className="relative overflow-hidden rounded-[2rem]">
                    {/* Delete button revealed on swipe */}
                    {canDeleteGroup && (
                      <div className="absolute inset-y-0 end-0 w-20 bg-red-500 flex items-center justify-center rounded-e-[2rem] z-0">
                        <button onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete group "${g.name}"? All messages will be deleted.`)) deleteGroup(g.id);
                        }} className="text-white flex flex-col items-center gap-0.5">
                          <Trash2 size={18}/>
                          <span className="text-[8px] font-black uppercase">Delete</span>
                        </button>
                      </div>
                    )}
                    {/* Swipeable group card */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-indigo-100 relative z-10"
                      style={{touchAction:'pan-y'}}
                      onTouchStart={(e) => { e.currentTarget._touchStartX = e.touches[0].clientX; e.currentTarget._swiped = false; }}
                      onTouchMove={(e) => {
                        if (!canDeleteGroup) return;
                        const dx = e.touches[0].clientX - (e.currentTarget._touchStartX || 0);
                        const clampedDx = Math.max(-80, Math.min(0, dx));
                        e.currentTarget.style.transform = `translateX(${clampedDx}px)`;
                        e.currentTarget.style.transition = 'none';
                        if (dx < -40) e.currentTarget._swiped = true;
                        else e.currentTarget._swiped = false;
                      }}
                      onTouchEnd={(e) => {
                        if (e.currentTarget._swiped && canDeleteGroup) {
                          e.currentTarget.style.transform = 'translateX(-80px)';
                        } else {
                          e.currentTarget.style.transform = 'translateX(0)';
                        }
                        e.currentTarget.style.transition = 'transform 0.25s ease';
                      }}
                      onClick={(e) => {
                        if (e.currentTarget.style.transform === 'translateX(-80px)') {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.transition = 'transform 0.25s ease';
                          return;
                        }
                        setSelectedGroup(g);
                      }}>
                      <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-600 shadow-sm shrink-0"><Users size={18}/></div>
                      <div className="flex-1 min-w-0"><p className="font-black text-slate-800 text-[15px] truncate">{g.name}</p><p className="text-[11px] text-slate-400 font-bold">{(g.members||[]).length} members</p></div>
                      <button onClick={(e) => { e.stopPropagation(); setShowGroupInfo(g); }} className="p-2 text-slate-300 hover:text-indigo-500 rounded-lg hover:bg-indigo-50 shrink-0"><Info size={16}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedTask && <TaskDetailPopup task={selectedTask} onClose={() => setSelectedTask(null)}/>}
        {editUser && <EditUserRolePopup user={editUser} onClose={() => setEditUser(null)}/>}
        {deleteUser && <DeleteUserConfirm user={deleteUser} onClose={() => setDeleteUser(null)}/>}
        {showGroupInfo && <GroupInfoModal group={showGroupInfo} onClose={() => setShowGroupInfo(null)} onDeleteGroup={deleteGroup}/>}
        {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)}/>}
      </>
    );
  }

  const activeChatName = isGroupChat ? selectedGroup.name : (users.find(u => u.id === selectedChatUser?.id) || selectedChatUser)?.username || '';
  const activeChatOnline = isGroupChat ? false : (users.find(u => u.id === selectedChatUser?.id) || selectedChatUser)?.isOnline;
  const activeChatRole = isGroupChat ? null : (users.find(u => u.id === selectedChatUser?.id) || selectedChatUser)?.role;

  // -- Chat View ----------------------------------------------------------------
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col animate-in slide-in-from-right-8 duration-300"
        style={{ paddingTop: 'var(--app-safe-top)', paddingRight: 'var(--app-safe-right)', paddingLeft: 'var(--app-safe-left)' }}>
        {/* Header */}
        <div className="px-4 py-3 bg-white flex items-center gap-3 border-b border-slate-100 shadow-sm z-20">
          <button onClick={() => { setSelectedChatUser(null); setSelectedGroup(null); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><ChevronLeft size={22}/></button>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 ${isGroupChat ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 border border-indigo-100 text-indigo-600'}`}>
            {isGroupChat ? <Users size={16}/> : activeChatName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5 truncate">
              {activeChatName}
              {activeChatRole && (activeChatRole === 'admin' || activeChatRole === 'ceo') && <ShieldCheck size={13} className="text-indigo-600"/>}
            </h3>
            {!isGroupChat && <p className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${activeChatOnline ? 'text-emerald-500' : 'text-slate-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${activeChatOnline ? 'bg-emerald-400' : 'bg-slate-300'}`}/>{activeChatOnline ? t('online') : t('offline')}</p>}
            {isGroupChat && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{(selectedGroup.members||[]).length} members</p>}
          </div>
          <div className="flex gap-1">            {isGroupChat && <button onClick={() => setShowGroupInfo(selectedGroup)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50"><Info size={18}/></button>}
            <button onClick={clearChat} className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50" title="Clear Chat"><Trash2 size={16}/></button>
          </div>
        </div>


        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 w-full mx-auto">
          <div className="text-center py-4"><span className="inline-block px-4 py-1.5 bg-slate-200/50 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">{t('endToEnd')}</span></div>
          {filteredMessages.map((msg, i) => {
            const isMe = msg.senderId === currentUser.id;
            const sender = users.find(u => u.id === msg.senderId);
            const replyToSenderName = msg.replyToSender ? (users.find(u => u.id === msg.replyToSender)?.username || 'Unknown') : '';
            return (
              <div key={msg.id || i}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-1 duration-150 relative`}
                onTouchStart={handleMsgTouchStart}
                onTouchEnd={(e) => handleMsgTouchEnd(e, msg)}
                onContextMenu={(e) => { e.preventDefault(); if (isMe) setContextMenu({ id: msg.id, x: e.clientX, y: e.clientY }); }}>
                {isGroupChat && !isMe && <span className="text-[9px] font-black text-indigo-500 px-2 mb-0.5">{sender?.username || 'Unknown'}</span>}
                {/* Reply preview */}
                {msg.replyToText && (
                  <div className={`px-3 py-1.5 mb-1 rounded-xl text-[10px] font-bold border-s-2 max-w-[75%] truncate ${isMe ? 'bg-indigo-500/30 text-indigo-100 border-indigo-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
                    <span className="font-black text-[9px] uppercase tracking-wider block">{replyToSenderName}</span>
                    {msg.replyToText}
                  </div>
                )}
                <div className={`p-3 md:p-4 rounded-[2rem] max-w-[82%] ${isMe ? 'bg-indigo-600 text-white rounded-br-md shadow-md shadow-indigo-200' : 'bg-white border border-slate-100 text-slate-800 rounded-bl-md shadow-sm'}`}>
                  <div className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{renderMessageContent(msg)}</div>
                </div>
                <div className="flex items-center gap-1.5 px-2 mt-1">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{msg.timestamp}</span>
                  {/* Reply button (desktop) */}
                  <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="text-slate-300 hover:text-indigo-400 transition-colors" title="Reply"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
                  {isMe && msg.id && <button onClick={() => deleteMessage(msg.id)} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={10}/></button>}
                </div>
                {/* Swipe-right delete overlay */}
                {swipedMsgId === msg.id && isMe && (
                  <div className="absolute inset-y-0 end-0 flex items-center pe-1 z-10">
                    <button onClick={() => { deleteMessage(msg.id); setSwipedMsgId(null); }}
                      className="px-3 py-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase shadow-lg animate-in slide-in-from-right-2 duration-150">Delete</button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef}/>
        </div>

        {/* Input */}
        <div className="absolute bottom-0 start-0 end-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 z-20" style={{paddingBottom: 'max(12px, env(safe-area-inset-bottom))'}}>
          {/* Reply preview bar */}
          {replyTo && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-150">
              <div className="w-1 h-8 bg-indigo-500 rounded-full shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{users.find(u => u.id === replyTo.senderId)?.username || 'Unknown'}</p>
                <p className="text-xs text-slate-500 font-medium truncate">{replyTo.type === 'voice' ? 'Voice note' : (replyTo.text || '').slice(0, 60)}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"><X size={14}/></button>
            </div>
          )}
          <div className="w-full mx-auto relative px-2 md:px-4 p-3">
            {showTaskPicker && (
              <div className="absolute bottom-full mb-2 start-0 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 z-30 max-h-60 overflow-y-auto animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-50"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><ClipboardList size={12}/> {t('attachTask')}</span><button onClick={() => setShowTaskPicker(false)} className="p-1 hover:bg-slate-50 rounded-lg"><X size={13} className="text-slate-400"/></button></div>
                {tasks.filter(task => task.employeeId === currentUser.id || isAdmin).map(task => (
                  <button key={task.id} onClick={() => { setChatInput(prev => prev ? `${prev} [Task: ${task.title}]` : `[Task: ${task.title}]\n`); setShowTaskPicker(false); }} className="w-full text-start p-2.5 hover:bg-slate-50 rounded-2xl transition-all block mb-1">
                    <span className="text-xs font-black text-slate-700 block truncate">{task.title}</span><span className="text-[8px] font-bold text-slate-400 uppercase">{task.status}</span>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-[2rem] px-1.5 py-1 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all gap-0.5">
                <button type="button" onClick={() => { setShowTaskPicker(!showTaskPicker); }} className={`p-2 rounded-full transition-colors shrink-0 ${showTaskPicker ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`}><Link size={16}/></button>
                <input ref={inputRef} placeholder={t('typeMessage')} className="flex-1 px-2 py-2 bg-transparent border-none outline-none text-sm font-bold text-slate-800 placeholder-slate-400 min-w-0" value={chatInput} onChange={e => setChatInput(e.target.value)}/>
                {isRecording ? (
                  <button type="button" onClick={stopRecording} className="w-10 h-10 shrink-0 bg-red-500 text-white rounded-full flex items-center justify-center animate-pulse"><MicOff size={16}/></button>
                ) : chatInput.trim() ? (
                  <button type="submit" className="w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-md shadow-indigo-200 transition-all active:scale-95"><Send size={16}/></button>
                ) : (
                  <button type="button" onClick={startRecording} className="w-10 h-10 shrink-0 bg-slate-200 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-full flex items-center justify-center transition-all"><Mic size={16}/></button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {selectedTask && <TaskDetailPopup task={selectedTask} onClose={() => setSelectedTask(null)}/>}
      {showGroupInfo && <GroupInfoModal group={showGroupInfo} onClose={() => setShowGroupInfo(null)} onDeleteGroup={deleteGroup}/>}
    </>
  );
};

export default ChatEngine;
