import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FlaskConical, CheckCircle2, AlertCircle, RefreshCw, 
  Search, Check, FileText, Printer, User, ShieldCheck
} from 'lucide-react';

export default function LabDashboard() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [masterParams, setMasterParams] = useState([]);
  const [paramRows, setParamRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [technicianName] = useState('Senior Biochemist / Lab Tech');

  useEffect(() => {
    fetchMasterLabParameters();
    fetchLabQueue();
  }, []);

  const fetchMasterLabParameters = async () => {
    try {
      const { data } = await supabase.from('master_lab_panel_parameters').select('*').order('display_order');
      if (data && data.length > 0) {
        setMasterParams(data);
      } else {
        // Built-in NBME standard fallbacks if table not yet seeded
        setMasterParams([
          { panel_code: 'LB012', parameter_code: 'CBC_HB', parameter_name: 'Haemoglobin (Hb)', male_reference_range: '13.5 - 17.5', female_reference_range: '12.0 - 16.0', unit: 'g/dL', display_order: 1 },
          { panel_code: 'LB012', parameter_code: 'CBC_TLC', parameter_name: 'Total Leukocyte Count (TLC)', male_reference_range: '4000 - 11000', female_reference_range: '4000 - 11000', unit: '/mm³', display_order: 2 },
          { panel_code: 'LB012', parameter_code: 'CBC_PLT', parameter_name: 'Platelet Count', male_reference_range: '150000 - 450000', female_reference_range: '150000 - 450000', unit: '/mm³', display_order: 3 },
          { panel_code: 'LB012', parameter_code: 'CBC_ESR', parameter_name: 'ESR (Westergren)', male_reference_range: '0 - 15', female_reference_range: '0 - 20', unit: 'mm/1st hr', display_order: 4 },
          { panel_code: 'LB123', parameter_code: 'KFT_CREAT', parameter_name: 'Serum Creatinine', male_reference_range: '0.7 - 1.3', female_reference_range: '0.6 - 1.1', unit: 'mg/dL', display_order: 1 },
          { panel_code: 'LB123', parameter_code: 'KFT_UREA', parameter_name: 'Blood Urea', male_reference_range: '15 - 40', female_reference_range: '15 - 40', unit: 'mg/dL', display_order: 2 },
          { panel_code: 'LB123', parameter_code: 'KFT_NA', parameter_name: 'Serum Sodium (Na+)', male_reference_range: '135 - 145', female_reference_range: '135 - 145', unit: 'mEq/L', display_order: 3 },
          { panel_code: 'LB123', parameter_code: 'KFT_K', parameter_name: 'Serum Potassium (K+)', male_reference_range: '3.5 - 5.0', female_reference_range: '3.5 - 5.0', unit: 'mEq/L', display_order: 4 },
          { panel_code: 'LB124', parameter_code: 'LFT_BILI_TOT', parameter_name: 'Total Bilirubin', male_reference_range: '0.2 - 1.2', female_reference_range: '0.2 - 1.2', unit: 'mg/dL', display_order: 1 },
          { panel_code: 'LB124', parameter_code: 'LFT_SGPT', parameter_name: 'SGPT / ALT', male_reference_range: '10 - 40', female_reference_range: '10 - 35', unit: 'U/L', display_order: 2 },
          { panel_code: 'LB124', parameter_code: 'LFT_SGOT', parameter_name: 'SGOT / AST', male_reference_range: '10 - 40', female_reference_range: '10 - 35', unit: 'U/L', display_order: 3 }
        ]);
      }
    } catch {
      // fallback
    }
  };

  const fetchLabQueue = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('opd_visits')
        .select('*, patients(*, master_payers(*))')
        .order('created_at', { ascending: false });

      const withLab = (data || []).filter(v => {
        try {
          if (!v.investigations_advised) return false;
          const inv = typeof v.investigations_advised === 'string'
            ? JSON.parse(v.investigations_advised)
            : v.investigations_advised;
          return Array.isArray(inv?.lab) && inv.lab.length > 0;
        } catch {
          return false;
        }
      });

      setOrders(withLab);
      if (withLab.length > 0 && !selectedOrder) {
        loadOrder(withLab[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadOrder = (order) => {
    if (!order) return;
    setSelectedOrder(order);
    setStatusMsg('');

    let inv = { lab: [] };
    try {
      inv = typeof order.investigations_advised === 'string'
        ? JSON.parse(order.investigations_advised)
        : order.investigations_advised;
    } catch {
      inv = { lab: [] };
    }

    // Decompose prescribed tests into discrete parameters
    const rows = [];
    const patientSex = order.patients?.sex || 'M';

    (inv.lab || []).forEach(prescribedTest => {
      const testStr = typeof prescribedTest === 'string' ? prescribedTest : prescribedTest?.name || '';
      
      // Match against master decomposition
      let matchedParams = masterParams.filter(p => 
        testStr.toLowerCase().includes(p.panel_code.toLowerCase()) ||
        testStr.toLowerCase().includes(p.parameter_name.toLowerCase()) ||
        (testStr.toLowerCase().includes('cbc') && p.panel_code === 'LB012') ||
        (testStr.toLowerCase().includes('kft') && p.panel_code === 'LB123') ||
        (testStr.toLowerCase().includes('lft') && p.panel_code === 'LB124')
      );

      if (matchedParams.length === 0) {
        // Generic single parameter fallback
        rows.push({
          test_code: 'GEN_LAB',
          parameter_name: testStr || 'Laboratory Test',
          measured_value: '',
          unit: '',
          reference_range: 'Normal',
          is_abnormal: false
        });
      } else {
        matchedParams.forEach(mp => {
          const refRange = patientSex === 'F' ? mp.female_reference_range : mp.male_reference_range;
          rows.push({
            test_code: mp.parameter_code,
            parameter_name: mp.parameter_name,
            measured_value: '',
            unit: mp.unit,
            reference_range: refRange,
            is_abnormal: false
          });
        });
      }
    });

    setParamRows(rows);
  };

  const handleValueChange = (index, val) => {
    const updated = [...paramRows];
    updated[index].measured_value = val;

    // Check for abnormal numeric threshold
    const numVal = parseFloat(val);
    const ref = updated[index].reference_range;
    if (!isNaN(numVal) && ref && ref.includes('-')) {
      const [low, high] = ref.split('-').map(s => parseFloat(s.trim()));
      if (!isNaN(low) && !isNaN(high)) {
        updated[index].is_abnormal = numVal < low || numVal > high;
      }
    }
    setParamRows(updated);
  };

  const handleVerifyAndSave = async () => {
    if (!selectedOrder || paramRows.length === 0) return;

    try {
      // 1. Insert discrete results into public.lab_order_results
      const insertPayloads = paramRows.map(r => ({
        visit_id: selectedOrder.visit_id,
        uhid: selectedOrder.uhid,
        test_code: r.test_code,
        test_name: r.parameter_name,
        measured_value: r.measured_value || 'NORMAL',
        unit: r.unit,
        reference_range: r.reference_range,
        is_abnormal: r.is_abnormal,
        technician_name: technicianName,
        status: 'VERIFIED',
        verified_at: new Date().toISOString()
      }));

      await supabase.from('lab_order_results').insert(insertPayloads);

      // 2. Synthesize summary for Doctor Desk
      const summaryText = paramRows
        .map(r => `${r.parameter_name}: ${r.measured_value || 'NORMAL'} ${r.unit} ${r.is_abnormal ? '[CRITICAL/HIGH]' : ''}`)
        .join(' | ');

      await supabase.from('opd_visits').update({
        investigation_findings: `[Verified by Lab]: ${summaryText}`,
        consult_stage: 'REVIEW_READY'
      }).eq('visit_id', selectedOrder.visit_id);

      setStatusMsg(`✓ Parameterized results verified & synced to Doctor Desk for UHID: ${selectedOrder.uhid}`);
      fetchLabQueue();
    } catch (e) {
      alert("Error saving lab parameters: " + e.message);
    }
  };

  const filteredOrders = (orders || []).filter(o => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (o.patients?.name || '').toLowerCase().includes(q) ||
      (o.token_display || '').toLowerCase().includes(q) ||
      (o.uhid || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-2 md:p-4 flex flex-col space-y-3">
      <div className="print:hidden space-y-3">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide text-white">Pathology & Diagnostic Laboratory Workstation</h1>
              <p className="text-[11px] text-slate-400">Parameter Decomposition (CBC, KFT, LFT, Urine) • Bio-Reference Ranges • Red-Flag Outliers</p>
            </div>
          </div>

          <button
            onClick={fetchLabQueue}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Worklist
          </button>
        </div>

        {statusMsg && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs rounded font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {statusMsg}
          </div>
        )}

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Worklist Sidebar */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm h-fit">
            <div className="mb-2.5 flex items-center gap-2 bg-slate-950 border border-slate-800 px-2 py-1.5 rounded">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Worklist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none w-full"
              />
            </div>

            <div className="space-y-1.5 max-h-[75vh] overflow-y-auto">
              {(!filteredOrders || filteredOrders.length === 0) ? (
                <div className="text-center py-10 text-slate-500 text-xs">No pending laboratory orders.</div>
              ) : (
                filteredOrders.map(v => (
                  <div
                    key={v.visit_id}
                    onClick={() => loadOrder(v)}
                    className={`p-2.5 rounded border text-xs cursor-pointer transition ${
                      selectedOrder?.visit_id === v.visit_id
                        ? 'border-emerald-500 bg-emerald-950/50 shadow-xs'
                        : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-emerald-400">{v.token_display || `#${v.opd_number}`}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-semibold">{v.department}</span>
                    </div>
                    <div className="font-bold text-slate-100 mt-1">{v.patients?.name || 'Walk-in Patient'}</div>
                    <div className="text-[11px] text-slate-400 flex justify-between mt-0.5">
                      <span>{v.patients?.age_years || 'N/A'}Y / {v.patients?.sex || 'M'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{v.uhid}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Parameter Decomposition Grid */}
          {selectedOrder ? (
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Banner */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-emerald-400 font-mono">{selectedOrder.token_display || `#${selectedOrder.opd_number}`}</span>
                      <span className="font-bold text-sm text-white">{selectedOrder.patients?.name || 'Patient'}</span>
                      <span className="text-xs text-slate-400">({selectedOrder.patients?.age_years} Y / {selectedOrder.patients?.sex})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      UHID: <span className="font-mono text-slate-300">{selectedOrder.uhid}</span> | Consultant: <span className="text-slate-300 font-semibold">{selectedOrder.consultant_id}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-0.5 bg-slate-800 text-emerald-300 border border-slate-700 rounded font-bold">
                      {selectedOrder.patients?.master_payers?.company_name || 'Self-Pay'}
                    </span>
                  </div>
                </div>

                {/* Parameters Table */}
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-bold">
                      <tr>
                        <th className="p-2.5">Parameter Description</th>
                        <th className="p-2.5 w-44">Observed Value</th>
                        <th className="p-2.5">Unit</th>
                        <th className="p-2.5">Bio Reference Range ({selectedOrder.patients?.sex || 'M'})</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {paramRows.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-slate-800/30 ${row.is_abnormal ? 'bg-red-950/20' : ''}`}>
                          <td className="p-2.5 font-semibold text-slate-200">{row.parameter_name}</td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              placeholder="Value..."
                              value={row.measured_value}
                              onChange={(e) => handleValueChange(idx, e.target.value)}
                              className={`w-full px-2.5 py-1 text-xs bg-slate-950 border rounded font-mono font-bold outline-none ${
                                row.is_abnormal ? 'border-red-500 text-red-300 bg-red-950/40' : 'border-slate-700 text-emerald-300 focus:border-emerald-500'
                              }`}
                            />
                          </td>
                          <td className="p-2.5 font-mono text-slate-400">{row.unit || '-'}</td>
                          <td className="p-2.5 font-mono text-slate-300">{row.reference_range || '-'}</td>
                          <td className="p-2.5 text-center">
                            {row.is_abnormal ? (
                              <span className="px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded text-[10px] font-bold">
                                HIGH / ABNORMAL
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">NORMAL</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <div className="text-xs text-slate-400">
                  Signing Technician: <span className="text-slate-200 font-bold">{technicianName}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleVerifyAndSave}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition"
                  >
                    <Check className="w-4 h-4" /> Verify & Push to Doctor Desk
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded border border-slate-700 transition"
                  >
                    <Printer className="w-4 h-4" /> Print NABL Report
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-20 text-center text-slate-400 text-sm">
              Select a requisition from the left worklist to enter diagnostic findings.
            </div>
          )}
        </div>
      </div>

      {/* Printable NABL Slip */}
      {selectedOrder && (
        <div className="hidden print:block font-sans text-black p-8 bg-white" style={{ minHeight: '297mm' }}>
          <div className="text-center pb-3 border-b-2 border-black mb-4">
            <h1 className="text-xl font-black uppercase">GURU NANAK HOSPITAL</h1>
            <p className="text-xs text-neutral-600">Department of Pathology & Laboratory Medicine • NABL Reference Standards</p>
            <span className="inline-block mt-1 px-3 py-0.5 text-[10px] font-bold bg-neutral-100 border border-black uppercase">
              CERTIFIED LABORATORY INVESTIGATION REPORT
            </span>
          </div>

          <div className="border-b border-black pb-2 mb-4 text-xs flex justify-between">
            <div>
              <div>UHID: <span className="font-mono font-bold">{selectedOrder.uhid}</span></div>
              <div className="font-bold text-sm mt-0.5">{selectedOrder.patients?.name} ({selectedOrder.patients?.age_years} Y / {selectedOrder.patients?.sex})</div>
              <div>Ref Consultant: {selectedOrder.consultant_id}</div>
            </div>
            <div className="text-right">
              <div>Sample Date: {new Date().toLocaleDateString('en-IN')}</div>
              <div>Category: <span className="font-bold">{selectedOrder.patients?.master_payers?.company_name || 'Self-Pay'}</span></div>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-black font-bold uppercase text-[10px]">
                <th className="py-2">Test / Parameter</th>
                <th className="py-2">Result</th>
                <th className="py-2">Unit</th>
                <th className="py-2">Reference Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300">
              {paramRows.map((r, idx) => (
                <tr key={idx} className={r.is_abnormal ? 'font-bold' : ''}>
                  <td className="py-2">{r.parameter_name}</td>
                  <td className="py-2">{r.measured_value || 'NORMAL'} {r.is_abnormal ? '*' : ''}</td>
                  <td className="py-2">{r.unit || '-'}</td>
                  <td className="py-2">{r.reference_range || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-xs border-t border-black pt-4 flex justify-between items-end mt-20">
            <p className="text-[10px] text-neutral-500 italic">* Asterisk indicates values outside biological reference intervals.</p>
            <div className="text-right">
              <div className="font-bold border-t border-black pt-1">{technicianName}</div>
              <div className="text-[10px] text-neutral-600">NABL Medical Technologist</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
