import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  UserPlus, Users, Search, RefreshCw, CheckCircle2, 
  CreditCard, Building2, Phone, User, ShieldCheck, AlertCircle, Printer
} from 'lucide-react';

export default function IntakeDashboard() {
  const [patients, setPatients] = useState([]);
  const [payers, setPayers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Form State
  const [uhid, setUhid] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('M');
  const [occupation, setOccupation] = useState('');
  const [allergies, setAllergies] = useState('No Known Drug Allergies (NKDA)');
  const [selectedPayerId, setSelectedPayerId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [referralLetterNo, setReferralLetterNo] = useState('');
  
  // Visit Details
  const [visitType, setVisitType] = useState('OPD');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [chiefComplaints, setChiefComplaints] = useState('');
  
  // Calculated Tariff State
  const [calculatedFee, setCalculatedFee] = useState(300);
  const [isRepeatFree, setIsRepeatFree] = useState(false);
  const [isSeniorExempt, setIsSeniorExempt] = useState(false);

  useEffect(() => {
    generateNewUhid();
    fetchInitialData();
  }, []);

  const generateNewUhid = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    setUhid(`GNH-UHID-${randomNum}`);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [payerRes, docRes, deptRes, visitRes] = await Promise.all([
        supabase.from('master_payers').select('*').order('company_name'),
        supabase.from('master_doctors').select('*').eq('is_active', true),
        supabase.from('master_departments').select('*').eq('is_active', true),
        supabase.from('opd_visits').select('*, patients(*, master_payers(*))').order('created_at', { ascending: false }).limit(25)
      ]);

      if (payerRes.data) {
        setPayers(payerRes.data);
        if (payerRes.data.length > 0) setSelectedPayerId(payerRes.data[0].id);
      }
      if (docRes.data) {
        setDoctors(docRes.data);
        if (docRes.data.length > 0) setSelectedDoctorId(docRes.data[0].id);
      }
      if (deptRes.data) {
        setDepartments(deptRes.data);
        if (deptRes.data.length > 0) setSelectedDeptId(deptRes.data[0].name);
      }
      if (visitRes.data) {
        setPatients(visitRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Check 3-day / 7-day validity and Senior Citizen Exemption
  useEffect(() => {
    const currentAge = parseInt(age, 10) || 0;
    const currentPayer = payers.find(p => p.id === selectedPayerId);
    
    // Senior citizen >= 70 years on Govt Credit (ECHS/CGHS)
    if (currentAge >= 70 && currentPayer && currentPayer.payer_type === 'GOVERNMENT_CREDIT') {
      setIsSeniorExempt(true);
    } else {
      setIsSeniorExempt(false);
    }

    // Determine Consultation Fee based on Tier and Stream
    const currentDoc = doctors.find(d => d.id === selectedDoctorId);
    if (visitType === 'EMERGENCY') {
      setCalculatedFee(currentDoc?.emergency_fee || 500.00);
    } else {
      if (currentDoc?.doctor_tier === 'SUPER_SPECIALIST') {
        setCalculatedFee(600.00);
      } else {
        setCalculatedFee(currentDoc?.opd_consultation_fee || 300.00);
      }
    }
  }, [age, selectedPayerId, selectedDoctorId, visitType, payers, doctors]);

  const handlePhoneLookup = async (lookupPhone) => {
    if (lookupPhone.length < 10) return;
    try {
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('*, master_payers(*)')
        .eq('phone_number', lookupPhone)
        .maybeSingle();

      if (existingPatient) {
        setUhid(existingPatient.uhid);
        setName(existingPatient.name);
        setAge(existingPatient.age_years.toString());
        setSex(existingPatient.sex);
        setOccupation(existingPatient.occupation || '');
        setAllergies(existingPatient.allergies || 'NKDA');
        if (existingPatient.payer_id) setSelectedPayerId(existingPatient.payer_id);
        setCardNumber(existingPatient.card_number || '');
        setReferralLetterNo(existingPatient.referral_letter_no || '');

        // Check if last visit is within validity window
        const { data: lastVisit } = await supabase
          .from('opd_visits')
          .select('created_at, department')
          .eq('uhid', existingPatient.uhid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastVisit) {
          const daysDiff = (new Date() - new Date(lastVisit.created_at)) / (1000 * 60 * 60 * 24);
          const validityDays = existingPatient.master_payers?.opd_validity_days || 3;
          if (daysDiff <= validityDays) {
            setIsRepeatFree(true);
            setCalculatedFee(0.00);
            setStatusMsg(`Re-visit within ${validityDays}-day window. Consultation is FREE.`);
          }
        }
      }
    } catch (e) {
      console.error("Patient lookup failed:", e);
    }
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !age) {
      alert('Please fill in patient name, 10-digit phone, and age.');
      return;
    }

    try {
      // 1. Upsert Patient
      const { error: patientErr } = await supabase.from('patients').upsert({
        uhid: uhid,
        name: name.trim(),
        phone_number: phone.trim(),
        age_years: parseInt(age, 10),
        sex: sex,
        occupation: occupation,
        allergies: allergies,
        payer_id: selectedPayerId || null,
        card_number: cardNumber,
        referral_letter_no: referralLetterNo
      });

      if (patientErr) throw patientErr;

      // 2. Insert OPD Visit (Token trigger handles opd_number & token_display)
      const selectedDoc = doctors.find(d => d.id === selectedDoctorId);
      const { data: newVisit, error: visitErr } = await supabase.from('opd_visits').insert({
        uhid: uhid,
        visit_type: visitType,
        department: selectedDeptId || 'Orthopaedics',
        consultant_id: selectedDoc?.name || 'Dr. Inderjit Singh',
        chief_complaints: chiefComplaints || 'Routine Consultation',
        consult_stage: 'WAITING',
        is_repeat_free_visit: isRepeatFree
      }).select().single();

      if (visitErr) throw visitErr;

      setStatusMsg(`✓ Patient ${name} registered. Token: ${newVisit.token_display || 'Assigned'}`);
      
      // Reset
      setName('');
      setPhone('');
      setAge('');
      setChiefComplaints('');
      setIsRepeatFree(false);
      generateNewUhid();
      fetchInitialData();
    } catch (err) {
      alert('Registration Error: ' + err.message);
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
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide text-white">Front Desk & Intake Registration</h1>
            <p className="text-[11px] text-slate-400">Stream A (OPD) & Stream B (Emergency) • 3/7-Day Validity Engine • Senior Citizen Rules</p>
          </div>
        </div>

        <button
          onClick={fetchInitialData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {statusMsg && (
        <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs rounded font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Main Grid: Registration (Left) | Queue (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" /> Patient Registration
            </span>
            <div className="flex gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setVisitType('OPD')}
                className={`px-2 py-0.5 rounded font-bold ${visitType === 'OPD' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                Stream A: OPD
              </button>
              <button
                type="button"
                onClick={() => setVisitType('EMERGENCY')}
                className={`px-2 py-0.5 rounded font-bold ${visitType === 'EMERGENCY' ? 'bg-red-600 text-white' : 'text-slate-400'}`}
              >
                Stream B: EMG
              </button>
            </div>
          </div>

          <form onSubmit={handleRegisterPatient} className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (e.target.value.length === 10) handlePhoneLookup(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Permanent UHID</label>
                <input
                  type="text"
                  value={uhid}
                  disabled
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-blue-400 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Patient Full Name *</label>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none font-bold"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Age (Y) *</label>
                <input
                  type="number"
                  placeholder="Age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Sex</label>
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
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Occupation</label>
                <input
                  type="text"
                  placeholder="e.g. Ex-Serviceman"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
                />
              </div>
            </div>

            {/* Payer & TPA Details */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Billing Payer / Company</span>
                {isSeniorExempt && (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Senior Citizen Exemption (≥70Y)
                  </span>
                )}
              </div>
              <select
                value={selectedPayerId}
                onChange={(e) => setSelectedPayerId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-emerald-300 font-semibold outline-none"
              >
                {payers.map(p => (
                  <option key={p.id} value={p.id}>{p.company_name} ({p.payer_type})</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Card / Policy No"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 outline-none text-[11px]"
                />
                <input
                  type="text"
                  placeholder={isSeniorExempt ? "Exempt from Referral" : "Referral Letter No"}
                  value={referralLetterNo}
                  disabled={isSeniorExempt}
                  onChange={(e) => setReferralLetterNo(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 outline-none text-[11px] disabled:opacity-40"
                />
              </div>
            </div>

            {/* Doctor & Department */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Department</label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Consultant</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.doctor_tier})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Known Allergies</label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-amber-300 outline-none text-[11px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Chief Complaints</label>
              <textarea
                rows={2}
                placeholder="Presenting symptoms..."
                value={chiefComplaints}
                onChange={(e) => setChiefComplaints(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-100 outline-none"
              />
            </div>

            {/* Fee summary & Submission */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Consultation Fee:</span>
                <span className={`text-base font-mono font-black ${isRepeatFree ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isRepeatFree ? '₹0.00 (FREE REPEAT)' : `₹${calculatedFee.toFixed(2)}`}
                </span>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow text-xs uppercase tracking-wider"
              >
                Register & Issue Token
              </button>
            </div>
          </form>
        </div>

        {/* Live Queue Right */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Live OPD Queue ({filteredVisits.length})
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-2 py-1 rounded">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, UHID, token..."
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
                      <span className={`font-mono font-black px-2 py-0.5 rounded border text-xs ${
                        v.visit_type === 'EMERGENCY' ? 'bg-red-950 text-red-300 border-red-800' : 'bg-blue-950/60 text-blue-400 border-blue-900'
                      }`}>
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
