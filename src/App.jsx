import React, { useState, useEffect } from 'react';
import IntakeDashboard from './components/IntakeDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import LabDashboard from './components/LabDashboard';
import RadiologyDashboard from './components/RadiologyDashboard';
import { 
  Building2, Stethoscope, FlaskConical, Film, 
  LogOut, User, ShieldCheck, AlertCircle 
} from 'lucide-react';

// Production Error Boundary to prevent blank screens
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-red-800/60 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-red-950/80 border border-red-600/50 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-white">Workstation Render Notice</h2>
            <p className="text-xs text-slate-400">
              {this.state.error?.message || "An unexpected error occurred while loading this view."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow transition"
            >
              Reload Workstation
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gnh_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('reception');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Default demo accounts
  const ACCOUNTS = [
    { username: 'reception', role: 'reception', name: 'Front Desk Reception', defaultTab: 'reception' },
    { username: 'doctor', role: 'doctor', name: 'Dr. Inderjit Singh (Consultant)', defaultTab: 'doctor' },
    { username: 'labtech', role: 'labtech', name: 'Pathology & Diagnostic Desk', defaultTab: 'labtech' },
    { username: 'drkalyan', role: 'radiology', name: 'Dr. Kalyan (Radiology & PACS)', defaultTab: 'radiology' }
  ];

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'doctor') setActiveTab('doctor');
      else if (currentUser.role === 'labtech') setActiveTab('labtech');
      else if (currentUser.role === 'radiology') setActiveTab('radiology');
      else setActiveTab('reception');
    }
  }, [currentUser]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');

    const u = username.trim().toLowerCase();
    const p = password.trim();

    if (!u || !p) {
      setLoginError('Please enter username and password');
      return;
    }

    const matched = ACCOUNTS.find(a => a.username === u);
    if (matched && p === 'gnh123') {
      const userData = { ...matched };
      setCurrentUser(userData);
      localStorage.setItem('gnh_user', JSON.stringify(userData));
    } else {
      setLoginError('Invalid credentials. (Hint: use reception, doctor, labtech, or drkalyan with password gnh123)');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gnh_user');
    setCurrentUser(null);
    setUsername('');
    setPassword('');
  };

  // Quick Switcher helper
  const quickLogin = (acc) => {
    setCurrentUser(acc);
    localStorage.setItem('gnh_user', JSON.stringify(acc));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto shadow-lg mb-3">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-wide text-white">GURU NANAK HOSPITAL</h1>
            <p className="text-xs text-slate-400">Enterprise Clinical Information & PACS Ecosystem</p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-950/80 border border-red-700/60 rounded text-red-300 text-xs font-semibold text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Username / Desk ID</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. reception, doctor, labtech, drkalyan"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (gnh123)"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition text-xs tracking-wider uppercase"
            >
              Sign In to Workstation
            </button>
          </form>

          {/* 1-Click Role Logins for Fast Access */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Quick Access Portals</div>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNTS.map((acc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => quickLogin(acc)}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-left transition flex flex-col"
                >
                  <span className="font-bold text-xs text-slate-200">{acc.username}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{acc.role} Desk</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
        {/* Top Navbar */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs print:hidden">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              <span className="font-black text-sm tracking-wide text-white">GNH EMR</span>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('reception')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition text-xs ${
                  activeTab === 'reception' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Reception
              </button>
              <button
                onClick={() => setActiveTab('doctor')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition text-xs ${
                  activeTab === 'doctor' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" /> Doctor Desk
              </button>
              <button
                onClick={() => setActiveTab('labtech')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition text-xs ${
                  activeTab === 'labtech' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" /> Lab Desk
              </button>
              <button
                onClick={() => setActiveTab('radiology')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition text-xs ${
                  activeTab === 'radiology' ? 'bg-blue-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" /> Radiology PACS
              </button>
            </nav>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="font-bold text-slate-200">{currentUser.name}</div>
              <div className="text-[10px] text-emerald-400 font-mono flex items-center justify-end gap-1">
                <ShieldCheck className="w-3 h-3" /> {currentUser.role?.toUpperCase()}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 bg-slate-800 hover:bg-red-950/60 hover:text-red-400 border border-slate-700 rounded text-slate-300 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Workstation View Area */}
        <main className="flex-1 flex flex-col">
          <ErrorBoundary>
            {activeTab === 'reception' && <IntakeDashboard />}
            {activeTab === 'doctor' && <DoctorDashboard />}
            {activeTab === 'labtech' && <LabDashboard />}
            {activeTab === 'radiology' && <RadiologyDashboard />}
          </ErrorBoundary>
        </main>
      </div>
    </ErrorBoundary>
  );
}
