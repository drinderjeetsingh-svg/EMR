import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Film, Upload, CheckCircle2, RefreshCw, Send, ArrowRight, 
  ShieldCheck, Server, Search, Check, AlertCircle 
} from 'lucide-react';

export default function RadiologyTechDashboard() {
  const [worklist, setWorklist] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [techName, setTechName] = useState('Senior Radiographer (DR/CR Unit)');
  const [dicomInstanceInput, setDicomInstanceInput] = useState('');
  const [previewSrc, setPreviewSrc] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Orthanc PACS Connection Settings
  const [orthancUrl, setOrthancUrl] = useState('http://localhost:8042');
  const [pacsConnected, setPacsConnected] = useState(false);
  const [pacsStudies, setPacsStudies] = useState([]);
  const [fetchingPacs, setFetchingPacs] = useState(false);

  useEffect(() => {
    fetchRadiologyQueue();
    checkOrthancHealth();
  }, []);

  const checkOrthancHealth = async () => {
    try {
      const res = await fetch(`${orthancUrl}/system`, { method: 'GET' });
      if (res.ok) {
        setPacsConnected(true);
      } else {
        setPacsConnected(false);
      }
    } catch {
      setPacsConnected(false);
    }
  };

  const fetchRadiologyQueue = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('opd_visits')
      .select('*, patients(*, master_payers(company_name))')
      .order('created_at', { ascending: false });

    if (data) {
      const withRadio = data.filter(v => {
        try {
          const inv = JSON.parse(v.investigations_advised || '{}');
          return inv.radiology && inv.radiology.length > 0;
        } catch {
          return false;
        }
      });
      setWorklist(withRadio);
      if (withRadio.length > 0 && !selectedExam) {
        setSelectedExam(withRadio[0]);
      }
    }
    setLoading(false);
  };

  const queryOrthancForPatient = async () => {
    if (!selectedExam) return;
    setFetchingPacs(true);
    try {
      // Query Orthanc REST API for patient's UHID or name
      const res = await fetch(`${orthancUrl}/tools/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Level: 'Study',
          Query: {
            PatientID: `*${selectedExam.uhid.replace('GNH-UHID-', '')}*`,
            PatientName: `*${selectedExam.patients?.name || ''}*`
          }
        })
      });

      if (res.ok) {
        const studyIds = await res.json();
        setPacsStudies(studyIds || []);
        if (studyIds.length > 0) {
          setDicomInstanceInput(studyIds[0]);
          setPreviewSrc(`${orthancUrl}/studies/${studyIds[0]}/preview`);
          setStatusMsg(`Found ${studyIds.length} matching DICOM studies on Orthanc PACS!`);
        } else {
          setStatusMsg('No studies found in Orthanc PACS for this patient yet.');
        }
      } else {
        setStatusMsg('Could not query Orthanc PACS. Check server status.');
      }
    } catch (e) {
      setStatusMsg(`Orthanc PACS connection error: ${e.message}`);
    } finally {
      setFetchingPacs(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewSrc(url);
      setDicomInstanceInput(`DR_LOCAL_${Date.now().toString().slice(-6)}`);
    }
  };

  const handleTransmitToRadiologist = async () => {
    if (!selectedExam) return;

    let radioOrders = [];
    try {
      const inv = JSON.parse(selectedExam.investigations_advised || '{}');
      radioOrders = inv.radiology || [];
    } catch {
      radioOrders = [];
    }

    const payload = radioOrders.map(r => ({
      visit_id: selectedExam.visit_id,
      uhid: selectedExam.uhid,
      modality: r.modality || 'X-Ray',
      service_code: r.service_code,
      service_name: r.service_name,
      selected_views: r.selected_views,
      dicom_instance_id: dicomInstanceInput || 'ORTHANC_CSTORE_RECEIVED',
      dicom_file_url: previewSrc || null,
      status: 'IMAGE_ACQUIRED'
    }));

    await supabase.from('radiology_reports').delete().eq('visit_id', selectedExam.visit_id);
    const { error } = await supabase.from('radiology_reports').insert(payload);

    if (!error) {
      await supabase.from('opd_visits').update({
        consult_stage: 'INVESTIGATION_PENDING'
      }).eq('visit_id', selectedExam.visit_id);

      setStatusMsg(`✓ Images acquired & transmitted to Radiologist Reporting Workstation!`);
      fetchRadiologyQueue();
    } else {
      alert(`Save error: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Film className="w-5 h-5 text-blue-600" /> Radiology Modality Technician Desk
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">DR / CT / MRI Intake • Orthanc PACS Receiver & Image Dispatch</p>
        </div>

        {/* Orthanc Health & Refresh Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={orthancUrl}
              onChange={(e) => setOrthancUrl(e.target.value)}
              className="font-mono text-[11px] outline-none w-36"
              placeholder="http://localhost:8042"
            />
            <span className={`w-2 h-2 rounded-full ${pacsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>

          <button
            onClick={fetchRadiologyQueue}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Worklist
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* 2-Column Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Modality Worklist Sidebar */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-3 shadow-sm h-fit">
          <div className="text-xs font-bold text-slate-700 uppercase mb-3 flex justify-between items-center">
            <span>Requisition Queue ({worklist.length})</span>
            <span className="text-[10px] text-blue-600 font-mono">Live</span>
          </div>

          <div className="space-y-2 max-h-[75vh] overflow-y-auto">
            {worklist.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No pending radiology orders.</div>
            ) : (
              worklist.map(v => (
                <div
                  key={v.visit_id}
                  onClick={() => {
                    setSelectedExam(v);
                    setPreviewSrc(null);
                    setStatusMsg('');
                  }}
                  className={`p-3 rounded border text-xs cursor-pointer transition ${
                    selectedExam?.visit_id === v.visit_id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-900">{v.token_display || `#${v.opd_number}`}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold">{v.department}</span>
                  </div>
                  <div className="font-bold text-slate-800 mt-1">{v.patients?.name}</div>
                  <div className="text-[11px] text-slate-500 flex justify-between mt-0.5">
                    <span>{v.patients?.age_years}Y / {v.patients?.sex}</span>
                    <span className="font-mono text-slate-400">{v.visit_date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Acquisition & Verification Center */}
        {selectedExam ? (
          <div className="lg:col-span-8 space-y-4">
            {/* Patient Header */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900 text-sm">{selectedExam.patients?.name}</div>
                <div className="text-xs text-slate-500">
                  UHID: <span className="font-mono font-bold text-slate-700">{selectedExam.uhid}</span> • {selectedExam.patients?.age_years} Y / {selectedExam.patients?.sex}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-blue-800">{selectedExam.patients?.master_payers?.company_name || 'Self-Pay (Cash)'}</div>
                <div className="text-[10px] text-slate-400">Consultant: {selectedExam.consultant_id}</div>
              </div>
            </div>

            {/* Requested Projection Views */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase">Ordered Projections to Acquire on Modality</div>
              {(() => {
                let radio = [];
                try { radio = JSON.parse(selectedExam.investigations_advised || '{}').radiology || []; } catch { radio = []; }
                return (
                  <div className="space-y-2">
                    {radio.map((r, idx) => (
                      <div key={idx} className="p-3 bg-blue-50/60 border border-blue-200 rounded text-xs">
                        <div className="font-bold text-slate-900 text-sm">{r.service_name}</div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Views Ordered:</span>
                          {r.selected_views.map(v => (
                            <span key={v} className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-bold shadow-xs">
                              ✓ {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Orthanc Automatic Fetch & Direct Local Upload */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Orthanc PACS Study UID / Instance
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dicomInstanceInput}
                        onChange={(e) => setDicomInstanceInput(e.target.value)}
                        placeholder="e.g. 1.2.840.10008.5.1..."
                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded outline-none"
                      />
                      <button
                        type="button"
                        onClick={queryOrthancForPatient}
                        disabled={fetchingPacs}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-bold shrink-0"
                      >
                        {fetchingPacs ? 'Querying...' : 'Query PACS'}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Or Direct DR / Film Upload
                    </label>
                    <input
                      type="file"
                      accept="image/*,.dcm"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>

                {previewSrc && (
                  <div className="p-3 bg-slate-900 rounded-lg text-center">
                    <img src={previewSrc} alt="Acquired Preview" className="h-56 mx-auto object-contain rounded" />
                    <span className="text-[10px] text-slate-400 mt-1 block">Film acquired successfully</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Signing Tech:</span>
                    <input
                      type="text"
                      value={techName}
                      onChange={(e) => setTechName(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded font-bold outline-none"
                    />
                  </div>

                  <button
                    onClick={handleTransmitToRadiologist}
                    className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow transition"
                  >
                    <Send className="w-3.5 h-3.5" /> Transmit to Radiologist Queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400 text-xs">
            Select an exam from the worklist to acquire and transmit scans.
          </div>
        )}
      </div>
    </div>
  );
}
