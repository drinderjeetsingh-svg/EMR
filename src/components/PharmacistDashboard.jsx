import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Package, PlusCircle, UploadCloud, AlertTriangle, CheckCircle2, 
  Trash2, Edit3, Shield, User, Search, RefreshCw, FileText, Clock
} from 'lucide-react';

export default function PharmacistDashboard() {
  const [userRole, setUserRole] = useState('pharma_admin'); // 'pharma_admin' or 'junior_pharmacist'
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'grn', 'bulk_csv', 'indents'
  
  // Stock State
  const [stockList, setStockList] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // GRN Form State
  const [medicineQuery, setMedicineQuery] = useState('');
  const [searchedMedicines, setSearchedMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [mrp, setMrp] = useState('');
  const [quantity, setQuantity] = useState('');
  const [storeLocation, setStoreLocation] = useState('Main Pharmacy');
  const [grnLoading, setGrnLoading] = useState(false);
  const [grnSuccessMsg, setGrnSuccessMsg] = useState('');
  const [grnErrorMsg, setGrnErrorMsg] = useState('');

  // Bulk CSV Upload State
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvStatusMsg, setCsvStatusMsg] = useState('');

  // Ward Indents State
  const [indents, setIndents] = useState([]);
  const [loadingIndents, setLoadingIndents] = useState(false);

  // Edit Batch Modal State (Pharma Admin Only)
  const [editingBatch, setEditingBatch] = useState(null);

  useEffect(() => {
    fetchStock();
    fetchIndents();
  }, []);

  // 1. Fetch Real-time Stock with Master Medicine details
  const fetchStock = async () => {
    setLoadingStock(true);
    const { data, error } = await supabase
      .from('pharmacy_batches')
      .select(`
        id,
        medicine_id,
        batch_number,
        mfg_date,
        expiry_date,
        mrp,
        purchase_rate,
        current_stock,
        store_location,
        master_medicines (
          brand_name,
          generic_composition,
          dosage_form,
          manufacturer
        )
      `)
      .order('expiry_date', { ascending: true });

    if (!error && data) {
      setStockList(data);
    }
    setLoadingStock(false);
  };

  // 2. Fetch Pending Ward Indents
  const fetchIndents = async () => {
    setLoadingIndents(true);
    const { data, error } = await supabase
      .from('ward_indents')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setIndents(data);
    }
    setLoadingIndents(false);
  };

  // Medicine Search in GRN Tab
  const handleSearchMedicines = async (term) => {
    setMedicineQuery(term);
    if (term.trim().length < 2) {
      setSearchedMedicines([]);
      return;
    }
    const { data } = await supabase
      .from('master_medicines')
      .select('id, brand_name, generic_composition, dosage_form, manufacturer')
      .ilike('brand_name', `%${term.trim()}%`)
      .limit(10);
    
    setSearchedMedicines(data || []);
  };

  // 3. Submit Single GRN
  const handleGRNSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMedicine) {
      setGrnErrorMsg('Please select a valid medicine from the master catalog.');
      return;
    }
    setGrnLoading(true);
    setGrnSuccessMsg('');
    setGrnErrorMsg('');

    try {
      // Upsert batch
      const { data: batchData, error: batchError } = await supabase
        .from('pharmacy_batches')
        .upsert({
          medicine_id: selectedMedicine.id,
          batch_number: batchNumber.trim().toUpperCase(),
          mfg_date: mfgDate || null,
          expiry_date: expiryDate,
          mrp: parseFloat(mrp) || 0,
          purchase_rate: parseFloat(purchaseRate) || 0,
          current_stock: parseInt(quantity, 10),
          store_location: storeLocation
        }, { onConflict: 'medicine_id,batch_number,store_location' })
        .select()
        .single();

      if (batchError) throw batchError;

      // Log in Stock Ledger Audit
      await supabase.from('pharmacy_stock_ledger').insert({
        batch_id: batchData.id,
        transaction_type: 'PURCHASE_GRN',
        quantity: parseInt(quantity, 10),
        reference_id: `GRN-${Date.now().toString().slice(-6)}`,
        user_role: userRole
      });

      setGrnSuccessMsg(`Successfully inwarded ${quantity} units of ${selectedMedicine.brand_name} (Batch: ${batchNumber})`);
      // Reset form
      setSelectedMedicine(null);
      setMedicineQuery('');
      setBatchNumber('');
      setMfgDate('');
      setExpiryDate('');
      setPurchaseRate('');
      setMrp('');
      setQuantity('');
      fetchStock();
    } catch (err) {
      setGrnErrorMsg(err.message || 'Error processing GRN.');
    } finally {
      setGrnLoading(false);
    }
  };

  // 4. Parse & Upload Bulk CSV
  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = ({ target }) => {
      const text = target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsedRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx];
        });
        return row;
      });
      setCsvPreview(parsedRows.slice(0, 5)); // show first 5 for preview
    };
    reader.readAsText(file);
  };

  const handleBulkCsvUpload = async () => {
    if (!csvFile) return;
    setCsvUploading(true);
    setCsvStatusMsg('Processing invoice rows against master catalog...');

    try {
      const reader = new FileReader();
      reader.onload = async ({ target }) => {
        const text = target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        let successCount = 0;
        let failedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const row = {};
          headers.forEach((h, idx) => { row[h] = values[idx]; });

          const brand = row.brand_name || row.medicine_name || row.name;
          const batch = (row.batch_number || row.batch || `B-${Date.now().toString().slice(-4)}`).toUpperCase();
          const expiry = row.expiry_date || row.expiry || '2028-12-31';
          const qty = parseInt(row.quantity || row.qty || '100', 10);
          const pr = parseFloat(row.purchase_rate || row.rate || '0');
          const mrpVal = parseFloat(row.mrp || '0');

          if (!brand) continue;

          // Find medicine ID
          const { data: medData } = await supabase
            .from('master_medicines')
            .select('id')
            .ilike('brand_name', `%${brand}%`)
            .limit(1)
            .maybeSingle();

          if (medData) {
            const { data: bData } = await supabase.from('pharmacy_batches').upsert({
              medicine_id: medData.id,
              batch_number: batch,
              expiry_date: expiry,
              mrp: mrpVal,
              purchase_rate: pr,
              current_stock: qty,
              store_location: 'Main Pharmacy'
            }, { onConflict: 'medicine_id,batch_number,store_location' }).select().single();

            if (bData) {
              await supabase.from('pharmacy_stock_ledger').insert({
                batch_id: bData.id,
                transaction_type: 'PURCHASE_GRN',
                quantity: qty,
                reference_id: `CSV-INV-${Date.now().toString().slice(-4)}`,
                user_role: userRole
              });
              successCount++;
            }
          } else {
            failedCount++;
          }
        }

        setCsvStatusMsg(`Bulk Ingest Complete: ${successCount} batches created/updated. ${failedCount} unmatched.`);
        setCsvFile(null);
        setCsvPreview([]);
        setCsvUploading(false);
        fetchStock();
      };
      reader.readAsText(csvFile);
    } catch (err) {
      setCsvStatusMsg(`Upload failed: ${err.message}`);
      setCsvUploading(false);
    }
  };

  // 5. Admin Actions: Delete & Edit Batch
  const handleDeleteBatch = async (batchId) => {
    if (userRole !== 'pharma_admin') return;
    if (!window.confirm('Pharma Admin: Are you sure you want to delete this batch? This will reverse current stock.')) return;

    const { error } = await supabase
      .from('pharmacy_batches')
      .delete()
      .eq('id', batchId);

    if (!error) {
      fetchStock();
    } else {
      alert(`Delete failed: ${error.message}`);
    }
  };

  const handleUpdateBatch = async (e) => {
    e.preventDefault();
    if (userRole !== 'pharma_admin' || !editingBatch) return;

    const { error } = await supabase
      .from('pharmacy_batches')
      .update({
        batch_number: editingBatch.batch_number.toUpperCase(),
        expiry_date: editingBatch.expiry_date,
        purchase_rate: parseFloat(editingBatch.purchase_rate),
        mrp: parseFloat(editingBatch.mrp),
        current_stock: parseInt(editingBatch.current_stock, 10),
        store_location: editingBatch.store_location
      })
      .eq('id', editingBatch.id);

    if (!error) {
      await supabase.from('pharmacy_stock_ledger').insert({
        batch_id: editingBatch.id,
        transaction_type: 'STOCK_ADJUSTMENT',
        quantity: parseInt(editingBatch.current_stock, 10),
        reference_id: 'ADMIN-ADJUSTMENT',
        user_role: userRole
      });
      setEditingBatch(null);
      fetchStock();
    } else {
      alert(`Update failed: ${error.message}`);
    }
  };

  // 6. Dispense Ward Indent
  const handleDispenseIndent = async (indent) => {
    const { error } = await supabase
      .from('ward_indents')
      .update({
        status: 'DISPENSED',
        dispensed_by: userRole === 'pharma_admin' ? 'Pharma Admin' : 'Junior Pharmacist',
        dispensed_at: new Date().toISOString()
      })
      .eq('indent_id', indent.indent_id);

    if (!error) {
      fetchIndents();
      fetchStock();
    }
  };

  // Filtered stock list for search
  const filteredStock = stockList.filter(item => {
    const brand = item.master_medicines?.brand_name || '';
    const generic = item.master_medicines?.generic_composition || '';
    const batch = item.batch_number || '';
    const q = searchFilter.toLowerCase();
    return brand.toLowerCase().includes(q) || generic.toLowerCase().includes(q) || batch.toLowerCase().includes(q);
  });

  const isNearExpiry = (expStr) => {
    const exp = new Date(expStr);
    const now = new Date();
    const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 90;
  };

  const isExpired = (expStr) => {
    return new Date(expStr) < new Date();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Top Header & Role Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Guru Nanak Hospital — Pharmacy & Inventory Desk
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">FEFO Ledger • GRN Inward • Ward Indent Pipeline</p>
        </div>

        {/* Role Selector Badge */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Active Role:</span>
          <button
            onClick={() => setUserRole(userRole === 'pharma_admin' ? 'junior_pharmacist' : 'pharma_admin')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition ${
              userRole === 'pharma_admin' 
                ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            {userRole === 'pharma_admin' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-purple-600" /> Pharma Admin (Full Control)
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-emerald-600" /> Junior Pharmacist (Restricted)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-lg px-2">
        <button
          onClick={() => setActiveTab('stock')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'stock'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" /> Live Stock Matrix ({stockList.length})
        </button>
        <button
          onClick={() => setActiveTab('grn')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'grn'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PlusCircle className="w-4 h-4" /> GRN / Stock Inward
        </button>
        <button
          onClick={() => setActiveTab('bulk_csv')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'bulk_csv'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" /> Bulk Invoice Import (CSV)
        </button>
        <button
          onClick={() => setActiveTab('indents')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'indents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" /> Ward Indents ({indents.length})
        </button>
      </div>

      {/* TAB 1: LIVE STOCK MATRIX */}
      {activeTab === 'stock' && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search brand, composition or batch..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-600 outline-none"
              />
            </div>
            <button
              onClick={fetchStock}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStock ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Medicine & Salt</th>
                  <th className="py-2.5 px-3">Form</th>
                  <th className="py-2.5 px-3">Batch No</th>
                  <th className="py-2.5 px-3">Expiry (FEFO)</th>
                  <th className="py-2.5 px-3">Stock Qty</th>
                  <th className="py-2.5 px-3">Pur. Rate</th>
                  <th className="py-2.5 px-3">MRP</th>
                  <th className="py-2.5 px-3">Store</th>
                  {userRole === 'pharma_admin' && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStock.map((batch) => {
                  const expired = isExpired(batch.expiry_date);
                  const nearExp = isNearExpiry(batch.expiry_date);
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {batch.master_medicines?.brand_name || '—'}
                        <div className="text-[10px] text-slate-500 font-normal">
                          {batch.master_medicines?.generic_composition || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{batch.master_medicines?.dosage_form || '—'}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">{batch.batch_number}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          expired 
                            ? 'bg-red-100 text-red-700' 
                            : nearExp 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {new Date(batch.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold font-mono text-blue-700">
                        {batch.current_stock}
                      </td>
                      <td className="py-2.5 px-3 font-mono">₹{parseFloat(batch.purchase_rate).toFixed(2)}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold">₹{parseFloat(batch.mrp).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{batch.store_location}</td>
                      {userRole === 'pharma_admin' && (
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingBatch(batch)}
                              className="p-1 hover:bg-slate-200 text-slate-600 rounded"
                              title="Edit Batch (Admin Only)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBatch(batch.id)}
                              className="p-1 hover:bg-red-100 text-red-600 rounded"
                              title="Delete Batch (Admin Only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan={userRole === 'pharma_admin' ? 9 : 8} className="text-center py-6 text-slate-400">
                      No stock batches found. Process a GRN or upload a CSV invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GRN / STOCK INWARD */}
      {activeTab === 'grn' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm max-w-3xl">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-emerald-600" /> Goods Received Note (GRN) Inward
          </h2>

          {grnSuccessMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {grnSuccessMsg}
            </div>
          )}

          {grnErrorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              {grnErrorMsg}
            </div>
          )}

          <form onSubmit={handleGRNSubmit} className="space-y-4">
            {/* Medicine Lookup */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Select Medicine from Master Catalog *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedMedicine ? `${selectedMedicine.brand_name} (${selectedMedicine.generic_composition})` : medicineQuery}
                  onChange={(e) => {
                    setSelectedMedicine(null);
                    handleSearchMedicines(e.target.value);
                  }}
                  placeholder="Type 2+ letters of brand or salt..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-600 outline-none"
                  required
                />
                {searchedMedicines.length > 0 && !selectedMedicine && (
                  <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-b shadow-lg max-h-48 overflow-y-auto mt-1">
                    {searchedMedicines.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMedicine(m);
                          setMedicineQuery('');
                          setSearchedMedicines([]);
                        }}
                        className="p-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-slate-100"
                      >
                        <div className="font-bold text-slate-800">{m.brand_name}</div>
                        <div className="text-[10px] text-slate-500">{m.generic_composition} • {m.dosage_form}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Batch, Dates & Stock Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Batch Number *</label>
                <input
                  type="text"
                  required
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. BA2049"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded uppercase outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mfg Date</label>
                <input
                  type="date"
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quantity Received *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Units"
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Purchase Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">MRP (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store / Location</label>
                <select
                  value={storeLocation}
                  onChange={(e) => setStoreLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white outline-none"
                >
                  <option value="Main Pharmacy">Main Pharmacy (Ground Floor)</option>
                  <option value="Central Store">Central Bulk Medical Store</option>
                  <option value="OT 1">OT 1 Emergency Cabinet</option>
                  <option value="ICU Crash Cart">ICU Crash Cart</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={grnLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded shadow disabled:opacity-50"
              >
                {grnLoading ? 'Processing Inward...' : 'Submit GRN & Add Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: BULK CSV INVOICE IMPORTER */}
      {activeTab === 'bulk_csv' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm max-w-3xl">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-blue-600" /> Bulk Distributor Invoice Ingestion
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Upload CSV invoices exported from distributor billing systems (e.g. Marg, MediVision). Columns supported: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">brand_name, batch_number, expiry_date, quantity, purchase_rate, mrp</code>.
          </p>

          {csvStatusMsg && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              {csvStatusMsg}
            </div>
          )}

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <UploadCloud className="w-8 h-8 text-slate-400" />
              <span className="text-xs font-bold text-blue-600">Click to browse distributor CSV file</span>
              <span className="text-[11px] text-slate-400">Standard UTF-8 CSV</span>
            </label>
          </div>

          {csvPreview.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Invoice Preview (First 5 Rows):</h3>
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold">
                    <tr>
                      {Object.keys(csvPreview[0]).map((h) => (
                        <th key={h} className="p-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {Object.values(row).map((v, idx) => (
                          <td key={idx} className="p-2">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleBulkCsvUpload}
                  disabled={csvUploading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow disabled:opacity-50"
                >
                  {csvUploading ? 'Ingesting Invoice...' : 'Confirm & Process All Invoice Batches'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WARD INDENTS QUEUE */}
      {activeTab === 'indents' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-purple-600" /> Inpatient (IPD) Ward Medication Indents
            </h2>
            <button
              onClick={fetchIndents}
              className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingIndents ? 'animate-spin' : ''}`} /> Refresh Indents
            </button>
          </div>

          <div className="space-y-3">
            {indents.map((indent) => (
              <div key={indent.indent_id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-purple-900 bg-purple-100 px-2 py-0.5 rounded">
                      {indent.ward_name} — Bed {indent.bed_number || 'N/A'}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-600">IPD #{indent.ipd_no}</span>
                    <span className="text-[11px] text-slate-400">UHID: {indent.uhid}</span>
                  </div>
                  <div className="text-xs text-slate-700 mt-2 font-medium">
                    Requested Items:
                    <ul className="list-disc list-inside mt-0.5 text-slate-600">
                      {(indent.items || []).map((item, idx) => (
                        <li key={idx}>
                          <span className="font-semibold text-slate-800">{item.brand_name}</span> — Qty: {item.requested_qty}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => handleDispenseIndent(indent)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded shadow transition"
                >
                  Dispense & Auto-Deduct (FEFO)
                </button>
              </div>
            ))}

            {indents.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                No pending ward indents in the queue.
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT BATCH MODAL (Pharma Admin Only) */}
      {editingBatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-sm font-bold text-slate-800 uppercase mb-3 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-purple-600" /> Edit Batch (Admin Override)
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-semibold">
              {editingBatch.master_medicines?.brand_name}
            </p>

            <form onSubmit={handleUpdateBatch} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  value={editingBatch.batch_number}
                  onChange={(e) => setEditingBatch({ ...editingBatch, batch_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={editingBatch.expiry_date}
                    onChange={(e) => setEditingBatch({ ...editingBatch, expiry_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={editingBatch.current_stock}
                    onChange={(e) => setEditingBatch({ ...editingBatch, current_stock: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Purchase Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBatch.purchase_rate}
                    onChange={(e) => setEditingBatch({ ...editingBatch, purchase_rate: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBatch.mrp}
                    onChange={(e) => setEditingBatch({ ...editingBatch, mrp: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
