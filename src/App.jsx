import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import OPDRegistration from './components/OPDRegistration';
import DoctorDashboard from './components/DoctorDashboard';
import LabDashboard from './components/LabDashboard';
import RadiologyTechDashboard from './components/RadiologyTechDashboard';
import RadiologyDashboard from './components/RadiologyDashboard';
import PharmacistDashboard from './components/PharmacistDashboard';
import CompanyMaster from './components/CompanyMaster';
import { LogOut, User, UserCheck, Stethoscope, Package, Shield, TestTube, Film, Camera } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeModule, setActiveModule] = useState('reception');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gnh_user_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          setCurrentUser(parsed);
          routeRoleModule(parsed.role);
        }
      }
    } catch {
      localStorage.removeItem('gnh_user_session');
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const routeRoleModule = (role) => {
    if (role === 'doctor') setActiveModule('doctor');
    else if (role === 'lab_technician') setActiveModule('lab');
    else if (role === 'radiology_tech') setActiveModule('radio_tech');
    else if (role === 'radiologist') setActiveModule('radiology');
    else if (role === 'pharmacist') setActiveModule('pharmacy');
    else setActiveModule('reception');
  };

  const handleLoginSuccess = (user) => {
    localStorage.setItem('gnh_user_session', JSON.stringify(user));
    setCurrentUser(user);
    routeRoleModule(user.role);
  };

  const handleLogout = () => {
    localStorage.removeItem('gnh_user_session');
    setCurrentUser(null);
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-mono">
        Loading Guru Nanak Hospital HIS...
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* App Header */}
      <header className="print:hidden bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-base">
            G
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide">GURU NANAK HOSPITAL</div>
            <div className="text-[10px] text-slate-400">Palwal • Comprehensive Clinical HIS & PACS</div>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveModule('reception')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
              activeModule === 'reception' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Intake Desk
          </button>
          <button
            onClick={() => setActiveModule('doctor')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
              activeModule === 'doctor' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" /> Doctor Desk
          </button>
          <button
            onClick={() => setActiveModule('lab')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
              activeModule === 'lab' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <TestTube className="w-3.5 h-3.5 text-amber-300" /> Lab Tech
          </button>
          <button
            onClick={() => setActiveModule('radio_tech')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
              activeModule === 'radio_tech' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-indigo-300" /> Radio Tech
          </button>
          <button
            onClick={() => setActiveModule('radiology')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
              activeModule === 'radiology' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-blue-300" /> Radiologist PACS
          </button>
          <button
            onClick={() => setActiveModule('pharmacy')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
              activeModule === 'pharmacy' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Pharmacy
          </button>
          <button
            onClick={() => setActiveModule('company_master')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
              activeModule === 'company_master' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" /> Tariffs
          </button>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-100 flex items-center justify-end gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              {currentUser.full_name}
            </div>
            <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
              {currentUser.role}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-semibold transition shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Workspace Injection */}
      <main className="flex-1">
        {activeModule === 'reception' && <OPDRegistration />}
        {activeModule === 'doctor' && <DoctorDashboard initialDoctorId={currentUser.doctor_id} />}
        {activeModule === 'lab' && <LabDashboard />}
        {activeModule === 'radio_tech' && <RadiologyTechDashboard />}
        {activeModule === 'radiology' && <RadiologyDashboard />}
        {activeModule === 'pharmacy' && <PharmacistDashboard />}
        {activeModule === 'company_master' && <CompanyMaster />}
      </main>
    </div>
  );
}
