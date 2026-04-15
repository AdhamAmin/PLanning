import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import InstallPrompt from './components/InstallPrompt';
import TaskEngine from './pages/TaskEngine';

// Lazy-load secondary routes; TaskEngine is default home — bundle with shell for instant /tasks
const Login = lazy(() => import('./pages/Login'));
const Alerts = lazy(() => import('./pages/Alerts'));
const WeeklyPlan = lazy(() => import('./pages/WeeklyPlan'));
const ChatEngine = lazy(() => import('./pages/ChatEngine'));
const AdminHQ = lazy(() => import('./pages/AdminHQ'));
const LiveMap = lazy(() => import('./pages/LiveMap'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));

// Minimal loading spinner
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAppContext();
  const location = useLocation();
  const isAIPanelRoute = location.pathname === '/ai';
  if (!currentUser) return <Navigate to="/login" replace />;
  return (
    <div
      className={`min-h-[100dvh] bg-[#F8FAFC] font-sans relative overflow-x-hidden w-full ${isAIPanelRoute ? 'flex flex-col' : ''}`}
      style={{
        paddingLeft: 'var(--app-safe-left)',
        paddingRight: 'var(--app-safe-right)'
      }}
    >
      <InstallPrompt />
      {/* Clean subtle background gradient — no floating bubbles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-400/5 blur-3xl"/>
        <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-purple-400/5 blur-3xl"/>
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-sky-400/5 blur-3xl"/>
      </div>
      <Header />
      <main
        className={`max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 w-full min-w-0 ${isAIPanelRoute ? 'flex-1 min-h-0 px-4 md:px-8 flex flex-col' : 'px-4 md:px-8 py-4'}`}
        style={{
          paddingBottom: 'calc(var(--app-safe-bottom) + 4.5rem)'
        }}
      >
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </main>
      <Navigation />
    </div>
  );
};

const PageRoute = ({ pageKey, children, fallback = '/tasks' }) => {
  const { currentUser, canAccessPage } = useAppContext();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (pageKey && canAccessPage && !canAccessPage(pageKey)) return <Navigate to={fallback} replace />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
};

/* Admin-only route: redirects workers to /tasks */
const AdminRoute = ({ children }) => {
  const { currentUser, isAdmin } = useAppContext();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/tasks" replace />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
};

const App = () => {
  const { currentUser, isCEO } = useAppContext();

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={currentUser ? <Navigate to="/tasks" replace /> : <Login />} />
          
          <Route path="/tasks" element={<PageRoute pageKey="tasks"><TaskEngine /></PageRoute>} />
          <Route path="/chat" element={<PageRoute pageKey="chat"><ChatEngine /></PageRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />

          {/* Planner: everyone can view, admins can manage inside page */}
          <Route path="/weekly-plan" element={<PageRoute pageKey="planner"><WeeklyPlan /></PageRoute>} />
          <Route path="/efficiency" element={<AdminRoute><AdminHQ /></AdminRoute>} />
          
          <Route path="/ai" element={<PageRoute pageKey="ai"><AIAssistant isGlobal={false} /></PageRoute>} />
          
          <Route path="/live-map" element={
             <PageRoute pageKey="live-map">
               {isCEO ? <LiveMap /> : <Navigate to="/tasks" />}
             </PageRoute>
          } />

          <Route path="/" element={<Navigate to={currentUser ? "/tasks" : "/login"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
