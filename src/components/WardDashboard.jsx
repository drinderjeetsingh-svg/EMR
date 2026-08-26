import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Bed, Users, Activity, Plus, RefreshCw, 
  CheckCircle2, HeartPulse, Clock, FileText
} from 'lucide-react';

export default function WardDashboard() {
  const [beds, setBeds] = useState([
    { bedNo: 'ICU-01', type: 'ICU Ventilator', patientName: 'Rajesh Kumar', uhid: 'GNH-2026-1042', age: 62, diagnosis: 'Post-Op TKR Right Knee', doctor: 'Dr. Inderjit Singh', status: 'OCCUPIED' },
    { bedNo: 'ICU-02', type: 'ICU Stepdown', patientName: '', uhid: '', age: '', diagnosis: '', doctor: '', status: 'AVAILABLE' },
    { bedNo: 'GEN-101', type: 'General Male', patientName: 'Amit Sharma', uhid: 'GNH-2026-3819', age: 38, diagnosis: 'Distal Radius Colles Fracture', doctor: 'Dr. Inderjit Singh', status: 'OCCUPIED' },
    { bedNo: 'GEN-102', type: 'General Male', patientName: '', uhid: '', age: '', diagnosis: '', doctor: '', status: 'AVAILABLE' },
    { bedNo: 'PVT-201', type: 'Deluxe Private', patientName: 'Sunita Devi', uhid: 'GNH-2026-8821', age: 54, diagnosis: 'Bilateral OA Knee Grade IV', doctor: 'Dr. Inderjit Singh', status: 'OCCUPIED' },
    { bedNo: 'PVT-202', type: 'Deluxe Private', patientName: '', uhid: '', age: '', diagnosis: '', doctor: '', status: 'AVAILABLE' }
  ]);

  const [selectedBed, setSelectedBed] = useState(beds[0]);
  const [nurseNotes, setNurseNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const occupiedCount = beds.filter(b => b.status === 'OCCUPIED').length;
  const availableCount = beds.length - occupiedCount;

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-2 md:p-4 flex flex-col space-y-3">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600 text-white rounded-lg shadow">
            <Bed className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide text-white">IPD Ward & Bed Occupancy Matrix</h1>
            <p className="text-[11px] text-slate-400">Inpatient Monitoring • ICU / General Bed Allocation • Nursing Rounds</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-purple-950/60 border border-purple-800 text-purple-300 rounded font-bold">
            Occupied: {occupiedCount}
          </span>
          <span className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded font-bold">
            Available: {availableCount}
          </span>
        </div>
      </div>

      {statusMsg && (
        <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs rounded font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Main Grid: Bed Matrix (Left) | Nursing Desk (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {beds.map(b => (
            <div
              key={b.bedNo}
              onClick={() => setSelectedBed(b)}
              className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                selectedBed?.bedNo === b.bedNo
                  ? 'border-purple-500 bg-purple-950/40 shadow-md'
                  : b.status === 'OCCUPIED'
                  ? 'border-slate-800 bg-slate-900/90 hover:bg-slate-800/60'
                  : 'border-dashed border-slate-800 bg-slate-950/50 hover:bg-slate-900/40 opacity-75'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono font-black text-xs text-white bg-slate-800 px-2 py-0.5 rounded">{b.bedNo}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    b.status === 'OCCUPIED' ? 'bg-red-950/80 text-red-300 border border-red-800' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  }`}>
                    {b.status}
                  </span>
                </div>
                <div className="text-[11px] text-purple-400 font-semibold">{b.type}</div>

                {b.status === 'OCCUPIED' ? (
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="font-bold text-white text-sm">{b.patientName}</div>
                    <div className="text-[11px] text-slate-400">UHID: <span className="font-mono text-slate-300">{b.uhid}</span></div>
                    <div className="text-[11px] text-slate-300 font-medium">Dx: {b.diagnosis}</div>
                  </div>
                ) : (
                  <div className="mt-6 text-center text-xs text-slate-500 font-bold py-2">Bed Ready for Admission</div>
                )}
              </div>

              {b.status === 'OCCUPIED' && (
                <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                  <span>Consultant: {b.doctor}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Selected Bed / Patient Detail Panel */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase text-white flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-purple-400" /> Bed Details ({selectedBed?.bedNo})
              </span>
              <span className="text-xs font-mono text-purple-300">{selectedBed?.type}</span>
            </div>

            {selectedBed?.status === 'OCCUPIED' ? (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                  <div className="font-bold text-sm text-white">{selectedBed.patientName}</div>
                  <div className="text-slate-400">UHID: <span className="font-mono text-slate-200">{selectedBed.uhid}</span> ({selectedBed.age} Y)</div>
                  <div className="text-slate-400">Primary Diagnosis: <span className="text-purple-300 font-semibold">{selectedBed.diagnosis}</span></div>
                  <div className="text-slate-400">Attending: <span className="text-slate-200">{selectedBed.doctor}</span></div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Add Nursing Round Notes / Vitals</label>
                  <textarea
                    rows={4}
                    value={nurseNotes}
                    onChange={(e) => setNurseNotes(e.target.value)}
                    placeholder="BP: 120/80, SpO2: 98%, IV fluid running at 75ml/hr, dressing clean and intact..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                This bed is currently vacant. Use Front Desk / Admission module to admit an inpatient.
              </div>
            )}
          </div>

          {selectedBed?.status === 'OCCUPIED' && (
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setStatusMsg(`✓ Nursing chart updated for ${selectedBed.patientName} (${selectedBed.bedNo})`);
                  setNurseNotes('');
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded shadow transition"
              >
                Save Inpatient Chart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
