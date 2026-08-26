import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  CreditCard, Receipt, Search, Printer, CheckCircle2, 
  Building2, User, RefreshCw, FileText, IndianRupee, ShieldCheck
} from 'lucide-react';

export default function BillingDashboard() {
  const [visits, setVisits] = useState([]);
  const [payers, setPayers] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Bill items state
  const [billItems, setBillItems] = useState([
    { id: 1, name: 'Consultation Fee (Dr. Inderjit Singh)', category: 'OPD', rate: 800, qty: 1, discount: 0 }
  ]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemRate, setNewItemRate] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('LAB');
  const [paymentMode, setPaymentMode] = useState('CASH');

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase
        .from('opd_visits')
        .select('*, patients(*, master_payers(*))')
        .order('created_at', { ascending: false });
      
      const { data: pData } = await supabase
        .from('master_payers')
        .select('*')
        .order('company_name');

      setVisits(vData || []);
      setPayers(pData || []);
      if (vData && vData.length > 0 && !selectedVisit) {
        loadVisitForBilling(vData[0]);
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

    // Generate auto bill items based on advised tests
    const items = [
      { id: Date.now(), name: `OPD Consultation - ${visit.department}`, category: 'OPD', rate: 800, qty: 1, discount: 0 }
    ];

    try {
      if (visit.investigations_advised) {
        const inv = typeof visit.investigations_advised === 'string'
          ? JSON.parse(visit.investigations_advised)
          : visit.investigations_advised;

        if (Array.isArray(inv?.lab)) {
          inv.lab.forEach((item, idx) => {
            const name = typeof item === 'string' ? item : item?.name || 'Lab Test';
            items.push({ id: Date.now() + idx + 10, name: `Pathology: ${name}`, category: 'LAB', rate: 450, qty: 1, discount: 0 });
          });
        }

        if (Array.isArray(inv?.radiology)) {
          inv.radiology.forEach((item, idx) => {
            const name = typeof item === 'string' ? item : item?.name || 'X-Ray / Scan';
            items.push({ id: Date.now() + idx + 50, name: `Radiology: ${name}`, category: 'RADIO', rate: 900, qty: 1, discount: 0 });
          });
        }
      }
    } catch {
      // fallback
    }

    setBillItems(items);
  };

  const addItemToBill = (e) => {
    e.preventDefault();
    if (!newItemName || !newItemRate) return;
    setBillItems([
      ...billItems,
      {
        id: Date.now(),
        name: newItemName,
        category: newItemCategory,
        rate: parseFloat(newItemRate) || 0,
        qty: 1,
        discount: 0
      }
    ]);
    setNewItemName('');
    setNewItemRate('');
  };

  const removeItem = (id) => {
    setBillItems(billItems.filter(i => i.id !== id));
  };

  const calculateSubtotal = () => {
    return billItems.reduce((acc, curr) => acc + (curr.rate * curr.qty), 0);
  };

  const getTpaDiscountPct = () => {
    return selectedVisit?.patients?.master_payers?.discount_percentage || 0;
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const discountAmount = (sub * getTpaDiscountPct()) / 100;
    return sub - discountAmount;
  };

  const filteredVisits = (visits || []).filter(v => {
    const q = (searchQuery || '').toLowerCase();
    const name = v.patients?.name?.toLowerCase() || '';
    const uhid = (v.uhid || '').toLowerCase();
    const token = (v.token_display || `#${v.opd_number}` || '').toLowerCase();
    return name.includes(q) || uhid.includes(q) || token.includes(q);
  });

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-2 md:p-4 flex flex-col space-y-3">
      <div className="print:hidden space-y-3">
        {/* Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-lg shadow">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide text-white">Cashier & Billing Desk</h1>
              <p className="text-[11px] text-slate-400">Invoicing • TPA Tariffs • OPD/IPD Settlement • Receipt Printing</p>
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

        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Patient Search & Queue */}
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

          {/* Invoice Builder */}
          {selectedVisit ? (
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Header Banner */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-amber-400 font-mono">{selectedVisit.token_display || `#${selectedVisit.opd_number}`}</span>
                      <span className="font-bold text-sm text-white">{selectedVisit.patients?.name || 'Patient'}</span>
                      <span className="text-xs text-slate-400">({selectedVisit.patients?.age_years || 'N/A'} Y / {selectedVisit.patients?.sex || 'M'})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      UHID: <span className="font-mono text-slate-300">{selectedVisit.uhid}</span> | Consultant: <span className="text-slate-300 font-semibold">{selectedVisit.consultant_id}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2.5 py-1 bg-amber-950/60 border border-amber-800 text-amber-300 rounded font-bold">
                      Tariff: {selectedVisit.patients?.master_payers?.company_name || 'Self-Pay / General Cash'}
                    </span>
                  </div>
                </div>

                {/* Bill Line Items Table */}
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-bold">
                      <tr>
                        <th className="p-2.5">Service / Item Description</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-right">Rate (₹)</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Amount (₹)</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {billItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-800/30">
                          <td className="p-2.5 font-semibold text-slate-200">{item.name}</td>
                          <td className="p-2.5"><span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">{item.category}</span></td>
                          <td className="p-2.5 text-right font-mono text-slate-300">₹{item.rate}</td>
                          <td className="p-2.5 text-center font-mono">{item.qty}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-400">₹{item.rate * item.qty}</td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-red-400 hover:text-red-300 text-[11px] font-bold px-1.5 py-0.5 rounded hover:bg-red-950"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add Item Form */}
                <form onSubmit={addItemToBill} className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="md:col-span-5">
                    <input
                      type="text"
                      placeholder="Add procedure, dressing, medicine, or test..."
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 outline-none"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 outline-none"
                    >
                      <option value="OPD">OPD Services</option>
                      <option value="LAB">Pathology Lab</option>
                      <option value="RADIO">Radiology Imaging</option>
                      <option value="PROC">Procedure / OT</option>
                      <option value="PHARM">Pharmacy</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      placeholder="Rate ₹"
                      value={newItemRate}
                      onChange={(e) => setNewItemRate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs transition"
                    >
                      + Add
                    </button>
                  </div>
                </form>

                {/* Totals Calculation */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400">Payment Mode:</span>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 outline-none font-bold"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI / QR">UPI / QR (PhonePe / GPay)</option>
                      <option value="CARD">Debit / Credit Card (POS)</option>
                      <option value="TPA / CORPORATE">Corporate / TPA Direct</option>
                    </select>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="text-slate-400 text-xs">Subtotal: <span className="font-mono text-slate-200 font-bold">₹{calculateSubtotal()}</span></div>
                    {getTpaDiscountPct() > 0 && (
                      <div className="text-emerald-400 text-xs">
                        Payer Contract Discount ({getTpaDiscountPct()}%): <span className="font-mono font-bold">-₹{((calculateSubtotal() * getTpaDiscountPct()) / 100).toFixed(0)}</span>
                      </div>
                    )}
                    <div className="text-base font-black text-amber-400">
                      Net Total Payable: <span className="font-mono">₹{calculateTotal().toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setStatusMsg(`✓ Receipt issued for ₹${calculateTotal().toFixed(0)} via ${paymentMode}`);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition"
                >
                  Settle & Issue Invoice
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
              Select a patient from the list to prepare or settle an invoice.
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE TAX RECEIPT */}
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
            <div className="space-y-1 text-[10px] text-neutral-500">
              <p>• Computer generated receipt. No physical signature required.</p>
              <p>• All fees are non-refundable under hospital policy.</p>
            </div>
            <div className="text-right space-y-1">
              <div>Subtotal: <span className="font-mono font-bold">₹{calculateSubtotal()}</span></div>
              {getTpaDiscountPct() > 0 && (
                <div>Discount ({getTpaDiscountPct()}%): <span className="font-mono">-₹{((calculateSubtotal() * getTpaDiscountPct()) / 100).toFixed(0)}</span></div>
              )}
              <div className="text-sm font-black border-t border-black pt-1">
                Total Paid: <span className="font-mono">₹{calculateTotal().toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
