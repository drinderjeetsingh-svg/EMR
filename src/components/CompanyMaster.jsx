import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Copy, Plus, CheckCircle2 } from 'lucide-react';

export default function CompanyMaster() {
  const [payers, setPayers] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [payerType, setPayerType] = useState('TPA');
  
  const [sourceCode, setSourceCode] = useState('ECHS');
  const [targetCode, setTargetCode] = useState('');
  const [markup, setMarkup] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPayers();
  }, []);

  const fetchPayers = async () => {
    const { data } = await supabase.from('master_payers').select('*').order('created_at', { ascending: true });
    if (data) setPayers(data);
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    const { error } = await supabase.from('master_payers').insert({
      company_name: companyName.trim(),
      code: companyCode.trim().toUpperCase(),
      payer_type: payerType,
      is_nabh_applicable: true
    });

    if (!error) {
      setStatusMsg(`Created company ${companyName}. Now clone a rate sheet below.`);
      setCompanyName('');
      setCompanyCode('');
      fetchPayers();
    } else {
      alert(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleCloneTariff = async (e) => {
    e.preventDefault();
    if (!targetCode) {
      alert('Please select a target company.');
      return;
    }
    setLoading(true);
    setStatusMsg('');

    const { error } = await supabase.rpc('clone_tariff_rate_sheet', {
      source_payer_code: sourceCode,
      target_payer_code: targetCode,
      markup_percentage: parseFloat(markup || 0)
    });

    if (!error) {
      setStatusMsg(`Successfully cloned rate sheet from ${sourceCode} to ${targetCode} with ${markup}% markup!`);
    } else {
      alert(`Cloning failed: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="mb-6 pb-3 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" /> Company Master & Tariff Rate Manager
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Manage Credit Companies, TPAs & Clone Gazette Rate Sheets</p>
      </div>

      {statusMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-blue-600" /> Add New Payer / Credit Company
          </h2>

          <form onSubmit={handleCreateCompany} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Max Bupa Health Insurance"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Company Code *</label>
                <input
                  type="text"
                  required
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  placeholder="e.g. MAX_BUPA"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded uppercase outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category Type</label>
                <select
                  value={payerType}
                  onChange={(e) => setPayerType(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white outline-none"
                >
                  <option value="TPA">Private TPA / Insurance</option>
                  <option value="GOVERNMENT_CREDIT">Govt Credit (ECHS/CGHS)</option>
                  <option value="CORPORATE">Corporate Panel</option>
                  <option value="CASH">Cash / Self-Pay</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded shadow"
            >
              Create Company
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Copy className="w-4 h-4 text-purple-600" /> Clone / Copy Rate Sheet
          </h2>

          <form onSubmit={handleCloneTariff} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Source Rate Sheet *</label>
              <select
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-semibold outline-none"
              >
                <option value="ECHS">ECHS Tier-III (NABH Rates Master)</option>
                <option value="SELF_PAY">Self-Pay Cash Tariff</option>
                {payers.filter(p => p.code !== 'ECHS' && p.code !== 'SELF_PAY').map(p => (
                  <option key={p.id} value={p.code}>{p.company_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Target Company *</label>
              <select
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-semibold outline-none"
              >
                <option value="">-- Select Target Company --</option>
                {payers.map(p => (
                  <option key={p.id} value={p.code}>{p.company_name} ({p.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Markup / Discount (%)</label>
              <input
                type="number"
                step="1"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                placeholder="0 (or 10 for +10%, -15 for -15%)"
                className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase rounded shadow"
            >
              Clone & Apply Rates
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
