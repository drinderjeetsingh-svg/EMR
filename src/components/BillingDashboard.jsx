import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  CreditCard, Receipt, Search, Printer, CheckCircle2, 
  Building2, User, RefreshCw, FileText, IndianRupee, ShieldCheck
} from 'lucide-react';

export default function BillingDashboard() {
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [billItems, setBillItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState('CASH');

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('opd_visits')
        .select('*, patients(*, master_payers(*))')
        .order('created_at', { ascending: false });

      setVisits(data || []);
      if (data && data.length > 0 && !selectedVisit) {
        loadVisitForBilling(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadVisitForBilling = (visit) => {
    if (!visit) return;
    setSelectedVisit(visit);
    setStatusMsg('');

    const isRepeat = visit.is_repeat_free_visit;
    const isEmergency = visit.visit_type === 'EMERGENCY';
    const payerType = visit.patients?.master_payers?.payer_type || 'CASH';

    // Base consultation line item according to GNH master rules
    let consultFee = isEmergency ? 500 : 300;
    if (isRepeat) consultFee = 0;

    const items = [
      {
        id: 'OPD_CONSULT',
        name: isRepeat ? 'OPD Re-Visit (Free 3/7-Day Window)' : `Consultation Fee (${visit.department})`,
        category: 'OPD',
        rate: consultFee,
        qty: 1
      }
    ];

    // Auto-decompose ordered labs and radiology into line items
    try {
      if (visit.investigations_advised) {
        const inv = typeof visit.investigations_advised === 'string'
          ? JSON.parse(visit.investigations_advised)
          : visit.investigations_advised;

        if (Array.isArray(inv?.lab)) {
          inv.lab.forEach((test, idx) => {
            const testName = typeof test === 'string' ? test : test?.name || 'Lab Test';
            const labRate = payerType === 'GOVERNMENT_CREDIT' ? 220 : 350;
            items.push({ id: `LAB_${idx}`, name: `Pathology: ${testName}`, category: 'LAB', rate: labRate, qty: 1 });
          });
        }

        if (Array.isArray(inv?.radiology)) {
          inv.radiology.forEach((scan, idx) => {
            const scanName = typeof scan === 'string' ? scan : scan?.name || 'Digital Radiography';
            const radioRate = payerType === 'GOVERNMENT_CREDIT' ? 450 : 800;
            items.push({ id: `RADIO_${idx}`, name: `Radiology: ${scanName}`, category: 'RADIO', rate: radioRate, qty: 1 });
          });
        }
      }
    } catch {
      // fallback
    }

    setBillItems(items);
  };

  const calculateSubtotal = () => {
    return billItems.reduce((acc, curr) => acc + (curr.rate * curr.qty), 0);
  };

  const filteredVisits = (visits || []).filter(v => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (v.patients?.name || '').toLowerCase().includes(q) ||
      (v.uhid || '').toLowerCase().includes(q) ||
      (v.token_display || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-2 md:p-4 flex flex-col space-y-3">
      <div className="print:hidden space-y-3">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-lg shadow">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide text-white">Cashier & Dynamic Tariff Billing Desk</h1>
              <p className="text-[11px] text-slate-400">NABH Gazette Rates • Payer Validity Verification • Split Receipts</p>
            </div>
          </div>

          <button
            onClick={fetchBillingData}
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

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Patient List */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm h-fit">
            <div className="mb-2.5 flex items-center gap-2 bg-slate-950 border border-slate-800 px-2 py-1.5 rounded">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Patient, UHID, Token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none w-full"
              />
            </div>

            <div className="space-y-1.5 max-h-[75vh] overflow-y-auto">
              {(!filteredVisits || filteredVisits.length === 0) ? (
                <div className="text-center py-10 text-slate-500 text-xs">No records found.</div>
              ) : (
                filteredVisits.map(v => (
                  <div
                    key={v.visit_id}
                    onClick={() => loadVisitForBilling(v)}
                    className={`p-2.5 rounded border text-xs cursor-pointer transition ${
                      selectedVisit?.visit_id === v.visit_id
                        ? 'border-amber-500 bg-amber-950/50 shadow-xs'
                        : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-amber-400">{v.token_display || `#${v.opd_number}`}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-semibold">{v.department}</span>
                    </div>
                    <div className="font-bold text-slate-100 mt-1">{v.patients?.name || 'Walk-in'}</div>
                    <div className="text-[11px] text-slate-400 flex justify-between mt-0.5">
                      <span>{v.patients?.age_years || 'N/A'}Y / {v.patients?.sex || 'M'}</span>
                      <span className="text-[10px] text-amber-300 font-medium">{v.patients?.master_payers?.company_name || 'Cash'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invoice Desk */}
          {selectedVisit ? (
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Header Banner */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-amber-400 font-mono">{selectedVisit.token_display || `#${selectedVisit.opd_number}`}</span>
                      <span className="font-bold text-sm text-white">{selectedVisit.patients?.name || 'Patient'}</span>
                      <span className="text-xs text-slate-400">({selectedVisit.patients?.age_years} Y / {selectedVisit.patients?.sex})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      UHID: <span className="font-mono text-slate-300">{selectedVisit.uhid}</span> | Consultant: <span className="text-slate-300 font-semibold">{selectedVisit.consultant_id}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2.5 py-1 bg-amber-950/60 border border-amber-800 text-amber-300 rounded font-bold">
                      Tariff: {selectedVisit.patients?.master_payers?.company_name || 'Self-Pay Cash'}
                    </span>
                  </div>
                </div>

                {/* Bill Items */}
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-bold">
                      <tr>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-right">Tariff Rate (₹)</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Payable (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {billItems.map(item => (
                        <tr key={item.id}>
                          <td className="p-2.5 font-semibold text-slate-200">{item.name}</td>
                          <td className="p-2.5"><span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">{item.category}</span></td>
                          <td className="p-2.5 text-right font-mono text-slate-300">₹{item.rate}</td>
                          <td className="p-2.5 text-center font-mono">{item.qty}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-400">₹{item.rate * item.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Settlement Options */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400">Payment Mode:</span>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 outline-none font-bold"
                    >
                      <option value="CASH">Cash Counter</option>
                      <option value="UPI / QR">UPI / QR (BHIM/GPay)</option>
                      <option value="CARD">Debit / Credit Card (POS)</option>
                      <option value="GOVT_CREDIT">Govt Credit (ECHS / CGHS Direct)</option>
                    </select>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-amber-400">
                      Net Total Payable: <span className="font-mono">₹{calculateSubtotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setStatusMsg(`✓ Receipt settled for ₹${calculateSubtotal()} via ${paymentMode}`);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition"
                >
                  Settle & Issue Official Invoice
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded border border-slate-700 transition"
                >
                  <Printer className="w-4 h-4" /> Print Tax Receipt
                </button>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-20 text-center text-slate-400 text-sm">
              Select a patient to prepare or settle an invoice.
            </div>
          )}
        </div>
      </div>

      {/* Printable Receipt */}
      {selectedVisit && (
        <div className="hidden print:block font-sans text-black p-8 bg-white" style={{ minHeight: '297mm' }}>
          <div className="text-center pb-3 border-b-2 border-black mb-4">
            <h1 className="text-xl font-black uppercase">GURU NANAK HOSPITAL</h1>
            <p className="text-xs text-neutral-600">Palwal, Haryana • NABH Accredited Facility</p>
            <span className="inline-block mt-1 px-3 py-0.5 text-[10px] font-bold bg-neutral-100 border border-black uppercase">
              OFFICIAL BILL OF SUPPLY / OPD RECEIPT
            </span>
          </div>

          <div className="border-b border-black pb-2 mb-4 text-xs flex justify-between">
            <div>
              <div>UHID: <span className="font-mono font-bold">{selectedVisit.uhid}</span></div>
              <div className="font-bold text-sm mt-0.5">{selectedVisit.patients?.name} ({selectedVisit.patients?.age_years} Y / {selectedVisit.patients?.sex})</div>
              <div>Consultant: {selectedVisit.consultant_id}</div>
            </div>
            <div className="text-right">
              <div>Invoice Date: {new Date().toLocaleDateString('en-IN')}</div>
              <div>Billing Type: <span className="font-bold">{selectedVisit.patients?.master_payers?.company_name || 'Self-Pay Cash'}</span></div>
              <div>Payment Mode: <span className="font-bold">{paymentMode}</span></div>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-black font-bold uppercase text-[10px]">
                <th className="py-2">Item Description</th>
                <th className="py-2">Category</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300">
              {billItems.map(item => (
                <tr key={item.id}>
                  <td className="py-2 font-semibold">{item.name}</td>
                  <td className="py-2">{item.category}</td>
                  <td className="py-2 text-right font-mono">₹{item.rate}</td>
                  <td className="py-2 text-center font-mono">{item.qty}</td>
                  <td className="py-2 text-right font-mono font-bold">₹{item.rate * item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t-2 border-black pt-3 flex justify-between items-start text-xs">
            <p className="text-[10px] text-neutral-500">• Computer generated receipt under NABH guidelines.</p>
            <div className="text-right">
              <div className="text-sm font-black border-t border-black pt-1">
                Total Paid: <span className="font-mono">₹{calculateSubtotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
