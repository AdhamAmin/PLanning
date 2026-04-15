import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, User, Loader2, Link, X, Check, ClipboardList, BarChart2, PieChart, Activity } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import useT from '../i18n/useT';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || null;

const AIAssistant = ({ isGlobal = false, onClose = null }) => {
  const { tasks, users, currentUser, isAdmin, events, notifications } = useAppContext();
  const t = useT();
  const location = useLocation();
  const taskContext = location.state?.taskContext || null;

  const getGreeting = () => {
    if (taskContext) {
      return `Hello! I see you want to discuss the task "${taskContext.title}" (${taskContext.status}, ${taskContext.priority} priority). What would you like to know?`;
    }
    return t('aiGreet');
  };

  const [messages, setMessages] = useState([{ role: 'model', text: getGreeting() }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const myTasks = isAdmin ? tasks : tasks.filter(tk => tk.employeeId === currentUser.id);

  const buildSystemInstruction = () => {
    const now = new Date();
    const completed = myTasks.filter(tk => tk.status === 'completed').length;
    const inProgress = myTasks.filter(tk => tk.status === 'in progress').length;
    const overdue = myTasks.filter(tk => tk.dueDate && tk.status !== 'completed' && new Date(tk.dueDate) < now).length;
    const completionRate = myTasks.length > 0 ? Math.round((completed / myTasks.length) * 100) : 0;

    // Full task details
    const tasksJSON = myTasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate || null,
      employee: t.employee || 'Unassigned',
      employeeId: t.employeeId
    })).slice(0, 60);

    // Team stats per user (admin only)
    const teamStats = isAdmin ? users.map(u => {
      const uTasks = tasks.filter(t => t.employeeId === u.id);
      const uDone = uTasks.filter(t => t.status === 'completed').length;
      const uPct = uTasks.length > 0 ? Math.round((uDone / uTasks.length) * 100) : 0;
      return { id: u.id, name: u.username, role: u.role, total: uTasks.length, completed: uDone, pct: uPct };
    }) : [];

    // Upcoming events
    const upcomingEvents = events.slice(0, 20).map(ev => ({
      title: ev.title,
      date: ev.date,
      time: ev.time,
      notes: ev.notes || ''
    }));

    // Recent notifications
    const recentNotifs = notifications.slice(0, 10).map(n => ({ text: n.text, type: n.type, time: n.time }));

    return `You are DrWEEE AI, the intelligent assistant built into the DrWEEE Flow enterprise platform.
You are speaking with: ${currentUser.username} (Role: ${currentUser.role}).
Current date/time: ${now.toLocaleString()}.

=== TASK ANALYTICS ===
Total tasks: ${myTasks.length} | Completed: ${completed} | In Progress: ${inProgress} | Overdue: ${overdue} | Completion rate: ${completionRate}%

=== ALL TASKS (up to 60) ===
${JSON.stringify(tasksJSON)}

${ isAdmin ? `=== TEAM MEMBERS & STATS ===
${JSON.stringify(teamStats)}

` : ''}=== CALENDAR EVENTS ===
${upcomingEvents.length > 0 ? JSON.stringify(upcomingEvents) : 'No events scheduled.'}

=== RECENT ALERTS/NOTIFICATIONS ===
${recentNotifs.length > 0 ? JSON.stringify(recentNotifs) : 'No recent notifications.'}

=== YOUR CAPABILITIES ===
- You know every task by name and ID. When referencing a task, always use the format [Task: Exact Task Title] to render it as a clickable card.
- If asked to CREATE a task, collect the details then append exactly: [CREATE_TASK_FORM]
- If asked to show a LEADERBOARD or team rankings, append exactly: [CHART: LEADERBOARD]
- If asked to show EFFICIENCY or task completion graphs, append exactly: [CHART: EFFICIENCY]
- You can discuss calendar events, alerts, user roles, and team performance using the data above.
- Always be concise, data-driven, and professional. Mirror the language the user writes in.`;
  };

  const buildHistory = () =>
    messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    try {
      if (!GEMINI_KEY) {
        await new Promise(r => setTimeout(r, 600));
        setMessages(prev => [...prev, {
          role: 'model',
          text: `✅ Got your message: "${userText}"\n\nTo connect real AI, add your VITE_GEMINI_API_KEY to the .env file and restart the server.`
        }]);
        return;
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: buildSystemInstruction() }] },
            contents: [...buildHistory(), { role: 'user', parts: [{ text: userText }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          })
        }
      );

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error?.message || `API error ${res.status}`;
        setMessages(prev => [...prev, { role: 'model', text: `⚠️ AI Error: ${errMsg}` }]);
        return;
      }

      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate a response.';
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: `Connection error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const AITaskForm = () => {
    const [title, setTitle] = useState('');
    const [assignedTo, setAssignedTo] = useState(currentUser.id);
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [done, setDone] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!title.trim() || !dueDate) return;
      const assignedUser = users.find(u => u.id === assignedTo) || currentUser;
      await addDoc(collection(db, 'tasks'), {
        title,
        employee: assignedUser.username,
        employeeId: assignedUser.id,
        creatorId: currentUser.id,
        status: 'pending',
        priority,
        dueDate,
        taskType: 'standard',
        createdAt: serverTimestamp()
      });
      setMessages(prev => [...prev, {
        role: 'model',
        text: `Awesome! I've created that task for you:\n[Task: ${title}]`
      }]);
    };

    return (
      <form onSubmit={handleSubmit} className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3 shadow-inner">
        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Sparkles size={12}/> AI Task Creator</p>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('taskName')} className="w-full px-3 py-2 bg-white rounded-xl text-xs font-bold text-slate-700 outline-none border border-slate-100" required />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="w-full px-3 py-2 bg-white rounded-xl text-xs font-bold text-slate-700 outline-none border border-slate-100" />
          <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-3 py-2 bg-white rounded-xl text-xs font-black text-slate-700 outline-none border border-slate-100 uppercase tracking-widest">
            <option value="High">{t('highPriority')}</option>
            <option value="Medium">{t('mediumPriority')}</option>
            <option value="Low">{t('lowPriority')}</option>
          </select>
        </div>
        {isAdmin && (
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full px-3 py-2 bg-white rounded-xl text-xs font-bold text-slate-700 outline-none border border-slate-100">
            {users.map(u => <option key={u.id} value={u.id}>{t('assignee')}: {u.username}</option>)}
          </select>
        )}
        <button type="submit" disabled={!title.trim() || !dueDate} className="w-full py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all">{t('confirmTask')}</button>
      </form>
    );
  };

  const EfficiencyWidget = () => (
    <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <PieChart size={16} className="text-indigo-500" />
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Efficiency Chart</h4>
      </div>
      <div className="flex items-end gap-2 h-16 w-full">
        <div className="w-1/3 bg-indigo-200 rounded-t-sm h-[40%]"></div>
        <div className="w-1/3 bg-indigo-400 rounded-t-sm h-[70%] relative"><div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-indigo-600">+12%</div></div>
        <div className="w-1/3 bg-indigo-600 rounded-t-sm h-[100%] shadow-lg shadow-indigo-200"></div>
      </div>
      <div className="flex justify-between text-[8px] font-black tracking-widest text-slate-400 mt-2 uppercase">
        <span>Prev</span><span>Week</span><span>Now</span>
      </div>
    </div>
  );

  const LeaderboardWidget = () => {
    const ranked = users.map(u => {
      const uTasks = tasks.filter(t => t.employeeId === u.id);
      const done = uTasks.filter(t => t.status === 'completed').length;
      const pct = uTasks.length > 0 ? Math.round((done / uTasks.length) * 100) : 0;
      return { ...u, total: uTasks.length, done, pct };
    }).sort((a, b) => b.pct - a.pct).slice(0, 5);

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

    return (
      <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={16} className="text-emerald-500" />
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Team Leaderboard</h4>
        </div>
        <div className="space-y-2">
          {ranked.map((u, idx) => (
            <div key={u.id} className="flex items-center gap-2 bg-white p-2.5 border border-slate-100 rounded-xl">
              <span className="text-base shrink-0">{medals[idx]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-slate-700 uppercase truncate">{u.username}</span>
                  <span className="text-[10px] font-black text-emerald-600 shrink-0 ml-2">{u.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${u.pct}%` }} />
                </div>
                <span className="text-[8px] text-slate-400 font-bold mt-0.5 block">{u.done}/{u.total} tasks</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMessageContent = (text, role) => {
    let contentStr = text.replace('[CREATE_TASK_FORM]', '');
    let parts = [];
    
    // Check for Custom Charts
    let hasLeaderboard = false;
    let hasEfficiency = false;
    if (contentStr.includes('[CHART: LEADERBOARD]')) {
      hasLeaderboard = true;
      contentStr = contentStr.replace('[CHART: LEADERBOARD]', '');
    }
    if (contentStr.includes('[CHART: EFFICIENCY]')) {
      hasEfficiency = true;
      contentStr = contentStr.replace('[CHART: EFFICIENCY]', '');
    }

    // Task parsing
    const taskPattern = /\[Task: (.*?)\]/g;
    let lastIndex = 0;
    let match;
    while ((match = taskPattern.exec(contentStr)) !== null) {
      if (match.index > lastIndex) parts.push(<span key={lastIndex}>{contentStr.slice(lastIndex, match.index)}</span>);
      const taskTitle = match[1];
      const foundTask = tasks.find(t => t.title === taskTitle);
      parts.push(
        <div key={match.index} className={`mt-2 mb-2 p-3 rounded-2xl text-start cursor-pointer border transition-all active:scale-95 ${
          role === 'model' ? 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100/50' : 'bg-white/20 border-white/30 hover:bg-white/30'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={14} className={role === 'model' ? 'text-indigo-600' : 'text-white'}/>
            <span className={`text-xs font-black truncate ${role === 'model' ? 'text-slate-800' : 'text-white'}`}>{taskTitle}</span>
          </div>
          {foundTask && (
            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
              role === 'model' ? 'bg-white text-slate-400 border border-slate-100' : 'bg-black/10 text-white/80'
            }`}>{foundTask.status}</span>
          )}
        </div>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < contentStr.length) parts.push(<span key={lastIndex}>{contentStr.slice(lastIndex)}</span>);
    
    return (
      <>
        {parts.length > 0 ? parts : contentStr}
        {hasLeaderboard && <LeaderboardWidget />}
        {hasEfficiency && <EfficiencyWidget />}
        {text.includes('[CREATE_TASK_FORM]') && role === 'model' && <AITaskForm />}
      </>
    );
  };

  const wrapperClass = isGlobal
    ? "w-full h-full bg-white flex flex-col"
    : "w-full bg-white/50 backdrop-blur-3xl rounded-[2.5rem] p-4 shadow-sm border border-slate-100 h-full min-h-0 flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-300";

  return (
    <>
      <div className={wrapperClass} style={isGlobal ? { padding: '1.25rem' } : {}}>

      {/* AI Header */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-200 shrink-0">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">DrWEEE AI</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Powered by Gemini · Full System Access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {GEMINI_KEY ? (
            <span className="text-[9px] font-black bg-emerald-50 text-emerald-500 px-3 py-1.5 rounded-full uppercase tracking-widest border border-emerald-100">Live AI</span>
          ) : (
            <span className="text-[9px] font-black bg-amber-50 text-amber-500 px-3 py-1.5 rounded-full uppercase tracking-widest border border-amber-100">No Key</span>
          )}
          {isGlobal && onClose && (
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages — only this region scrolls */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0 pe-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2 duration-200`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
              msg.role === 'model' ? 'bg-indigo-500 shadow-md shadow-indigo-200/50' : 'bg-slate-200'
            }`}>
              {msg.role === 'model' ? <Sparkles size={14} className="text-white"/> : <User size={14} className="text-slate-500"/>}
            </div>
            <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-[13px] leading-relaxed whitespace-pre-wrap font-medium break-words ${
              msg.role === 'model'
                ? 'bg-white border border-slate-100 text-slate-600 shadow-lg shadow-slate-200/40 rounded-tl-sm'
                : 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50 rounded-tr-sm'
            }`}>
              {renderMessageContent(msg.text, msg.role)}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 mt-1">
              <Sparkles size={14} className="text-white"/>
            </div>
            <div className="bg-white border border-slate-100 rounded-[1.5rem] rounded-tl-sm p-4 shadow-lg">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-indigo-400"/>
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-300">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-2"/>
      </div>

      {/* Input Section (Contained within the card) */}
      <div className="shrink-0 pt-3 mt-2 border-t border-slate-100/50 relative">
        {/* Task Picker — slides up from input */}
        {showTaskPicker && (
          <div className="absolute bottom-[calc(100%+12px)] start-0 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 z-30 max-h-60 overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-2 border-b border-slate-50 mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📎 Attach Task</span>
              <button onClick={() => setShowTaskPicker(false)} className="p-1 rounded-full hover:bg-slate-50">
                <X size={13} className="text-slate-400"/>
              </button>
            </div>
            {myTasks.length === 0 ? (
              <p className="text-center text-slate-300 text-[11px] font-bold py-4">No tasks available</p>
            ) : myTasks.map(task => (
              <button key={task.id}
                onClick={() => {
                  setInput(prev => prev ? `${prev} [Task: ${task.title}]` : `Tell me about: [Task: ${task.title}]\n`);
                  setShowTaskPicker(false);
                }}
                className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 rounded-xl"
              >
                <p className="text-[12px] font-black text-slate-700 truncate">{task.title}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{task.status} · {task.priority || 'Medium'}</p>
              </button>
            ))}
          </div>
        )}

        {/* AI Suggestions Chips */}
        <div className="flex overflow-x-auto gap-2 pb-2 mb-2 snap-x hide-scrollbar">
          {['What is my next task?', 'Show Team Leaderboard', 'Show Efficiency Chart'].map(sugg => (
            <button key={sugg} onClick={() => setInput(sugg)}
              className="snap-start shrink-0 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest text-slate-500 rounded-full border border-slate-100 transition-colors whitespace-nowrap">
              {sugg}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <form onSubmit={sendMessage} className="flex items-center bg-white border border-slate-100 shadow-xl shadow-slate-200/50 rounded-full p-1.5 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all gap-1">
          <button
            type="button"
            onClick={() => setShowTaskPicker(v => !v)}
            className={`p-2.5 rounded-full transition-colors shrink-0 ${showTaskPicker ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-500'}`}
          >
            <Link size={16}/>
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your tasks..."
            className="flex-1 px-2 py-2.5 bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder-slate-400 min-w-0"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-[#a78bfa] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#a78bfa]/40 hover:bg-[#8b5cf6] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <Send size={13}/><span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
      
      </div>
    </>
  );
};

export default AIAssistant;
