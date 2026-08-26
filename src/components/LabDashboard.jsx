import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  TestTube, Search, CheckCircle2, AlertTriangle, Printer, 
  Save, RefreshCw, Clock, User, ShieldCheck, FileText 
} from 'lucide-react';

export default function LabDashboard() {
  const [labWorklist, setLabWorklist] = useState([]);
  const [selectedWorkItem, setSelectedWorkItem] = useState(null);
  const [testRows, setTestRows] = useState([]);
  const [techName, setTechName] = useState('Senior Lab Tech (GNH)');
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWorklist();
  }, []);

  const fetchWorklist = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('opd_visits')
      .select('*, patients(*, master_payers(company_name))')
      .order('created_at', { ascending: false });

    if (data) {
      // Filter visits that have lab orders
      const withLabs = data.filter(v => {
        try {
          const inv = JSON.parse(v.investigations_advised || '{}');
          return inv.labs && inv.labs.length > 0;
        } catch {
          return false;
        }
      });
      setLabWorklist(withLabs);
      if (withLabs.length > 0 && !selectedWorkItem) {
        loadPatientLabOrder(withLabs[0]);
      }
    }
    setLoading(false);
  };

  const loadPatientLabOrder = async (visit) => {
    setSelectedWorkItem(visit);
    setIsSaved(false);
    let labs = [];
    try {
      const parsed = JSON.parse(visit.investigations_advised || '{}');
      labs = parsed.labs || [];
    } catch {
      labs = [];
    }

    // Fetch master lab ranges for comparison
    const { data: masterLabs } = await supabase.from('master_lab_tests').select('*');
    const masterMap = (masterLabs || []).reduce((acc, cur) => {
      acc[cur.test_code] = cur;
      return acc;
    }, {});

    // Check if results already entered
    const { data: existingResults } = await supabase
      .from('lab_order_results')
      .select('*')
      .eq('visit_id', visit.visit_id);

    const existingMap = (existingResults || []).reduce((acc, cur) => {
      acc[cur.test_code] = cur;
      return acc;
    }, {});

    const rows = labs.map(l => {
      const exist = existingMap[l.service_code];
      const master = masterMap[l.service_code] || {};
      const refRange = master.conventional_range || 'Normal';
      const unit = master.conventional_unit || '-';

      return {
        test_code: l.service_code,
        test_name: l.service_name,
        category: master.category || 'Clinical Pathology',
        measured_value: exist ? exist.measured_value : '',
        unit: exist ? exist.unit : unit,
        reference_range: exist ? exist.reference_range : refRange,
        is_abnormal: exist ? exist.is_abnormal : false
      };
    });

    setTestRows(rows);
  };

  const handleValueChange = (idx, val) => {
    const updated = [...testRows];
    updated[idx].measured_value = val;

    // Check if numeric value falls outside range
    const num = parseFloat(val);
    const rangeStr = updated[idx].reference_range;
    if (!isNaN(num) && rangeStr.includes('-')) {
      const parts = rangeStr.split('-').map(p => parseFloat(p.trim().replace(/[^\d.]/g, '')));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        updated[idx].is_abnormal = num < parts[0] || num > parts[1];
      }
    }
    setTestRows(updated);
  };

  const handleSaveAndVerify = async () => {
    if (!selectedWorkItem) return;

    const payload = testRows.map(r => ({
      visit_id: selectedWorkItem.visit_id,
      uhid: selectedWorkItem.uhid,
      test_code: r.test_code,
      test_name: r.test_name,
      category: r.category,
      measured_value: r.measured_value,
      unit: r.unit,
      reference_range: r.reference_range,
      is_abnormal: r.is_abnormal,
      technician_name: techName,
      status: 'VERIFIED',
      verified_at: new Date().toISOString()
    }));

    // Delete previous for visit and re-insert
    await supabase.from('lab_order_results').delete().eq('visit_id', selectedWorkItem.visit_id);
    const { error } = await supabase.from('lab_order_results').insert(payload);

    if (!error) {
      // Update OPD visit report findings text automatically
      const findingsSummary = testRows.map(r => `${r.test_name}: ${r.measured_value} ${r.unit}`).join('; ');
      await supabase.from('opd_visits').update({
        investigation_findings: findingsSummary,
        consult_stage: 'REVIEW_READY'
      }).eq('visit_id', selectedWorkItem.visit_id);

      setIsSaved(true);
    } else {
      alert(`Save error: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="print:hidden">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <TestTube className="w-5 h-5 text-amber-600" /> Laboratory Pathology Workstation
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Enter & Verify Specimen Results • Live Doctor Notification</p>
          </div>
          <button
            onClick={fetchWorklist}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Orders
          </button>
        </div>

        {/* Workstation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Worklist Sidebar */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-3 shadow-sm h-fit">
            <div className="text-xs font-bold text-slate-700 uppercase mb-3 flex justify-between items-center">
              <span>Pending Lab Orders ({labWorklist.length})</span>
              <span className="text-[10px] text-amber-600 font-mono">Live Sync</span>
            </div>

            <div className="space-y-2 max-h-[75vh] overflow-y-auto">
              {labWorklist.map((v) => (
                <div
                  key={v.visit_id}
                  onClick={() => loadPatientLabOrder(v)}
                  className={`p-3 rounded border text-xs cursor-pointer transition ${
                    selectedWorkItem?.visit_id === v.visit_id
                      ? 'border-amber-500 bg-amber-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-900">{v.token_display || `#${v.opd_number}`}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                      {v.department}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800 mt-1">{v.patients?.name}</div>
                  <div className="text-[11px] text-slate-500 flex justify-between mt-0.5">
                    <span>{v.patients?.age_years}Y / {v.patients?.sex}</span>
                    <span className="font-mono text-slate-400">{v.visit_date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Entry Table */}
          {selectedWorkItem ? (
            <div className="lg:col-span-8 space-y-4">
              {/* Patient Bar */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{selectedWorkItem.patients?.name}</div>
                  <div className="text-xs text-slate-500">
                    UHID: <span className="font-mono font-bold text-slate-700">{selectedWorkItem.uhid}</span> • {selectedWorkItem.patients?.age_years} Y / {selectedWorkItem.patients?.sex}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-blue-800">{selectedWorkItem.patients?.master_payers?.company_name || 'Self-Pay (Cash)'}</div>
                  <div className="text-[10px] text-slate-400">Doctor: {selectedWorkItem.consultant_id}</div>
                </div>
              </div>

              {/* Data Entry Grid */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="text-xs font-bold text-slate-700 uppercase mb-3">Specimen Test Results Entry</div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200 text-[10px]">
                      <th className="py-2 px-3">Test Name</th>
                      <th className="py-2 px-3">Measured Result</th>
                      <th className="py-2 px-3">Unit</th>
                      <th className="py-2 px-3">Normal Range</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {testRows.map((row, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50 ${row.is_abnormal ? 'bg-red-50/50' : ''}`}>
                        <td className="py-2 px-3 font-bold text-slate-800">{row.test_name}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.measured_value}
                            onChange={(e) => handleValueChange(idx, e.target.value)}
                            placeholder="e.g. 13.5"
                            className={`w-28 px-2 py-1 border rounded font-mono font-bold outline-none ${
                              row.is_abnormal ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-300'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-mono">{row.unit}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{row.reference_range}</td>
                        <td className="py-2 px-3 text-center">
                          {row.is_abnormal ? (
                            <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-bold">Abnormal</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Signing Tech:</span>
                    <input
                      type="text"
                      value={techName}
                      onChange={(e) => setTechName(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded outline-none font-bold"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAndVerify}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition"
                    >
                      <Save className="w-3.5 h-3.5" /> Verify & Submit to Doctor
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded shadow transition"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Lab Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400 text-xs">
              Select a patient from the left worklist to enter test results.
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE NABL LAB REPORT SHEET */}
      {selectedWorkItem && (
        <div className="hidden print:block font-sans text-black p-8 bg-white" style={{ minHeight: '297mm' }}>
          <div className="text-center pb-3 border-b-2 border-black mb-4">
            <h1 className="text-xl font-black tracking-wider uppercase">GURU NANAK HOSPITAL</h1>
            <p className="text-xs text-neutral-600">Department of Clinical Laboratory & Pathology Services • Palwal</p>
            <span className="inline-block mt-1 px-3 py-0.5 text-[10px] font-bold bg-neutral-100 border border-black uppercase">
              CONFIDENTIAL DIAGNOSTIC REPORT
            </span>
          </div>

          {/* Patient Header */}
          <div className="border-b border-black pb-2 mb-4 text-xs flex justify-between">
            <div>
              <div className="font-bold">UHID: <span className="font-mono">{selectedWorkItem.uhid}</span></div>
              <div className="text-sm font-bold mt-0.5">{selectedWorkItem.patients?.name} ({selectedWorkItem.patients?.age_years} Y / {selectedWorkItem.patients?.sex})</div>
              <div>Ref Doctor: <span className="font-bold">{selectedWorkItem.consultant_id}</span></div>
            </div>
            <div className="text-right">
              <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
              <div>Billing: <span className="font-bold">{selectedWorkItem.patients?.master_payers?.company_name || 'Self-Pay'}</span></div>
            </div>
          </div>

          {/* Report Grid */}
          <table className="w-full text-left text-xs border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-black text-[10px] uppercase font-bold">
                <th className="py-2">Test Name</th>
                <th className="py-2">Observed Result</th>
                <th className="py-2">Units</th>
                <th className="py-2">Biological Reference Intervals</th>
              </tr>
            </thead>
            <tbody>
              {testRows.map((r, idx) => (
                <tr key={idx} className="border-b border-neutral-200">
                  <td className="py-2 font-bold">{r.test_name}</td>
                  <td className={`py-2 font-mono font-bold ${r.is_abnormal ? 'text-red-700 underline' : ''}`}>
                    {r.measured_value || 'Pending'}
                  </td>
                  <td className="py-2 font-mono">{r.unit}</td>
                  <td className="py-2 font-mono">{r.reference_range}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature Footer */}
          <div className="text-xs border-t border-black pt-4 flex justify-between items-end mt-12">
            <div>
              <p className="text-[10px] text-neutral-500 italic">* Results verified under standard calibration guidelines.</p>
            </div>
            <div className="text-right">
              <div style={{ height: '40px' }} />
              <div className="font-bold border-t border-black pt-1">{techName}</div>
              <div className="text-[10px] text-neutral-600">Biochemist / Pathologist</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
