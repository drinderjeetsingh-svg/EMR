import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  UserCheck, Printer, AlertCircle, RefreshCw, ShieldCheck, 
  Award, Siren, CheckCircle2
} from 'lucide-react';

export default function OPDRegistration() {
  const [visitType, setVisitType] = useState('OPD'); // 'OPD' or 'EMERGENCY'

  // Demographics
  const [phone, setPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isExistingPatient, setIsExistingPatient] = useState(false);
  const [uhid, setUhid] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('M');
  const [occupation, setOccupation] = useState('');

  // Payer / Company State
  const [payers, setPayers] = useState([]);
  const [selectedPayerId, setSelectedPayerId] = useState('');
  const [selectedPayerObj, setSelectedPayerObj] = useState(null);
  const [cardNumber, setCardNumber] = useState('');
  const [referralLetterNo, setReferralLetterNo] = useState('');
  const [referralValidFrom, setReferralValidFrom] = useState('');
  const [referralValidTo, setReferralValidTo] = useState('');
  const [referralOpdAllowed, setReferralOpdAllowed] = useState(1);
  const [referralOpdUsed, setReferralOpdUsed] = useState(0);
  const [wardEntitlement, setWardEntitlement] = useState('Semi-Private');

  // Consultation Routing
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDoctorObj, setSelectedDoctorObj] = useState(null);
  const [dutyDoctorObj, setDutyDoctorObj] = useState(null);
  const [chiefComplaints, setChiefComplaints] = useState('');

  // 3-Day / 7-Day Validity
  const [recentVisitAlert, setRecentVisitAlert] = useState(null);
  const [isFreeFollowUp, setIsFreeFollowUp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generatedSlip, setGeneratedSlip] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isSeniorEchsWalkin = (selectedPayerObj?.code === 'ECHS' || selectedPayerObj?.code === 'CGHS') && parseInt(age || '0', 10) >= 70;

  useEffect(() => {
    async function initData() {
      // 1. Payers
      const { data: pData } = await supabase.from('master_payers').select('*').eq('is_active', true).order('created_at');
      if (pData && pData.length > 0) {
        setPayers(pData);
        const selfP = pData.find(p => p.code === 'SELF_PAY') || pData[0];
        setSelectedPayerId(selfP.id);
        setSelectedPayerObj(selfP);
      }

      // 2. Departments
      const { data: dData } = await supabase.from('master_departments').select('*').eq('is_active', true).order('name');
      if (dData) setDepartments(dData);

      // 3. Duty Doctor
      const { data: cmoData } = await supabase
        .from('master_doctors')
        .select('*')
        .or('doctor_tier.eq.DUTY_RMO,name.ilike.%Casualty%')
        .limit(1)
        .maybeSingle();
      if (cmoData) setDutyDoctorObj(cmoData);
    }
    initData();
  }, []);

  useEffect(() => {
    async function fetchDoctors() {
      if (!selectedDept || visitType === 'EMERGENCY') {
        setDoctors([]);
        setSelectedDoctorId('');
        setSelectedDoctorObj(null);
        return;
      }
      const { data: docData } = await supabase
        .from('master_doctors')
        .select('*')
        .eq('department_id', selectedDept)
        .eq('is_active', true)
        .order('name');
      if (docData) setDoctors(docData);
    }
    fetchDoctors();
  }, [selectedDept, visitType]);

  const handlePhoneLookup = async (inputPhone) => {
    setPhone(inputPhone);
    setErrorMessage('');
    setRecentVisitAlert(null);
    setIsFreeFollowUp(false);

    if (inputPhone.length === 10) {
      setIsSearching(true);
      const { data: ptData } = await supabase.from('patients').select('*').eq('phone_number', inputPhone).maybeSingle();

      if (ptData) {
        setIsExistingPatient(true);
        setUhid(ptData.uhid);
        setName(ptData.name);
        setAge(ptData.age_years);
        setSex(ptData.sex);
        setOccupation(ptData.occupation || '');
        if (ptData.payer_id) {
          setSelectedPayerId(ptData.payer_id);
          const p = payers.find(item => item.id === ptData.payer_id);
          setSelectedPayerObj(p || null);
        }
        setCardNumber(ptData.card_number || '');
        setReferralLetterNo(ptData.referral_letter_no || '');
        setReferralValidFrom(ptData.referral_valid_from || '');
        setReferralValidTo(ptData.referral_valid_to || '');
        setReferralOpdAllowed(ptData.referral_opd_count_allowed || 1);
        setReferralOpdUsed(ptData.referral_opd_count_used || 0);
        setWardEntitlement(ptData.ward_entitlement || 'Semi-Private');

        // Check recent visits for repeat validity
        const { data: visits } = await supabase
          .from('opd_visits')
          .select('*')
          .eq('uhid', ptData.uhid)
          .order('visit_date', { ascending: false })
          .limit(1);

        if (visits && visits.length > 0) {
          const lastVisit = visits[0];
          const lastDate = new Date(lastVisit.visit_date);
          const today = new Date();
          const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          const allowedDays = (selectedPayerObj?.code === 'ECHS' || selectedPayerObj?.code === 'CGHS') ? 7 : 3;

          if (diffDays <= allowedDays) {
            setRecentVisitAlert(`Patient visited ${diffDays} day(s) ago (${lastVisit.department} - ${lastVisit.consultant_id}). Free repeat follow-up under ${allowedDays}-day validity.`);
            setIsFreeFollowUp(true);
          }
        }
      } else {
        setIsExistingPatient(false);
        setUhid(`GNH-UHID-${Date.now().toString().slice(-6)}`);
        setName('');
        setAge('');
        setSex('M');
      }
      setIsSearching(false);
    }
  };

  const handlePayerSelect = (pId) => {
    setSelectedPayerId(pId);
    const p = payers.find(item => item.id === pId);
    setSelectedPayerObj(p || null);
  };

  const calculateFee = () => {
    if (isFreeFollowUp) return 0.00;
    if (selectedPayerObj?.payer_type === 'GOVERNMENT_CREDIT') return 0.00; // Cashless
    if (visitType === 'EMERGENCY') return 500.00;
    if (selectedDoctorObj?.doctor_tier === 'SUPER_SPECIALIST') return 600.00;
    return 300.00; // Standard MD/MS
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const activeDept = visitType === 'EMERGENCY' 
        ? 'Emergency & Casualty' 
        : (departments.find(d => d.id === selectedDept)?.name || 'General OPD');

      const activeDoctor = visitType === 'EMERGENCY'
        ? (dutyDoctorObj?.name || 'Duty Casualty Medical Officer')
        : (selectedDoctorObj?.name || 'Consultant Doctor');

      // 1. Upsert Patient Record
      const { error: pErr } = await supabase.from('patients').upsert({
        uhid,
        phone_number: phone,
        name,
        age_years: parseInt(age, 10),
        sex,
        occupation,
        payer_id: selectedPayerId,
        card_number: cardNumber,
        referral_letter_no: referralLetterNo || null,
        referral_valid_from: referralValidFrom || null,
        referral_valid_to: referralValidTo || null,
        referral_opd_count_allowed: parseInt(referralOpdAllowed || '1', 10),
        referral_opd_count_used: referralOpdUsed + 1,
        ward_entitlement: wardEntitlement
      });

      if (pErr) throw pErr;

      // 2. Insert OPD Visit Record
      const { data: vData, error: vErr } = await supabase.from('opd_visits').insert({
        uhid,
        visit_type: visitType,
        department: activeDept,
        consultant_id: activeDoctor,
        chief_complaints: chiefComplaints || (visitType === 'EMERGENCY' ? 'Emergency Evaluation' : 'Routine OPD'),
        is_repeat_free_visit: isFreeFollowUp,
        visit_date: new Date().toISOString().split('T')[0]
      }).select().single();

      if (vErr) throw vErr;

      const fee = calculateFee();

      setGeneratedSlip({
        tokenDisplay: vData.token_display || `#${vData.opd_number}`,
        opdNumber: vData.opd_number,
        uhid,
        name,
        age,
        sex,
        phone,
        visitType,
        department: activeDept,
        doctor: activeDoctor,
        feeCharged: fee,
        isFreeFollowUp,
        payerName: selectedPayerObj?.company_name || 'Self-Pay',
        cardNumber: cardNumber || 'N/A',
        opdVisitCount: `${referralOpdUsed + 1} of ${referralOpdAllowed}`,
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      });

    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhone('');
    setUhid('');
    setName('');
    setAge('');
    setSex('M');
    setCardNumber('');
    setReferralLetterNo('');
    setSelectedDept('');
    setSelectedDoctorId('');
    setSelectedDoctorObj(null);
    setChiefComplaints('');
    setRecentVisitAlert(null);
    setIsFreeFollowUp(false);
    setGeneratedSlip(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">OPD & Emergency Intake Desk</h1>
          <p className="text-xs text-slate-500 mt-0.5">Guru Nanak Hospital • Palwal • Direct Patient Registration</p>
        </div>
        {generatedSlip && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Next Patient
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-xs text-red-700 font-medium">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          {errorMessage}
        </div>
      )}

      {!generatedSlip ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* STREAM SELECTOR */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase">Consultation Stream:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisitType('OPD')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition ${
                  visitType === 'OPD' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Regular OPD Consultation
              </button>

              <button
                type="button"
                onClick={() => setVisitType('EMERGENCY')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition ${
                  visitType === 'EMERGENCY' ? 'bg-red-600 text-white shadow-sm animate-pulse' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                }`}
              >
                <Siren className="w-3.5 h-3.5" /> Emergency / Casualty (₹500)
              </button>
            </div>
          </div>

          {recentVisitAlert && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {recentVisitAlert}
            </div>
          )}

          {/* 1. DEMOGRAPHICS */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Patient Identification</span>
              {isExistingPatient && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Existing Patient Found
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone Number (10 Digits) *</label>
                <input
                  type="tel"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(e) => handlePhoneLookup(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full px-2.5 py-1.5 text-sm font-semibold border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">UHID</label>
                <input
                  type="text"
                  readOnly
                  value={uhid}
                  placeholder="Auto-generated"
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-100 border border-slate-200 font-mono text-slate-600 rounded cursor-not-allowed outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Patient Name"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Age (Years) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 72"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Sex *</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded bg-white outline-none"
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Occupation / Category</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="e.g. Ex-Serviceman / Dependent"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. PAYER & OPD PARAMETERS */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" /> Payer & Outpatient Coverage
              </span>
              {isSeniorEchsWalkin && (
                <span className="flex items-center gap-1 bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded text-[11px] font-bold border border-purple-200">
                  <Award className="w-3.5 h-3.5 text-purple-600" /> Senior Citizen (≥70 Yrs) Walk-in (Card ID Only)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Payer Company *</label>
                <select
                  value={selectedPayerId}
                  onChange={(e) => handlePayerSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-600"
                >
                  {payers.map(p => (
                    <option key={p.id} value={p.id}>{p.company_name}</option>
                  ))}
                </select>
              </div>

              {selectedPayerObj?.payer_type !== 'CASH' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Card ID / Service No</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="e.g. ECHS-10928374"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Referral Letter No. (Optional)</label>
                    <input
                      type="text"
                      value={referralLetterNo}
                      onChange={(e) => setReferralLetterNo(e.target.value)}
                      placeholder="e.g. REF-2026-99"
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded outline-none"
                    />
                  </div>

                  {/* Optional Referral Validity & OPD Counter */}
                  <div className="md:col-span-3 p-3 bg-slate-50 border border-slate-200 rounded grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Referral Valid From</label>
                      <input
                        type="date"
                        value={referralValidFrom}
                        onChange={(e) => setReferralValidFrom(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Referral Valid To</label>
                      <input
                        type="date"
                        value={referralValidTo}
                        onChange={(e) => setReferralValidTo(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">OPDs Permitted on Letter</label>
                      <input
                        type="number"
                        min="1"
                        value={referralOpdAllowed}
                        onChange={(e) => setReferralOpdAllowed(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded font-bold outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3. CONSULTATION ROUTING */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              {visitType === 'EMERGENCY' ? 'Emergency Casualty Assignment' : 'OPD Department & Doctor Selection'}
            </div>

            {visitType === 'EMERGENCY' ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-red-900">Assigned Consultant: {dutyDoctorObj?.name || 'Duty Casualty Medical Officer'}</div>
                  <div className="text-[11px] text-red-700 mt-0.5">Direct triage queue • Immediate priority token</div>
                </div>
                <div className="text-sm font-black font-mono text-red-800">
                  {selectedPayerObj?.payer_type === 'GOVERNMENT_CREDIT' ? 'Cashless (ECHS)' : 'Fee: ₹500.00'}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Department *</label>
                  <select
                    required
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value);
                      setSelectedDoctorId('');
                      setSelectedDoctorObj(null);
                    }}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded bg-white outline-none"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Consultant Doctor *</label>
                  <select
                    required
                    disabled={!selectedDept}
                    value={selectedDoctorId}
                    onChange={(e) => {
                      setSelectedDoctorId(e.target.value);
                      const doc = doctors.find(d => d.id === e.target.value);
                      setSelectedDoctorObj(doc || null);
                    }}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded bg-white outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Select Doctor --</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.doctor_tier === 'SUPER_SPECIALIST' ? 'DM/M.Ch (₹600)' : 'MD/MS (₹300)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="mt-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Presenting Complaints</label>
              <input
                type="text"
                value={chiefComplaints}
                onChange={(e) => setChiefComplaints(e.target.value)}
                placeholder="e.g. Left Knee pain from 5 months, fever, road accident trauma..."
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded outline-none"
              />
            </div>
          </div>

          {/* TOTAL & ACTION */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-bold text-slate-700">
              Total Payable at Counter: <span className="text-sm font-black text-blue-700 font-mono">₹{calculateFee().toFixed(2)}</span>
              {isFreeFollowUp && <span className="ml-2 text-emerald-700 font-semibold">(Free Repeat Visit)</span>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition ${
                visitType === 'EMERGENCY' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Generating Slip...' : `Generate ${visitType === 'EMERGENCY' ? 'Emergency' : 'OPD'} Token Slip`}
            </button>
          </div>
        </form>
      ) : (
        /* PRINTABLE THERMAL SLIP */
        <div className="bg-white border border-slate-300 p-6 rounded-lg shadow max-w-sm mx-auto print:max-w-full print:border-none print:shadow-none font-sans">
          <div className="text-center pb-3 border-b-2 border-dashed border-slate-400">
            <h2 className="text-base font-black text-slate-900 uppercase">GURU NANAK HOSPITAL</h2>
            <p className="text-[10px] text-slate-600">Delhi Mathura Road, Palwal • Tel: 01275-256660</p>
            <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-black rounded uppercase ${
              generatedSlip.visitType === 'EMERGENCY' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'
            }`}>
              {generatedSlip.visitType === 'EMERGENCY' ? 'Emergency Casualty Slip' : 'OPD Consultation Slip'}
            </span>
          </div>

          <div className={`my-3 p-3 rounded text-center border ${
            generatedSlip.visitType === 'EMERGENCY' ? 'bg-red-50 border-red-300 text-red-900' : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <p className="text-[10px] uppercase font-bold tracking-wider">Queue Token</p>
            <p className="text-3xl font-black font-mono mt-0.5">{generatedSlip.tokenDisplay}</p>
            <p className="text-xs font-bold mt-0.5">{generatedSlip.department}</p>
          </div>

          <div className="text-xs space-y-1.5 text-slate-800 border-b-2 border-dashed border-slate-400 pb-3">
            <div className="flex justify-between">
              <span className="text-slate-500">UHID:</span>
              <span className="font-mono font-bold">{generatedSlip.uhid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Patient:</span>
              <span className="font-bold text-sm">{generatedSlip.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Age / Sex:</span>
              <span>{generatedSlip.age} Y / {generatedSlip.sex}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Consultant:</span>
              <span className="font-bold">{generatedSlip.doctor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Billing Category:</span>
              <span className="font-bold text-blue-900">{generatedSlip.payerName}</span>
            </div>
            {generatedSlip.cardNumber !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-500">Card ID:</span>
                <span className="font-mono font-bold">{generatedSlip.cardNumber}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-700">Fee Charged:</span>
              <span className="font-black font-mono text-sm">
                {generatedSlip.feeCharged === 0 ? 'FREE / CASHLESS' : `₹${generatedSlip.feeCharged.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Date & Time:</span>
              <span>{generatedSlip.date} • {generatedSlip.time}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded shadow"
            >
              <Printer className="w-3.5 h-3.5" /> Print Token Slip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
