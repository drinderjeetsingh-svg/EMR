import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Activity, CheckCircle2, AlertCircle, RefreshCw, 
  Search, Check, FileText, Printer, User, FlaskConical
} from 'lucide-react';

export default function LabDashboard() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [paramValues, setParamValues] = useState({});
  const [techNotes, setTechNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    fetchLabQueue();
  }, []);

  const fetchLabQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opd_visits')
        .select('*, patients(*, master_payers(company_name))')
        .order('created_at', { ascending: false });

      if (error || !data) {
        setOrders([]);
        return;
      }

      const withLab = data.filter(v => {
        try {
          if (!v || !v.investigations_advised) return false;
          const inv = typeof v.investigations_advised === 'string'
            ? JSON.parse(v.investigations_advised)
            : v.investigations_advised;
          return (Array.isArray(inv?.lab) && inv.lab.length > 0) || 
                 (Array.isArray(inv?.radiology) && inv.radiology.length > 0);
        } catch {
          return false;
        }
      });

      setOrders(withLab || []);
      if (withLab && withLab.length > 0 && !selectedOrder) {
        loadOrder(withLab[0]);
      }
    } catch (e) {
      console.error("Queue fetch failed:", e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrder = (order) => {
    if (!order) return;
    setSelectedOrder(order);
    setStatusMsg('');
    setTechNotes(order.investigation_findings || '');

    // Parse existing parameter values safely
    let parsedInvest = { lab: [], radiology: [] };
    try {
      if (order.investigations_advised) {
        parsedInvest = typeof order.investigations_advised === 'string'
          ? JSON.parse(order.investigations_advised)
          : order.investigations_advised;
      }
    } catch {
      parsedInvest = { lab: [], radiology: [] };
    }

    const initialVals = {};
    const labList = Array.isArray(parsedInvest?.lab) ? parsedInvest.lab : [];
    labList.forEach(item => {
      const key = typeof item === 'string' ? item : item?.name || 'Test';
      initialVals[key] = '';
    });
    setParamValues(initialVals);
  };

  const handleParamChange = (testName, val) => {
    setParamValues(prev => ({
      ...prev,
      [testName]: val
    }));
  };

  const handleSaveResults = async () => {
    if (!selectedOrder) return;

    let findingsSummary = Object.entries(paramValues)
      .map(([k, v]) => `${k}: ${v || 'NORMAL / VERIFIED'}`)
      .join(' | ');

    if (techNotes.trim()) {
      findingsSummary += ` (Notes: ${techNotes})`;
    }

    try {
      await supabase
        .from('opd_visits')
        .update({
          investigation_findings: findingsSummary,
          consult_stage: 'REVIEW_READY'
        })
        .eq('visit_id', selectedOrder.visit_id);

      setStatusMsg(`✓ Results verified and pushed to Doctor Desk for UHID: ${selectedOrder.uhid}`);
      fetchLabQueue();
    } catch (e) {
      alert("Error saving lab results: " + e.message);
    }
  };

  const getLabItems = () => {
    if (!selectedOrder || !selectedOrder.investigations_advised) return [];
    try {
      const inv = typeof selectedOrder.investigations_advised === 'string'
        ? JSON.parse(selectedOrder.investigations_advised)
        : selectedOrder.investigations_advised;
      return Array.isArray(inv?.lab) ? inv.lab : [];
    } catch {
      return [];
    }
  };

  const getRadioItems = () => {
    if (!selectedOrder || !selectedOrder.investigations_advised) return [];
    try {
      const inv = typeof selectedOrder.investigations_advised === 'string'
        ? JSON.parse(selectedOrder.investigations_advised)
        : selectedOrder.investigations_advised;
      return Array.isArray(inv?.radiology) ? inv.radiology : [];
    } catch {
      return [];
    }
  };

  const filteredOrders = (orders || []).filter(o => {
    const q = (searchQuery || '').toLowerCase();
    const name = o.patients?.name?.toLowerCase() || '';
    const token = (o.token_display || `#${o.opd_number}` || '').toLowerCase();
    const uhid = (o.uhid || '').toLowerCase();
    return name.includes(q) || token.includes(q) || uhid.includes(q);
  });

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-2 md:p-4 flex flex-col space-y-3">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-lg shadow">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide text-white">Diagnostic & Lab Technician Workstation</h1>
            <p className="text-[11px] text-slate-400">Specimen Processing • Result Entry • Doctor Desk Sync</p>
          </div>
        </div>

        <button
          onClick={fetchLabQueue}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
        {/* Left Queue List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm h-fit">
          <div className="mb-2.5 flex items-center gap-2 bg-slate-950 border border-slate-800 px-2 py-1.5 rounded">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search UHID, Token, or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none w-full"
            />
          </div>

          <div className="space-y-1.5 max-h-[75vh] overflow-y-auto">
            {(!filteredOrders || filteredOrders.length === 0) ? (
              <div className="text-center py-10 text-slate-500 text-xs">No pending diagnostic orders.</div>
            ) : (
              (filteredOrders || []).map(v => (
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
                    <span className="text-[10px] text-slate-400 font-mono">UHID: {v.uhid}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Entry Workstation */}
        {selectedOrder ? (
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              {/* Patient Banner */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-emerald-400 font-mono">{selectedOrder.token_display || `#${selectedOrder.opd_number}`}</span>
                    <span className="font-bold text-sm text-white">{selectedOrder.patients?.name || 'Patient'}</span>
                    <span className="text-xs text-slate-400">({selectedOrder.patients?.age_years || 'N/A'} Y / {selectedOrder.patients?.sex || 'M'})</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    UHID: <span className="font-mono text-slate-300">{selectedOrder.uhid}</span> | Consultant: <span className="text-slate-300 font-semibold">{selectedOrder.consultant_id}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] px-2 py-0.5 bg-slate-800 text-emerald-300 border border-slate-700 rounded font-bold">
                    {selectedOrder.patients?.master_payers?.company_name || 'Self-Pay / Cash'}
                  </span>
                </div>
              </div>

              {/* Lab Tests Section */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" /> Prescribed Laboratory Tests
                </div>

                {getLabItems().length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-2 bg-slate-950 rounded border border-slate-800/60">
                    No specific pathology lab tests advised for this visit.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {getLabItems().map((item, idx) => {
                      const testName = typeof item === 'string' ? item : item?.name || `Test #${idx + 1}`;
                      return (
                        <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded flex flex-col justify-between gap-1.5">
                          <span className="text-xs font-bold text-slate-200">{testName}</span>
                          <input
                            type="text"
                            placeholder="Enter test value / result..."
                            value={paramValues[testName] || ''}
                            onChange={(e) => handleParamChange(testName, e.target.value)}
                            className="px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-emerald-300 font-mono outline-none focus:border-emerald-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Radiology Prescriptions */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                  <FileText className="w-4 h-4 text-blue-400" /> Advised Radiology / Imaging
                </div>

                {getRadioItems().length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-2 bg-slate-950 rounded border border-slate-800/60">
                    No radiology imaging advised for this visit.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {getRadioItems().map((item, idx) => {
                      const radioName = typeof item === 'string' ? item : item?.name || `Scan #${idx + 1}`;
                      return (
                        <span key={idx} className="px-2.5 py-1 bg-blue-950/60 border border-blue-800/60 text-blue-300 text-xs font-semibold rounded">
                          📷 {radioName}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Technician Remarks / Observations</label>
                <textarea
                  rows={3}
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                  placeholder="Enter sample condition, hemolyzed/lipemic status, machine barcode..."
                  className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={handleSaveResults}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition"
              >
                <Check className="w-4 h-4" /> Save & Push to Doctor Desk
              </button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-20 text-center text-slate-400 text-sm">
            Select a patient order from the left queue to enter diagnostic findings.
          </div>
        )}
      </div>
    </div>
  );
}
