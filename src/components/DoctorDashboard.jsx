import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Stethoscope, Search, Trash2, Printer, Film, TestTube, 
  ArrowRight, CheckCircle2, Bed, ShieldCheck, Plus, X, Tag
} from 'lucide-react';

export default function DoctorDashboard() {
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDoctorObj, setSelectedDoctorObj] = useState(null);
  
  // Queue State
  const [queue, setQueue] = useState([]);
  const [queueScope, setQueueScope] = useState('TODAY'); // 'TODAY' or 'ALL_HISTORY'
  const [queueTab, setQueueTab] = useState('ALL');
  const [selectedVisit, setSelectedVisit] = useState(null);

  // Permanent Patient State
  const [allergies, setAllergies] = useState('No Known Drug Allergies (NKDA)');
  const [pastMedicalHistory, setPastMedicalHistory] = useState('');
  const [pastSurgicalHistory, setPastSurgicalHistory] = useState('');

  // Vitals
  const [pulse, setPulse] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [rr, setRr] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [rbs, setRbs] = useState('');
  const [vasScale, setVasScale] = useState(0);

  // Clinical Evaluation
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [examination, setExamination] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');

  // Master Catalogs
  const [allRadiologyServices, setAllRadiologyServices] = useState([]);
  const [allLabServices, setAllLabServices] = useState([]);

  // 1. SEARCHABLE RADIOLOGY STATE
  const [radioSearchInput, setRadioSearchInput] = useState('');
  const [radioDropdownOpen, setRadioDropdownOpen] = useState(false);
  const [orderedRadiology, setOrderedRadiology] = useState([]);
  const [customViewModalIdx, setCustomViewModalIdx] = useState(null);
  const [customViewText, setCustomViewText] = useState('');

  // 2. SEARCHABLE LABORATORY STATE
  const [labSearchInput, setLabSearchInput] = useState('');
  const [labDropdownOpen, setLabDropdownOpen] = useState(false);
  const [orderedLabs, setOrderedLabs] = useState([]);

  // Custom Unlisted Investigation Modal State
  const [showCustomTestModal, setShowCustomTestModal] = useState(false);
  const [customTestName, setCustomTestName] = useState('');
  const [customTestCategory, setCustomTestCategory] = useState('Radiology');
  const [customTestViews, setCustomTestViews] = useState('AP, Lateral');

  // Findings & Advice
  const [investigationFindings, setInvestigationFindings] = useState('');
  const [generalAdvice, setGeneralAdvice] = useState('');
  const [followUpDays, setFollowUpDays] = useState(5);

  // Prescriptions Table
  const [medications, setMedications] = useState([]);
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [medSearchResults, setMedSearchResults] = useState([]);
  const [disposition, setDisposition] = useState('HOME');

  // Print Mode
  const [printMode, setPrintMode] = useState('preprinted');
  const [printDocType, setPrintDocType] = useState('PRESCRIPTION');
  const [statusMsg, setStatusMsg] = useState('');

  // Quick 1-Click Common Lab Panels
  const QUICK_LAB_PANELS = [
    { code: 'LB012', name: 'Complete Haemogram (CBC)' },
    { code: 'LB123', name: 'Kidney Function Test (KFT)' },
    { code: 'LB124', name: 'Liver Function Test (LFT)' },
    { code: 'LB125', name: 'Lipid Profile' },
    { code: 'LB122', name: 'HbA1c' },
    { code: 'LB066', name: 'Serum Uric Acid' },
    { code: 'LB069', name: 'CRP Quantitative' },
    { code: 'LB064', name: 'RA Factor' },
    { code: 'LB001', name: 'Urine Routine & Micro' },
    { code: 'LB154', name: 'Vitamin D3' }
  ];

  // 1. Fetch Doctors & Universal Master Catalogs
  useEffect(() => {
    async function init() {
      const { data: dData } = await supabase
        .from('master_doctors')
        .select('*, master_departments(name)')
        .eq('is_active', true)
        .order('name');
      if (dData && dData.length > 0) {
        setDoctorsList(dData);
        setSelectedDoctorId(dData[0].id);
        setSelectedDoctorObj(dData[0]);
      }

      const { data: radData } = await supabase
        .from('master_services')
        .select('*')
        .eq('category', 'Radiology')
        .order('service_name');
      if (radData) setAllRadiologyServices(radData);

      const { data: lData } = await supabase
        .from('master_services')
        .select('*')
        .eq('category', 'Laboratory')
        .order('service_name');
      if (lData) setAllLabServices(lData);
    }
    init();
  }, []);

  // 2. Queue Subscription
  useEffect(() => {
    if (!selectedDoctorObj) return;
    fetchQueue();

    const channel = supabase
      .channel('doctor_desk_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opd_visits' }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDoctorObj, queueScope]);

  const fetchQueue = async () => {
    if (!selectedDoctorObj) return;
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('opd_visits')
      .select('*, patients(*, master_payers(company_name, code))')
      .order('created_at', { ascending: false });

    if (queueScope === 'TODAY') {
      query = query.eq('visit_date', today);
    }

    if (selectedDoctorObj.name) {
      query = query.or(`consultant_id.ilike.%${selectedDoctorObj.name}%,department.ilike.%${selectedDoctorObj.master_departments?.name || ''}%`);
    }

    const { data } = await query;
    if (data) {
      setQueue(data);
      if (data.length > 0 && !selectedVisit) {
        loadVisitData(data[0]);
      }
    }
  };

  const handleDoctorSwitch = (docId) => {
    setSelectedDoctorId(docId);
    const doc = doctorsList.find((d) => d.id === docId);
    setSelectedDoctorObj(doc || null);
    setSelectedVisit(null);
  };

  const loadVisitData = async (visit) => {
    setSelectedVisit(visit);
    setStatusMsg('');

    const { data: ptData } = await supabase
      .from('patients')
      .select('*, master_payers(company_name, code)')
      .eq('uhid', visit.uhid)
      .maybeSingle();

    const activePt = ptData || visit.patients || {};

    setAllergies(activePt.allergies || visit.allergies || 'No Known Drug Allergies (NKDA)');
    setPastMedicalHistory(activePt.past_medical_history || '');
    setPastSurgicalHistory(activePt.past_surgical_history || '');

    setChiefComplaints(visit.chief_complaints || '');
    const v = visit.vitals || {};
    setPulse(v.pulse || '');
    setBpSys(v.bp_sys || '');
    setBpDia(v.bp_dia || '');
    setRr(v.rr || '');
    setSpo2(v.spo2 || '');
    setTemp(v.temp || '');
    setRbs(v.rbs || '');
    setVasScale(v.vas || 0);

    setExamination(visit.clinical_examination || '');
    setProvisionalDiagnosis(visit.diagnosis || '');

    try {
      const invParsed = JSON.parse(visit.investigations_advised || '{}');
      setOrderedRadiology(invParsed.radiology || []);
      setOrderedLabs(invParsed.labs || []);
    } catch (e) {
      setOrderedRadiology([]);
      setOrderedLabs([]);
    }

    setInvestigationFindings(visit.investigation_findings || '');
    setGeneralAdvice(visit.general_advice || '');
    setMedications(visit.prescriptions || []);
    setDisposition(visit.disposition || 'HOME');
  };

  // --- 1. SEARCHABLE RADIOLOGY AUTOCOMPLETE ---
  const filteredRadiologyList = allRadiologyServices.filter(item => {
    if (!radioSearchInput.trim()) return true;
    const tokens = radioSearchInput.toLowerCase().split(' ').filter(Boolean);
    const target = (item.service_name + ' ' + (item.sub_category || '')).toLowerCase();
    return tokens.every(token => target.includes(token));
  });

  const addRadiologyFromSearch = (service) => {
    if (orderedRadiology.some(r => r.service_code === service.service_code)) {
      setRadioSearchInput('');
      setRadioDropdownOpen(false);
      return;
    }

    const views = service.supported_views || ["AP", "Lateral"];
    setOrderedRadiology([...orderedRadiology, {
      service_code: service.service_code,
      service_name: service.service_name,
      modality: service.sub_category || 'X-Ray',
      available_views: [...views],
      selected_views: views.slice(0, 2) // Default AP + Lateral
    }]);

    setRadioSearchInput('');
    setRadioDropdownOpen(false);
  };

  const toggleRadioView = (itemIdx, view) => {
    const updated = [...orderedRadiology];
    const curViews = updated[itemIdx].selected_views;
    if (curViews.includes(view)) {
      if (curViews.length > 1) {
        updated[itemIdx].selected_views = curViews.filter(v => v !== view);
      }
    } else {
      updated[itemIdx].selected_views = [...curViews, view];
    }
    setOrderedRadiology(updated);
  };

  const handleAddCustomViewToItem = (itemIdx) => {
    if (!customViewText.trim()) return;
    const updated = [...orderedRadiology];
    const v = customViewText.trim();
    if (!updated[itemIdx].available_views.includes(v)) {
      updated[itemIdx].available_views.push(v);
    }
    if (!updated[itemIdx].selected_views.includes(v)) {
      updated[itemIdx].selected_views.push(v);
    }
    setOrderedRadiology(updated);
    setCustomViewText('');
    setCustomViewModalIdx(null);
  };

  const removeRadioItem = (idx) => {
    setOrderedRadiology(orderedRadiology.filter((_, i) => i !== idx));
  };

  // --- 2. SEARCHABLE LABORATORY AUTOCOMPLETE ---
  const filteredLabList = allLabServices.filter(item => {
    if (!labSearchInput.trim()) return true;
    const tokens = labSearchInput.toLowerCase().split(' ').filter(Boolean);
    const target = (item.service_name + ' ' + item.service_code + ' ' + (item.sub_category || '')).toLowerCase();
    return tokens.every(token => target.includes(token));
  });

  const addLabFromSearch = (service) => {
    if (orderedLabs.some(l => l.service_code === service.service_code)) {
      setLabSearchInput('');
      setLabDropdownOpen(false);
      return;
    }
    setOrderedLabs([...orderedLabs, { service_code: service.service_code, service_name: service.service_name }]);
    setLabSearchInput('');
    setLabDropdownOpen(false);
  };

  const removeLabItem = (idx) => {
    setOrderedLabs(orderedLabs.filter((_, i) => i !== idx));
  };

  // --- 3. CUSTOM UNLISTED INVESTIGATION HANDLER ---
  const handleSaveCustomInvestigation = async () => {
    if (!customTestName.trim()) return;
    const code = `CUSTOM_${Date.now().toString().slice(-6)}`;
    const viewsArr = customTestCategory === 'Radiology' 
      ? customTestViews.split(',').map(v => v.trim()).filter(Boolean)
      : ['Standard Protocol'];

    const newObj = {
      service_code: code,
      service_name: customTestName.trim(),
      category: customTestCategory,
      sub_category: customTestCategory === 'Radiology' ? 'Special Imaging' : 'Special Lab',
      supported_views: viewsArr
    };

    if (customTestCategory === 'Radiology') {
      setAllRadiologyServices([newObj, ...allRadiologyServices]);
      addRadiologyFromSearch(newObj);
    } else {
      setAllLabServices([newObj, ...allLabServices]);
      addLabFromSearch(newObj);
    }

    // Persist to Supabase master_services in background
    supabase.from('master_services').insert(newObj);

    setShowCustomTestModal(false);
    setCustomTestName('');
  };

  // --- 4. MEDICATIONS ---
  const handleMedSearch = async (term) => {
    setMedSearchQuery(term);
    if (term.trim().length < 2) {
      setMedSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('master_medicines')
      .select('id, brand_name, generic_composition, dosage_form')
      .ilike('brand_name', `%${term.trim()}%`)
      .limit(8);
    setMedSearchResults(data || []);
  };

  const addMedicineToRx = (med) => {
    setMedications([...medications, {
      medicine_id: med.id,
      brand_name: med.brand_name,
      generic_composition: med.generic_composition,
      dosage_form: med.dosage_form || 'Tablet',
      frequency: '1-0-1',
      food_timing: 'After Food (PC)',
      duration: '5 Days',
      instructions: 'Take with warm water'
    }]);
    setMedSearchQuery('');
    setMedSearchResults([]);
  };

  const updateMedRow = (idx, field, val) => {
    const updated = [...medications];
    updated[idx][field] = val;
    setMedications(updated);
  };

  const removeMedRow = (idx) => {
    setMedications(medications.filter((_, i) => i !== idx));
  };

  // --- 5. SAVE & TRANSITION ---
  const saveClinicalState = async (stage, explicitDisposition = disposition) => {
    const followUpDateObj = new Date();
    followUpDateObj.setDate(followUpDateObj.getDate() + parseInt(followUpDays, 10));

    const vitalsPayload = { pulse, bp_sys: bpSys, bp_dia: bpDia, rr, spo2, temp, rbs, vas: vasScale };
    const investigationsPayload = JSON.stringify({ radiology: orderedRadiology, labs: orderedLabs });

    await supabase.from('patients').update({
      allergies,
      past_medical_history: pastMedicalHistory,
      past_surgical_history: pastSurgicalHistory
    }).eq('uhid', selectedVisit.uhid);

    const { error } = await supabase.from('opd_visits').update({
      allergies,
      vitals: vitalsPayload,
      chief_complaints: chiefComplaints,
      clinical_examination: examination,
      diagnosis: provisionalDiagnosis,
      investigations_advised: investigationsPayload,
      investigation_findings: investigationFindings,
      general_advice: generalAdvice,
      prescriptions: medications,
      follow_up_date: followUpDateObj.toISOString().split('T')[0],
      disposition: explicitDisposition,
      consult_stage: stage,
      is_admitted_to_ipd: explicitDisposition === 'ADMISSION_ADVISED'
    }).eq('visit_id', selectedVisit.visit_id);

    if (!error) {
      fetchQueue();
    }
  };

  const handleSendForTests = async () => {
    if (!selectedVisit) return;
    if (orderedRadiology.length === 0 && orderedLabs.length === 0) {
      alert('Please select at least one Radiology scan or Lab test.');
      return;
    }
    await saveClinicalState('INVESTIGATION_PENDING');
    setPrintDocType('RADIO_REQUISITION');
    setTimeout(() => window.print(), 200);
  };

  const handleFinalize = async (targetDisp = 'HOME') => {
    if (!selectedVisit) return;
    const finalStage = targetDisp === 'ADMISSION_ADVISED' ? 'ADMITTED' : 'COMPLETED';
    await saveClinicalState(finalStage, targetDisp);
    setPrintDocType('PRESCRIPTION');
    setStatusMsg(`Consultation saved successfully.`);
  };

  const filteredQueue = queue.filter(v => {
    if (queueTab === 'ALL') return true;
    if (queueTab === 'WAITING') return !v.consult_stage || v.consult_stage === 'WAITING' || v.consult_stage === 'IN_CONSULT';
    if (queueTab === 'INVESTIGATION_PENDING') return v.consult_stage === 'INVESTIGATION_PENDING';
    if (queueTab === 'COMPLETED') return v.consult_stage === 'COMPLETED' || v.consult_stage === 'ADMITTED';
    return true;
  });

  return (
    <>
      {/* SCREEN INTERFACE */}
      <div className="print:hidden max-w-7xl mx-auto p-3 md:p-5 bg-slate-50 min-h-screen">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-3 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <select
                value={selectedDoctorId}
                onChange={(e) => handleDoctorSwitch(e.target.value)}
                className="text-sm font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 outline-none"
              >
                {doctorsList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} — {doc.master_departments?.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">Live Consultation Desk • Exhaustive ECHS & GNH Directory</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCustomTestModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-bold transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Custom / Unlisted Test
            </button>

            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-md text-[11px] font-semibold">
              <button
                onClick={() => setPrintMode('preprinted')}
                className={`px-2 py-1 rounded ${printMode === 'preprinted' ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'}`}
              >
                Letterhead Pad
              </button>
              <button
                onClick={() => setPrintMode('blank_a4')}
                className={`px-2 py-1 rounded ${printMode === 'blank_a4' ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'}`}
              >
                Plain A4
              </button>
            </div>
          </div>
        </div>

        {statusMsg && (
          <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded font-medium">
            ✓ {statusMsg}
          </div>
        )}

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* QUEUE SIDEBAR */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-3 shadow-sm h-fit">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Patient Queue</span>
              <div className="flex bg-slate-100 p-0.5 rounded text-[10px] font-bold">
                <button
                  onClick={() => setQueueScope('TODAY')}
                  className={`px-2 py-0.5 rounded ${queueScope === 'TODAY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'}`}
                >
                  Today
                </button>
                <button
                  onClick={() => setQueueScope('ALL_HISTORY')}
                  className={`px-2 py-0.5 rounded ${queueScope === 'ALL_HISTORY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'}`}
                >
                  All History
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 mb-3 text-[10px] font-bold">
              <button onClick={() => setQueueTab('ALL')} className={`py-1 rounded ${queueTab === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button>
              <button onClick={() => setQueueTab('WAITING')} className={`py-1 rounded ${queueTab === 'WAITING' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Wait</button>
              <button onClick={() => setQueueTab('INVESTIGATION_PENDING')} className={`py-1 rounded ${queueTab === 'INVESTIGATION_PENDING' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800'}`}>Lab/XR</button>
              <button onClick={() => setQueueTab('COMPLETED')} className={`py-1 rounded ${queueTab === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Done</button>
            </div>

            <div className="space-y-1.5 max-h-[75vh] overflow-y-auto">
              {filteredQueue.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No patients found.</div>
              ) : (
                filteredQueue.map((v) => (
                  <div
                    key={v.visit_id}
                    onClick={() => loadVisitData(v)}
                    className={`p-2.5 rounded border text-xs cursor-pointer transition ${
                      selectedVisit?.visit_id === v.visit_id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-blue-900">{v.token_display || `#${v.opd_number}`}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        v.consult_stage === 'INVESTIGATION_PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {v.consult_stage === 'INVESTIGATION_PENDING' ? 'At Lab/X-Ray' : v.consult_stage || 'Waiting'}
                      </span>
                    </div>
                    <div className="font-bold text-slate-800 mt-1">{v.patients?.name}</div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>{v.patients?.age_years}Y / {v.patients?.sex}</span>
                      <span className="font-mono text-[10px] text-slate-400">{v.visit_date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MAIN CLINICAL WORKSPACE */}
          {selectedVisit ? (
            <div className="lg:col-span-9 space-y-3.5">
              {/* Patient Header */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm font-mono text-blue-700">{selectedVisit.token_display || `#${selectedVisit.opd_number}`}</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedVisit.patients?.name}</span>
                    <span className="text-xs text-slate-500">({selectedVisit.patients?.age_years} Y / {selectedVisit.patients?.sex})</span>
                    <span className="text-xs font-mono text-slate-400">UHID: {selectedVisit.uhid}</span>
                  </div>
                  <div className="text-[11px] text-blue-700 font-semibold mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> {selectedVisit.patients?.master_payers?.company_name || 'Self-Pay (Cash)'}
                    {selectedVisit.patients?.card_number && <span className="font-mono text-slate-500 ml-1">Card: {selectedVisit.patients?.card_number}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-red-600 uppercase">Allergies:</span>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    className="px-2 py-1 text-xs border border-red-200 bg-red-50 text-red-800 rounded font-semibold outline-none w-56"
                  />
                </div>
              </div>

              {/* Vitals */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <div className="text-[11px] font-bold text-slate-600 uppercase mb-2">Vitals & Pain Score</div>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Pulse</label>
                    <input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="72" className="w-full px-2 py-1 border rounded font-mono font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">BP</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={bpSys} onChange={(e) => setBpSys(e.target.value)} placeholder="120" className="w-full px-1 py-1 border rounded font-mono font-bold text-center outline-none" />
                      <span>/</span>
                      <input type="number" value={bpDia} onChange={(e) => setBpDia(e.target.value)} placeholder="80" className="w-full px-1 py-1 border rounded font-mono font-bold text-center outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">RR (/min)</label>
                    <input type="number" value={rr} onChange={(e) => setRr(e.target.value)} placeholder="18" className="w-full px-2 py-1 border rounded font-mono font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">SpO2 (%)</label>
                    <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="99" className="w-full px-2 py-1 border rounded font-mono font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Temp (°F)</label>
                    <input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="98.4" className="w-full px-2 py-1 border rounded font-mono font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">RBS (mg/dL)</label>
                    <input type="number" value={rbs} onChange={(e) => setRbs(e.target.value)} placeholder="110" className="w-full px-2 py-1 border rounded font-mono font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">VAS Pain</label>
                    <select value={vasScale} onChange={(e) => setVasScale(parseInt(e.target.value, 10))} className="w-full px-2 py-1 border rounded font-bold bg-white outline-none">
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Complaints & Diagnosis */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Chief Complaints & Duration</label>
                    <textarea rows={2} value={chiefComplaints} onChange={(e) => setChiefComplaints(e.target.value)} placeholder="Presenting complaints..." className="w-full p-2 text-xs border rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Clinical / Physical Examination</label>
                    <textarea rows={2} value={examination} onChange={(e) => setExamination(e.target.value)} placeholder="Tenderness, ROM, swelling, tests..." className="w-full p-2 text-xs border rounded outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-800 uppercase mb-1">Provisional / Final Diagnosis *</label>
                    <input type="text" value={provisionalDiagnosis} onChange={(e) => setProvisionalDiagnosis(e.target.value)} placeholder="e.g. Left Knee Osteoarthritis Grade IV" className="w-full p-2 text-xs font-bold text-blue-950 border border-blue-200 bg-blue-50/30 rounded outline-none" />
                  </div>
                </div>
              </div>

              {/* 1. PROGRESSIVE SEARCHABLE RADIOLOGY (X-RAY / CT / MRI / USG) */}
              <div className="bg-white border border-blue-200 rounded-lg p-3.5 shadow-sm space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-blue-600" /> Radiology & Imaging Directory ({allRadiologyServices.length}+ Tests)
                  </span>
                  <span className="text-[10px] text-slate-500">Search: e.g. "xray left knee", "ct brain", "mri ls spine"</span>
                </div>

                {/* Progressive Search Bar with Dropdown Container */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={radioSearchInput}
                    onFocus={() => setRadioDropdownOpen(true)}
                    onChange={(e) => {
                      setRadioSearchInput(e.target.value);
                      setRadioDropdownOpen(true);
                    }}
                    placeholder="Type to search (e.g. xray left, ct face, mri shoulder, usg abdomen)..."
                    className="w-full pl-8 pr-8 py-2 text-xs font-bold text-slate-800 bg-blue-50/30 border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  {radioSearchInput && (
                    <button
                      onClick={() => setRadioSearchInput('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}

                  {/* Progressive Matching Dropdown */}
                  {radioDropdownOpen && (
                    <div className="absolute z-30 w-full bg-white border border-slate-300 rounded-b shadow-xl max-h-60 overflow-y-auto mt-1 divide-y divide-slate-100">
                      {filteredRadiologyList.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          No matching imaging test found.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setCustomTestName(radioSearchInput);
                              setCustomTestCategory('Radiology');
                              setShowCustomTestModal(true);
                              setRadioDropdownOpen(false);
                            }}
                            className="text-blue-600 underline font-bold ml-1"
                          >
                            + Add as Custom Test
                          </button>
                        </div>
                      ) : (
                        filteredRadiologyList.map((r) => (
                          <div
                            key={r.id || r.service_code}
                            onClick={() => addRadiologyFromSearch(r)}
                            className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs flex justify-between items-center transition"
                          >
                            <div>
                              <span className="font-bold text-slate-800">{r.service_name}</span>
                              {r.supported_views && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Projections: {r.supported_views.join(', ')}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold shrink-0">
                              {r.sub_category || 'Imaging'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Ordered Radiology Items with Checkable Projection Badges */}
                {orderedRadiology.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {orderedRadiology.map((item, idx) => (
                      <div key={idx} className="p-3 bg-blue-50/70 border border-blue-200 rounded text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-xs">
                        <div className="flex-1">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{item.service_name}</span>
                            <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded font-semibold">{item.modality}</span>
                          </div>

                          {/* Projection View Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Views:</span>
                            {item.available_views.map((view) => {
                              const isSelected = item.selected_views.includes(view);
                              return (
                                <button
                                  key={view}
                                  type="button"
                                  onClick={() => toggleRadioView(idx, view)}
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition border ${
                                    isSelected 
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                                  }`}
                                >
                                  {isSelected ? `✓ ${view}` : view}
                                </button>
                              );
                            })}

                            {/* Add Custom Projection View to this item */}
                            <button
                              type="button"
                              onClick={() => setCustomViewModalIdx(idx)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1"
                            >
                              <Plus className="w-2.5 h-2.5" /> View
                            </button>
                          </div>

                          {/* Custom View Input Popover */}
                          {customViewModalIdx === idx && (
                            <div className="mt-2 flex items-center gap-2 bg-white p-2 border border-indigo-200 rounded shadow-sm">
                              <input
                                type="text"
                                value={customViewText}
                                onChange={(e) => setCustomViewText(e.target.value)}
                                placeholder="e.g. Mortise, Skyline 45°, Swimmer's..."
                                className="px-2 py-1 text-xs border rounded w-52 outline-none font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddCustomViewToItem(idx)}
                                className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomViewModalIdx(null)}
                                className="text-slate-400 text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        <button onClick={() => removeRadioItem(idx)} className="p-1 text-red-500 hover:bg-red-100 rounded self-end md:self-auto">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. PROGRESSIVE SEARCHABLE LABORATORY */}
              <div className="bg-white border border-amber-200 rounded-lg p-3.5 shadow-sm space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                    <TestTube className="w-4 h-4 text-amber-600" /> Laboratory & Blood Pathology ({allLabServices.length}+ Tests)
                  </span>
                  <span className="text-[10px] text-slate-500">1-Click quick panels or search below</span>
                </div>

                {/* 1-Click Fast Panels */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_LAB_PANELS.map((p) => {
                    const isAdded = orderedLabs.some(l => l.service_code === p.code);
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => addLabFromSearch({ service_code: p.code, service_name: p.name })}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                          isAdded 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {isAdded ? `✓ ${p.name}` : `+ ${p.name}`}
                      </button>
                    );
                  })}
                </div>

                {/* Progressive Lab Search Input */}
                <div className="relative pt-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={labSearchInput}
                    onFocus={() => setLabDropdownOpen(true)}
                    onChange={(e) => {
                      setLabSearchInput(e.target.value);
                      setLabDropdownOpen(true);
                    }}
                    placeholder="Search Blood, Urine, Serology (e.g. Calcium, Electrolytes, Troponin, Vitamin D, Widal)..."
                    className="w-full pl-8 pr-8 py-2 text-xs font-bold text-slate-800 bg-amber-50/30 border border-amber-300 rounded outline-none focus:ring-1 focus:ring-amber-600"
                  />
                  {labSearchInput && (
                    <button
                      onClick={() => setLabSearchInput('')}
                      className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}

                  {/* Progressive Lab Match Dropdown */}
                  {labDropdownOpen && (
                    <div className="absolute z-30 w-full bg-white border border-slate-300 rounded-b shadow-xl max-h-60 overflow-y-auto mt-1 divide-y divide-slate-100">
                      {filteredLabList.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          No matching lab test found.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setCustomTestName(labSearchInput);
                              setCustomTestCategory('Laboratory');
                              setShowCustomTestModal(true);
                              setLabDropdownOpen(false);
                            }}
                            className="text-amber-700 underline font-bold ml-1"
                          >
                            + Add as Custom Test
                          </button>
                        </div>
                      ) : (
                        filteredLabList.map((l) => (
                          <div
                            key={l.id || l.service_code}
                            onClick={() => addLabFromSearch(l)}
                            className="p-2.5 hover:bg-amber-50 cursor-pointer text-xs flex justify-between items-center transition"
                          >
                            <div>
                              <span className="font-bold text-slate-800">{l.service_name}</span>
                              <span className="text-[10px] text-slate-400 ml-2 font-mono">({l.service_code})</span>
                            </div>
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold shrink-0">
                              {l.sub_category || 'Pathology'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Labs Chips */}
                {orderedLabs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                    {orderedLabs.map((l, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-semibold">
                        {l.service_name}
                        <button type="button" onClick={() => removeLabItem(idx)} className="text-amber-700 hover:text-red-600 font-bold ml-1">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Requisition Trigger Button */}
                {(orderedRadiology.length > 0 || orderedLabs.length > 0) && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendForTests}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow transition"
                    >
                      Send for Investigations & Print Requisition Slip <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* REPORT FINDINGS */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Report Findings & Film Review (When Patient Returns from Lab / X-Ray)
                </label>
                <textarea
                  rows={2}
                  value={investigationFindings}
                  onChange={(e) => setInvestigationFindings(e.target.value)}
                  placeholder="e.g. X-Ray Knee shows medial joint space reduction Grade IV. CBC normal, CRP negative..."
                  className="w-full p-2 text-xs border border-slate-300 rounded outline-none"
                />
              </div>

              {/* PRESCRIPTIONS (Rx) */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
                <div className="text-[11px] font-bold text-slate-700 uppercase mb-2">Rx — Prescribed Medications</div>
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={medSearchQuery}
                    onChange={(e) => handleMedSearch(e.target.value)}
                    placeholder="Search Formulary (e.g. Zerodol, Pantocid, Dolo)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded outline-none"
                  />
                  {medSearchResults.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-b shadow-lg max-h-48 overflow-y-auto mt-1">
                      {medSearchResults.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => addMedicineToRx(m)}
                          className="p-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-slate-100 flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{m.brand_name}</span>
                            <span className="text-[10px] text-slate-500 ml-2">({m.generic_composition})</span>
                          </div>
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{m.dosage_form}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200 text-[10px]">
                        <th className="py-2 px-2">Drug Name</th>
                        <th className="py-2 px-2">Frequency</th>
                        <th className="py-2 px-2">Timing</th>
                        <th className="py-2 px-2">Duration</th>
                        <th className="py-2 px-2">Instructions</th>
                        <th className="py-2 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {medications.map((med, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-bold text-slate-800">{med.brand_name}</td>
                          <td className="py-2 px-2">
                            <select value={med.frequency} onChange={(e) => updateMedRow(idx, 'frequency', e.target.value)} className="p-1 border rounded font-semibold bg-white outline-none">
                              <option value="1-0-1">1-0-1 (BD)</option>
                              <option value="1-1-1">1-1-1 (TDS)</option>
                              <option value="1-0-0">1-0-0 (OD Morning)</option>
                              <option value="0-0-1">0-0-1 (OD Night)</option>
                              <option value="SOS">SOS</option>
                              <option value="STAT">STAT</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <select value={med.food_timing} onChange={(e) => updateMedRow(idx, 'food_timing', e.target.value)} className="p-1 border rounded bg-white outline-none">
                              <option value="After Food (PC)">After Food (PC)</option>
                              <option value="Before Food (AC)">Before Food (AC)</option>
                              <option value="Empty Stomach">Empty Stomach</option>
                              <option value="Bedtime">Bedtime</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input type="text" value={med.duration} onChange={(e) => updateMedRow(idx, 'duration', e.target.value)} className="p-1 border rounded w-20 outline-none font-medium" />
                          </td>
                          <td className="py-2 px-2">
                            <input type="text" value={med.instructions} onChange={(e) => updateMedRow(idx, 'instructions', e.target.value)} className="p-1 border rounded w-full outline-none" />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button onClick={() => removeMedRow(idx)} className="p-1 text-red-500 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ADVICE & DISPOSITION */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">General Advice & Precautions</label>
                    <textarea rows={2} value={generalAdvice} onChange={(e) => setGeneralAdvice(e.target.value)} placeholder="e.g. Quadriceps exercises, avoid sitting on floor..." className="w-full p-2 text-xs border rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Follow-up Schedule</label>
                    <select value={followUpDays} onChange={(e) => setFollowUpDays(e.target.value)} className="w-full px-2.5 py-2 text-xs border rounded bg-white font-semibold outline-none">
                      <option value={0}>Today (With Reports)</option>
                      <option value={3}>After 3 Days</option>
                      <option value={5}>After 5 Days</option>
                      <option value={7}>After 1 Week</option>
                      <option value={14}>After 2 Weeks</option>
                      <option value={30}>After 1 Month</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFinalize('HOME')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Treat at Home (Finalize Rx)
                    </button>

                    <button
                      onClick={() => handleFinalize('ADMISSION_ADVISED')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded shadow transition"
                    >
                      <Bed className="w-3.5 h-3.5" /> Advise IPD Admission
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setPrintDocType('PRESCRIPTION');
                      setTimeout(() => window.print(), 100);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded shadow"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Rx Sheet
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-9 bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400 text-xs shadow-sm">
              Select a patient from the queue to start consultation.
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM TEST MODAL */}
      {showCustomTestModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" /> Add Custom / Unlisted Investigation
              </h3>
              <button onClick={() => setShowCustomTestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category</label>
              <select
                value={customTestCategory}
                onChange={(e) => setCustomTestCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded bg-white outline-none"
              >
                <option value="Radiology">Radiology / Imaging (X-Ray, CT, MRI, USG)</option>
                <option value="Laboratory">Laboratory & Pathology</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Investigation Name *</label>
              <input
                type="text"
                required
                value={customTestName}
                onChange={(e) => setCustomTestName(e.target.value)}
                placeholder="e.g. X-Ray Rosenberg View Both Knees or Serum Zinc"
                className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded outline-none"
              />
            </div>

            {customTestCategory === 'Radiology' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Supported Views (Comma Separated)</label>
                <input
                  type="text"
                  value={customTestViews}
                  onChange={(e) => setCustomTestViews(e.target.value)}
                  placeholder="e.g. AP Standing, Lateral, Rosenberg View"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCustomTestModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 font-bold text-xs rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomInvestigation}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow"
              >
                Save & Add to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STRICT PRINT ENGINE */}
      {selectedVisit && (
        <div className="hidden print:block font-sans text-black p-8 bg-white" style={{ minHeight: '297mm' }}>
          {printMode === 'blank_a4' ? (
            <div className="text-center pb-3 border-b-2 border-black mb-4">
              <h1 className="text-xl font-black tracking-wider uppercase">GURU NANAK HOSPITAL</h1>
              <p className="text-xs text-neutral-600">Delhi Mathura Road, Palwal • Tel: 01275-256660</p>
            </div>
          ) : (
            <div style={{ height: '65mm' }} />
          )}

          {/* Patient Header */}
          <div className="border-b border-black pb-2 mb-3 text-xs flex justify-between items-start">
            <div>
              <div className="font-bold">
                Token: {selectedVisit.token_display || `#${selectedVisit.opd_number}`} &nbsp;|&nbsp; UHID: <span className="font-mono">{selectedVisit.uhid}</span>
              </div>
              <div className="text-sm font-bold mt-0.5">
                {selectedVisit.patients?.name} ({selectedVisit.patients?.age_years} Y / {selectedVisit.patients?.sex})
              </div>
              <div className="text-[11px] text-neutral-600">
                Payer: {selectedVisit.patients?.master_payers?.company_name || 'Self-Pay'}
              </div>
              {allergies && <div className="text-xs font-bold text-red-600 mt-0.5">Allergies: {allergies}</div>}
            </div>
            <div className="text-right">
              <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
              <div className="font-bold">Doctor: {selectedDoctorObj?.name}</div>
              <div className="text-[10px] text-neutral-600">{selectedDoctorObj?.master_departments?.name}</div>
            </div>
          </div>

          {/* PRINT DOCUMENT VARIANT: INVESTIGATION REQUISITION */}
          {printDocType === 'RADIO_REQUISITION' ? (
            <div className="my-6 p-4 border-2 border-dashed border-black space-y-4">
              <div className="text-center font-bold text-sm uppercase underline">
                INVESTIGATION REQUISITION SLIP (RADIOLOGY & PATHOLOGY)
              </div>
              <div className="text-xs"><strong>Clinical Indication:</strong> {chiefComplaints}</div>
              <div className="text-xs"><strong>Provisional Diagnosis:</strong> {provisionalDiagnosis || 'Under Evaluation'}</div>

              {orderedRadiology.length > 0 && (
                <div className="border-t border-neutral-300 pt-2">
                  <div className="text-xs font-bold uppercase mb-1">Radiology & Imaging Orders:</div>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {orderedRadiology.map((r, idx) => (
                      <li key={idx}>
                        <span className="font-bold">{r.service_name}</span> — Views: <span className="font-semibold underline">{r.selected_views.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {orderedLabs.length > 0 && (
                <div className="border-t border-neutral-300 pt-2">
                  <div className="text-xs font-bold uppercase mb-1">Laboratory & Pathology Tests:</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {orderedLabs.map((l, idx) => (
                      <span key={idx} className="bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300 font-semibold">{l.service_name}</span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-neutral-600 pt-4 italic">
                * Please return to Doctor's Chamber with original X-Ray films and Lab reports for final evaluation.
              </p>
            </div>
          ) : (
            /* COMPLETE PRESCRIPTION PRINT */
            <>
              <div className="text-[11px] bg-neutral-100 p-2 border border-neutral-300 rounded mb-3 flex justify-between font-mono">
                <span>BP: {bpSys || '-'}/{bpDia || '-'} mmHg</span>
                <span>Pulse: {pulse || '-'} bpm</span>
                <span>SpO2: {spo2 || '-'}%</span>
                <span>Temp: {temp || '-'}°F</span>
                <span>VAS: {vasScale}/10</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                <div>
                  <span className="font-bold uppercase text-[10px] text-neutral-600 block">Chief Complaints:</span>
                  <p>{chiefComplaints || 'Routine Consultation'}</p>
                </div>
                <div>
                  <span className="font-bold uppercase text-[10px] text-neutral-600 block">Final Diagnosis:</span>
                  <p className="font-bold">{provisionalDiagnosis || 'Clinical evaluation completed'}</p>
                </div>
              </div>

              {(orderedRadiology.length > 0 || orderedLabs.length > 0) && (
                <div className="text-[11px] mb-3 text-neutral-800 bg-neutral-50 p-2 border border-neutral-200">
                  {orderedRadiology.length > 0 && (
                    <div><strong>Radiology Done:</strong> {orderedRadiology.map(r => `${r.service_name} (${r.selected_views.join(', ')})`).join('; ')}</div>
                  )}
                  {orderedLabs.length > 0 && (
                    <div><strong>Labs Done:</strong> {orderedLabs.map(l => l.service_name).join(', ')}</div>
                  )}
                  {investigationFindings && <div className="mt-1"><strong>Report Findings:</strong> {investigationFindings}</div>}
                </div>
              )}

              <div className="mb-4">
                <span className="font-black text-sm uppercase block mb-1">Rx (Prescription)</span>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black text-[10px] uppercase font-bold">
                      <th className="py-1">Medicine Name</th>
                      <th className="py-1">Dosage / Frequency</th>
                      <th className="py-1">Timing</th>
                      <th className="py-1">Duration</th>
                      <th className="py-1">Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((m, idx) => (
                      <tr key={idx} className="border-b border-neutral-200">
                        <td className="py-1.5 font-bold">{m.brand_name}</td>
                        <td className="py-1.5">{m.frequency}</td>
                        <td className="py-1.5">{m.food_timing}</td>
                        <td className="py-1.5">{m.duration}</td>
                        <td className="py-1.5">{m.instructions || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs border-t border-neutral-300 pt-3 flex justify-between items-end mt-4">
                <div>
                  <div className="font-bold">General Advice: {generalAdvice || 'Adequate rest & hydration'}</div>
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    Follow-up: {followUpDays === 0 ? 'Today (With Reports)' : `In ${followUpDays} Days`}
                  </div>
                </div>

                <div className="text-right">
                  <div style={{ height: '40px' }} />
                  <div className="font-bold border-t border-black pt-1">{selectedDoctorObj?.name}</div>
                  <div className="text-[10px] text-neutral-600">{selectedDoctorObj?.master_departments?.name}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
