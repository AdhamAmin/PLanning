import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Login from '../pages/Login';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import TaskEngine from '../pages/TaskEngine';

// Placeholder Pages
const ChatEngine = () => <div className="p-8"><h2 className="text-2xl font-black mb-4">Chat Engine</h2></div>;
const WeeklyPlan = () => <div className="p-8"><h2 className="text-2xl font-black mb-4">Weekly Plan</h2></div>;
const Efficiency = () => <div className="p-8"><h2 className="text-2xl font-black mb-4">Efficiency Dashboard</h2></div>;
const Alerts = () => <div className="p-8"><h2 className="text-2xl font-black mb-4">Smart Alerts</h2></div>;
const AdminHQ = () => <div className="p-8"><h2 className="text-2xl font-black mb-4">Admin HQ</h2></div>;
const LiveMap = () => <div className="p-8"><h2 className="text-2xl font-black mb-4">CEO Live Map</h2></div>;

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAppContext();
  if (!currentUser) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 font-sans">
      <Header />
      <main className="max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {children}
      </main>
      <Navigation />
    </div>
  );
};

const App = () => {
  const { currentUser, isCEO, isAdmin } = useAppContext();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={currentUser ? <Navigate to="/tasks" replace /> : <Login />} />
        
        <Route path="/tasks" element={<ProtectedRoute><TaskEngine /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatEngine /></ProtectedRoute>} />
        <Route path="/weekly-plan" element={<ProtectedRoute><WeeklyPlan /></ProtectedRoute>} />
        <Route path="/efficiency" element={<ProtectedRoute><Efficiency /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
        
        {/* Admin/CEO Routes */}
        <Route path="/admin" element={
          <ProtectedRoute>
            {(isAdmin || isCEO) ? <AdminHQ /> : <Navigate to="/tasks" />}
          </ProtectedRoute>
        } />
        
        <Route path="/live-map" element={
           <ProtectedRoute>
             {isCEO ? <LiveMap /> : <Navigate to="/tasks" />}
           </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to={currentUser ? "/tasks" : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
