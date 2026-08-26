import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, User, ShieldCheck, AlertCircle, Building2, KeyRound } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      // Look up credentials in staff_users table
      const { data, error } = await supabase
        .from('staff_users')
        .select('id, username, full_name, role, doctor_id, is_active')
        .eq('username', username.trim().toLowerCase())
        .eq('password_hash', password.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setErrorMessage('Invalid username or password. Please try again.');
        setLoading(false);
        return;
      }

      // Persist session to LocalStorage
      localStorage.setItem('gnh_user_session', JSON.stringify(data));
      onLoginSuccess(data);
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (user, pass) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-2xl bg-blue-600 text-white mb-2 shadow-lg">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black tracking-wider text-white uppercase">GURU NANAK HOSPITAL</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Clinical EMR & Hospital Information Portal</p>
      </div>

      {/* Main Login Card */}
      <div className="bg-white rounded-xl shadow-2xl border border-slate-800 p-8 max-w-md w-full">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Secure Staff Authentication
          </h2>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Staff Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. reception, ortho, pharma"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold border border-slate-300 rounded focus:ring-1 focus:ring-blue-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold border border-slate-300 rounded focus:ring-1 focus:ring-blue-600 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>

        {/* Quick Testing Account Shortcuts */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Quick Access (Dev / Testing):</div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              onClick={() => handleQuickFill('reception', 'gnh123')}
              className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-center truncate"
            >
              Reception
            </button>
            <button
              onClick={() => handleQuickFill('ortho', 'gnh123')}
              className="py-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold text-center truncate"
            >
              Dr. Ortho
            </button>
            <button
              onClick={() => handleQuickFill('pharma', 'gnh123')}
              className="py-1 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded font-semibold text-center truncate"
            >
              Pharmacy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
