import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  UserPlus, Users, Search, RefreshCw, CheckCircle2, 
  Calendar, CreditCard, Building2, Phone, User
} from 'lucide-react';

export default function IntakeDashboard() {
  const [patients, setPatients] = useState([]);
  const [payers, setPayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // New Patient / Visit Form State
  const [uhid, setUhid] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('M');
  const [address, setAddress] = useState('Palwal, Haryana');
  const [selectedPayerId, setSelectedPayerId] = useState('');
  const [department, setDepartment] = useState('Orthopedics');
  const [consultantId, setConsultantId] = useState('Dr. Inderjit Singh');
  const [chiefComplaints, setChiefComplaints] = useState('');

  useEffect(() => {
    generateNewUhid();
    fetchPayers();
    fetchRecentVisits();
  }, []);

  const generateNewUhid = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setUhid(`GNH-${new Date().getFullYear()}-${randomNum}`);
  };

  const fetchPayers = async () => {
    try {
      const { data } = await supabase.from('master_payers').select('*').order('company_name');
      setPayers(data || []);
      if (data && data.length > 0) {
        setSelectedPayerId(data[0].payer_id);
      }
    } catch {
      setPayers([]);
    }
  };

  const fetchRecentVisits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opd_visits')
        .select('*, patients(*, master_payers(company_name))')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setPatients(data);
      } else {
        setPatients([]);
      }
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !age) {
      alert('Please fill in patient name, phone number, and age.');
      return;
    }

    try {
      // 1. Upsert Patient Record
      await supabase.from('patients').upsert({
        uhid: uhid,
        name: name.trim(),
        phone_number: phone.trim(),
        age_years: parseInt(age, 10),
        sex: sex,
        address: address,
        payer_id: selectedPayerId || null
      });

      // 2. Create OPD Visit / Token
      const tokenDisplay = `OPD-${Math.floor(10 + Math.random() * 90)}`;
      await supabase.from('opd_visits').insert({
        uhid: uhid,
        token_display: tokenDisplay,
        department: department,
        consultant_id: consultantId,
        chief_complaints: chiefComplaints || 'Routine Consultation',
        consult_stage: 'WAITING'
      });

      setStatusMsg(`✓ Patient ${name} registered successfully! Token: ${tokenDisplay}`);

      // Reset Form
      setName('');
      setPhone('');
      setAge('');
      setChiefComplaints('');
      generateNewUhid();
      fetchRecentVisits();
    } catch (err) {
      alert('Error registering patient: ' + err.message);
    }
  };

  const filteredVisits = (patients || []).filter(v => {
    const q = (searchQuery || '').toLowerCase();
    const pName = v.patients?.name?.toLowerCase() || '';
    const pUhid = (v.uhid || '').toLowerCase();
    const pToken = (v.token_display || '').toLowerCase();
    return pName.includes(q) || pUhid.includes(q) || pToken.includes(q);
  });

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-2 md:p-4 flex flex-col space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide text-white">Front Desk & Intake Registration</h1>
            <p className="text-[11px] text-slate-400">Patient Registration • Token Generation • Master Payer Billing</p>
          </div>
        </div>

        <button
          onClick={fetchRecentVisits}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Queue
        </button>
      </div>

      {statusMsg && (
        <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs rounded font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Main Grid: Registration Form (Left) | OPD Queue (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
        {/* Registration Form */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
            <User className="w-4 h-4 text-blue-400" /> New OPD Patient Registration
          </div>

          <form onSubmit={handleRegisterPatient} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">UHID (Auto)</label>
                <input
                  type="text"
                  value={uhid}
                  disabled
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-blue-400 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Patient Name *</label>
              <input
                type="text"
                placeholder="Patient Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none focus:border-blue-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Age (Years) *</label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sex</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
                >
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="General Surgery">General Surgery</option>
                  <option value="Emergency / Triage">Emergency / Triage</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Consultant</label>
                <select
                  value={consultantId}
                  onChange={(e) => setConsultantId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
                >
                  <option value="Dr. Inderjit Singh">Dr. Inderjit Singh</option>
                  <option value="Duty Medical Officer">Duty Medical Officer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payer / TPA Category</label>
              <select
                value={selectedPayerId}
                onChange={(e) => setSelectedPayerId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-emerald-300 font-semibold outline-none"
              >
                <option value="">Cash / Self-Pay</option>
                {(payers || []).map(p => (
                  <option key={p.payer_id} value={p.payer_id}>{p.company_name} ({p.tariff_category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Chief Complaints / Reason for Visit</label>
              <textarea
                rows={2}
                placeholder="e.g. Right knee pain since 3 weeks, difficulty in walking..."
                value={chiefComplaints}
                onChange={(e) => setChiefComplaints(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition text-xs uppercase tracking-wider"
            >
              Generate OPD Token & Register
            </button>
          </form>
        </div>

        {/* Right Queue View */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Live OPD Queue ({filteredVisits.length})
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-2 py-1 rounded">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by name or UHID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none w-44"
              />
            </div>
          </div>

          <div className="mt-3 space-y-2 max-h-[70vh] overflow-y-auto">
            {(!filteredVisits || filteredVisits.length === 0) ? (
              <div className="text-center py-12 text-slate-500 text-xs">No registered patients in queue.</div>
            ) : (
              filteredVisits.map(v => (
                <div key={v.visit_id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900">
                        {v.token_display || `#${v.opd_number}`}
                      </span>
                      <span className="font-bold text-white text-sm">{v.patients?.name || 'Walk-in'}</span>
                      <span className="text-slate-400">({v.patients?.age_years}Y / {v.patients?.sex})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex gap-3">
                      <span>UHID: <span className="font-mono text-slate-300">{v.uhid}</span></span>
                      <span>Dept: <span className="text-slate-300 font-semibold">{v.department}</span></span>
                      <span>Ref: <span className="text-slate-300">{v.consultant_id}</span></span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-emerald-300 border border-slate-700">
                      {v.patients?.master_payers?.company_name || 'Self-Pay'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
