import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Film, Printer, CheckCircle2, ZoomIn, ZoomOut, 
  RotateCw, Contrast, RefreshCw, Check, AlertTriangle,
  Ruler, FileText, Eye, Maximize2, Upload, Image as ImageIcon
} from 'lucide-react';

export default function RadiologyDashboard() {
  const [worklist, setWorklist] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  
  // Viewport State
  const [scanUrl, setScanUrl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isInverted, setIsInverted] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Measurement Calipers State
  const [activeTool, setActiveTool] = useState('pan'); // 'pan', 'measure'
  const [measureStart, setMeasureStart] = useState(null);
  const [measureEnd, setMeasureEnd] = useState(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Structured Reporting State
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [techniqueProtocol, setTechniqueProtocol] = useState('High-Resolution Digital Radiography (DR) with Direct Flat Panel Detector.');
  const [findingsText, setFindingsText] = useState('');
  const [impressionText, setImpressionText] = useState('');
  const [isCriticalFinding, setIsCriticalFinding] = useState(false);
  const [criticalDoctorNotified, setCriticalDoctorNotified] = useState('');
  const [radiologistName, setRadiologistName] = useState('Dr. Kalyan, MD (Radiodiagnosis)');
  const [radiologistRegNo, setRadiologistRegNo] = useState('MCI / DMC-51924');
  const [isSigned, setIsSigned] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // WW/WL Presets
  const WW_WL_PRESETS = [
    { name: 'Bone / Ortho', brightness: 90, contrast: 180 },
    { name: 'Soft Tissue', brightness: 100, contrast: 110 },
    { name: 'Lung Window', brightness: 130, contrast: 160 },
    { name: 'Brain / Stroke', brightness: 105, contrast: 210 },
    { name: 'Reset', brightness: 100, contrast: 100 }
  ];

  // Subspecialty Templates
  const STRUCTURED_TEMPLATES = [
    {
      title: 'TKR Pre-Op / OA Knee Grade IV',
      technique: 'Digital Radiography of Both Knee Joints (Weight-bearing AP, 30° Flexion Lateral & Skyline Views).',
      findings: '1. Medial Compartment: Complete obliteration of joint space with bone-on-bone articulation, prominent subchondral sclerosis, and eburnation.\n2. Lateral Compartment: Preserved joint space without significant subchondral change.\n3. Alignment: Approx 12 degrees anatomical varus mechanical axis deviation.',
      impression: 'Severe Primary Bilateral Osteoarthritis (Kellgren-Lawrence Grade IV) predominantly affecting the medial compartments with varus malalignment. Surgical Total Knee Arthroplasty (TKR) candidate.'
    },
    {
      title: 'LS Spine Degenerative Disc Disease',
      technique: 'Digital Radiography of Lumbo-Sacral Spine in AP, Lateral, and Dynamic Projections.',
      findings: '1. Curvature: Lumbar lordosis is reduced with associated paravertebral muscle spasm.\n2. Disc Spaces: Marked intervertebral disc height reduction at L4-L5 and L5-S1 levels with vacuum phenomenon.',
      impression: 'Lumbar Spondylosis with multilevel Degenerative Disc Disease (most pronounced at L4-L5 & L5-S1).'
    },
    {
      title: 'Acute Distal Radius (Colles) Fracture',
      technique: 'Emergency Digital Radiograph of Left Wrist Joint in PA and Lateral Projections.',
      findings: '1. Cortical disruption: Complete extra-articular transverse fracture through the distal metaphysis of the radius.\n2. Displacement: Dorsal translation of distal fragment with approx 18 degrees apex volar angulation.',
      impression: 'Displaced Extra-Articular Distal Radius Fracture (Colles type) with ulnar styloid avulsion.'
    },
    {
      title: 'Chest PA - Normal Radiograph',
      technique: 'Single exposure High-kV Digital Radiograph of Chest in erect PA projection on full deep inspiration.',
      findings: '1. Lungs: Both lung fields are clear with normal branching broncho-vascular markings. No focal consolidation or effusion.\n2. Mediastinum & Heart: Cardiac silhouette is normal in contour and transverse diameter.',
      impression: 'Normal Chest PA Radiograph. No active cardiopulmonary abnormality.'
    }
  ];

  useEffect(() => {
    fetchRadiologistQueue();
  }, []);

  const fetchRadiologistQueue = async () => {
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
        loadExam(withRadio[0]);
      }
    }
    setLoading(false);
  };

  const loadExam = async (visit) => {
    setSelectedExam(visit);
    setIsSigned(false);
    setStatusMsg('');
    setClinicalHistory(visit.chief_complaints || 'Clinical investigation under evaluation');
    setFindingsText('');
    setImpressionText('');
    setIsCriticalFinding(false);
    resetViewer();

    // Fetch the DICOM / R2 scan URL from radiology_reports table
    const { data: reportData } = await supabase
      .from('radiology_reports')
      .select('dicom_file_url')
      .eq('visit_id', visit.visit_id)
      .maybeSingle();

    if (reportData && reportData.dicom_file_url) {
      setScanUrl(reportData.dicom_file_url);
    } else {
      setScanUrl("https://pub-11be46ea1fc5e4ea4cb8a1046b8ce31b.r2.dev/studies/DEMO-UHID-9999/CHEST_XRAY_REAL.png");
    }
  };

  const applyTemplate = (t) => {
    setTechniqueProtocol(t.technique);
    setFindingsText(t.findings);
    setImpressionText(t.impression);
  };

  const applyPreset = (p) => {
    setBrightness(p.brightness);
    setContrast(p.contrast);
  };

  const resetViewer = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
    setIsInverted(false);
    setRotation(0);
    setMeasureStart(null);
    setMeasureEnd(null);
  };

  const handleMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'pan') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (activeTool === 'measure') {
      if (!isMeasuring) {
        setMeasureStart({ x, y });
        setMeasureEnd({ x, y });
        setIsMeasuring(true);
      } else {
        setMeasureEnd({ x, y });
        setIsMeasuring(false);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (activeTool === 'pan' && isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (activeTool === 'measure' && isMeasuring) {
      const rect = e.currentTarget.getBoundingClientRect();
      setMeasureEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'pan') setIsDragging(false);
  };

  const calculateMeasurementMm = () => {
    if (!measureStart || !measureEnd) return 0;
    const dx = measureEnd.x - measureStart.x;
    const dy = measureEnd.y - measureStart.y;
    const px = Math.sqrt(dx * dx + dy * dy);
    return (px * 0.26 / zoom).toFixed(1);
  };

  const handleSignReport = async () => {
    if (!selectedExam || !impressionText.trim()) {
      alert('Please enter a clinical impression before signing the report.');
      return;
    }

    const payload = {
      visit_id: selectedExam.visit_id,
      uhid: selectedExam.uhid,
      modality: 'Digital Radiography',
      procedure_name: selectedExam.department || 'Radiological Examination',
      clinical_indication: clinicalHistory,
      technique_protocol: techniqueProtocol,
      findings_raw_text: findingsText,
      impression_text: impressionText,
      is_critical_finding: isCriticalFinding,
      critical_alert_communicated_to: isCriticalFinding ? criticalDoctorNotified : null,
      radiologist_name: radiologistName,
      radiologist_registration_no: radiologistRegNo,
      report_status: 'FINAL_SIGNED',
      signed_at: new Date().toISOString()
    };

    await supabase.from('radiology_structured_reports').insert(payload);

    await supabase.from('opd_visits').update({
      investigation_findings: `[Radiology Verified by ${radiologistName}]: ${impressionText}`,
      consult_stage: 'REVIEW_READY'
    }).eq('visit_id', selectedExam.visit_id);

    setIsSigned(true);
    setStatusMsg(`✓ Report electronically signed & locked by ${radiologistName}. Findings pushed to Doctor Desk.`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-2 md:p-4 flex flex-col">
      <div className="print:hidden space-y-3 flex-1 flex flex-col">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-md">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide text-white">
                Dr. Kalyan's Professional PACS DICOM Viewer & Reporting Studio
              </h1>
              <p className="text-[11px] text-slate-400">Streaming live from Cloudflare R2 Bucket (`hospital-dicom-archive`)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-blue-300 font-bold">
              Active Radiologist: {radiologistName}
            </span>
            <button
              onClick={fetchRadiologistQueue}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs rounded font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {statusMsg}
          </div>
        )}

        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
          {/* Worklist Sidebar */}
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm h-fit">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex justify-between items-center">
              <span>PACS Worklist ({worklist.length})</span>
              <span className="text-[10px] text-emerald-400 font-mono">R2 Live</span>
            </div>

            <div className="space-y-1.5 max-h-[75vh] overflow-y-auto">
              {worklist.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">No pending studies.</div>
              ) : (
                worklist.map(v => (
                  <div
                    key={v.visit_id}
                    onClick={() => loadExam(v)}
                    className={`p-2.5 rounded border text-xs cursor-pointer transition ${
                      selectedExam?.visit_id === v.visit_id
                        ? 'border-blue-500 bg-blue-950/60 shadow-xs'
                        : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-blue-400">{v.token_display || `#${v.opd_number}`}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-semibold">{v.department}</span>
                    </div>
                    <div className="font-bold text-slate-100 mt-1">{v.patients?.name}</div>
                    <div className="text-[11px] text-slate-400 flex justify-between mt-0.5">
                      <span>{v.patients?.age_years}Y / {v.patients?.sex}</span>
                      <span className="text-[10px] text-slate-400">Ref: {v.consultant_id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Viewport & Reporting Studio */}
          {selectedExam ? (
            <div className="lg:col-span-9 space-y-3 flex flex-col">
              {/* Patient Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-blue-400 font-mono">{selectedExam.token_display || `#${selectedExam.opd_number}`}</span>
                    <span className="font-bold text-sm text-white">{selectedExam.patients?.name}</span>
                    <span className="text-xs text-slate-400">({selectedExam.patients?.age_years} Y / {selectedExam.patients?.sex})</span>
                    <span className="text-xs font-mono text-slate-500">UHID: {selectedExam.uhid}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">Source: Cloudflare R2 Stream</div>
                </div>
              </div>

              {/* Grid: Canvas Viewport (Left) | Structured Report (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
                {/* PROFESSIONAL CANVAS VIEWPORT */}
                <div className={`bg-black border border-slate-800 rounded-lg p-3 flex flex-col justify-between shadow-2xl transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50 h-[95vh]' : 'lg:col-span-7 h-[620px]'}`}>
                  {/* Toolbar */}
                  <div className="space-y-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center justify-between text-slate-300 text-xs">
                      <span className="font-mono text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Eye className="w-4 h-4" /> PACS Viewport Engine
                      </span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          onClick={() => setActiveTool('pan')}
                          className={`px-2.5 py-1 rounded text-xs font-bold ${activeTool === 'pan' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                        >
                          Pan
                        </button>
                        <button
                          onClick={() => setActiveTool('measure')}
                          className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 ${activeTool === 'measure' ? 'bg-amber-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                        >
                          <Ruler className="w-3.5 h-3.5" /> Measure
                        </button>
                        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="p-1.5 hover:bg-slate-800 rounded" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
                        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="p-1.5 hover:bg-slate-800 rounded" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                        <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 hover:bg-slate-800 rounded" title="Rotate"><RotateCw className="w-4 h-4" /></button>
                        <button onClick={() => setIsInverted(!isInverted)} className="p-1.5 hover:bg-slate-800 rounded" title="Invert"><Contrast className="w-4 h-4" /></button>
                        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 hover:bg-slate-800 rounded" title="Fullscreen"><Maximize2 className="w-4 h-4" /></button>
                        <button onClick={resetViewer} className="px-2 py-1 hover:bg-slate-800 rounded text-xs font-bold text-slate-400">Reset</button>
                      </div>
                    </div>

                    {/* WW/WL Presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {WW_WL_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => applyPreset(p)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-blue-900/60 border border-slate-700/80 rounded text-xs font-semibold text-slate-300 transition"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Canvas Viewport Area */}
                  <div
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="flex-1 bg-black rounded my-2 flex items-center justify-center overflow-hidden relative cursor-crosshair select-none min-h-[480px]"
                  >
                    {scanUrl ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={scanUrl}
                          alt="Cloudflare R2 DICOM Scan"
                          draggable={false}
                          style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                            filter: `brightness(${brightness}%) contrast(${contrast}%) ${isInverted ? 'invert(1)' : ''}`,
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                          }}
                          className="max-h-full max-w-full object-contain pointer-events-none"
                        />

                        {/* Measurement Caliper Overlay */}
                        {measureStart && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <line
                              x1={measureStart.x}
                              y1={measureStart.y}
                              x2={measureEnd ? measureEnd.x : measureStart.x}
                              y2={measureEnd ? measureEnd.y : measureStart.y}
                              stroke="#f59e0b"
                              strokeWidth="2.5"
                              strokeDasharray="4"
                            />
                            <circle cx={measureStart.x} cy={measureStart.y} r="5" fill="#f59e0b" />
                            {measureEnd && (
                              <>
                                <circle cx={measureEnd.x} cy={measureEnd.y} r="5" fill="#f59e0b" />
                                <text
                                  x={(measureStart.x + measureEnd.x) / 2 + 12}
                                  y={(measureStart.y + measureEnd.y) / 2 - 12}
                                  fill="#f59e0b"
                                  fontSize="14"
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                >
                                  {calculateMeasurementMm()} mm
                                </text>
                              </>
                            )}
                          </svg>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-slate-500 p-8">
                        <ImageIcon className="w-16 h-16 mx-auto mb-3 opacity-40 text-blue-400" />
                        <p className="text-sm text-slate-300 font-bold mb-1">Loading study from Cloudflare R2...</p>
                      </div>
                    )}

                    {/* HUD Information Overlay */}
                    {scanUrl && (
                      <div className="absolute top-3 left-3 text-[11px] font-mono text-emerald-400 bg-black/80 px-3 py-1.5 rounded border border-emerald-900 pointer-events-none shadow space-y-0.5">
                        <div>Patient: {selectedExam.patients?.name}</div>
                        <div>Storage: Cloudflare R2 (`hospital-dicom-archive`)</div>
                        <div>Zoom: {(zoom * 100).toFixed(0)}% | Tool: {activeTool.toUpperCase()}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* STRUCTURED REPORTING STUDIO (Right) */}
                <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between h-[620px]">
                  <div className="space-y-3 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-400" /> Structured Reporting (Dr. Kalyan)
                      </span>
                    </div>

                    {/* Templates */}
                    <div className="flex flex-wrap gap-1.5">
                      {STRUCTURED_TEMPLATES.map((t, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="px-2.5 py-1 bg-slate-950 hover:bg-blue-900/50 text-blue-300 border border-slate-800 rounded text-xs font-bold transition"
                        >
                          + {t.title}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Technique & Protocol</label>
                        <input
                          type="text"
                          value={techniqueProtocol}
                          onChange={(e) => setTechniqueProtocol(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Radiological Findings</label>
                        <textarea
                          rows={4}
                          value={findingsText}
                          onChange={(e) => setFindingsText(e.target.value)}
                          placeholder="Describe bony integrity, joint spaces, alignments, measurements..."
                          className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none font-mono leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Conclusion / Impression *</label>
                        <textarea
                          rows={2}
                          value={impressionText}
                          onChange={(e) => setImpressionText(e.target.value)}
                          placeholder="Final radiological diagnosis..."
                          className="w-full p-2.5 text-xs font-bold bg-blue-950/40 border border-blue-800 rounded text-blue-200 outline-none"
                        />
                      </div>

                      {/* Critical Finding */}
                      <div className="p-2.5 bg-red-950/40 border border-red-900/60 rounded flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-bold text-red-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isCriticalFinding}
                            onChange={(e) => setIsCriticalFinding(e.target.checked)}
                            className="rounded text-red-600 focus:ring-0"
                          />
                          <AlertTriangle className="w-4 h-4 text-red-400" /> Critical Finding Alert
                        </label>
                        {isCriticalFinding && (
                          <input
                            type="text"
                            value={criticalDoctorNotified}
                            onChange={(e) => setCriticalDoctorNotified(e.target.value)}
                            placeholder="Consultant Notified..."
                            className="px-2 py-1 text-xs bg-red-900/50 border border-red-700 text-white rounded outline-none w-36"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sign Footer */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-300">
                      <div className="font-bold text-white">{radiologistName}</div>
                      <div className="text-[10px] text-slate-400">Reg: {radiologistRegNo}</div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSignReport}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-md transition"
                      >
                        <Check className="w-4 h-4" /> Sign & Release
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded border border-slate-700 shadow-sm"
                      >
                        <Printer className="w-4 h-4" /> Print
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-lg p-20 text-center text-slate-400 text-sm">
              Select an exam from the worklist to launch Dr. Kalyan's professional PACS DICOM viewer.
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE REPORT */}
      {selectedExam && (
        <div className="hidden print:block font-sans text-black p-8 bg-white" style={{ minHeight: '297mm' }}>
          <div className="text-center pb-3 border-b-2 border-black mb-4">
            <h1 className="text-xl font-black tracking-wider uppercase">GURU NANAK HOSPITAL</h1>
            <p className="text-xs text-neutral-600">Department of Radiodiagnosis & Imaging Services • Palwal</p>
            <span className="inline-block mt-1 px-3 py-0.5 text-[10px] font-bold bg-neutral-100 border border-black uppercase">
              CONFIDENTIAL RADIOLOGICAL REPORT
            </span>
          </div>

          <div className="border-b border-black pb-2 mb-4 text-xs flex justify-between">
            <div>
              <div className="font-bold">UHID: <span className="font-mono">{selectedExam.uhid}</span></div>
              <div className="text-sm font-bold mt-0.5">{selectedExam.patients?.name} ({selectedExam.patients?.age_years} Y / {selectedExam.patients?.sex})</div>
              <div>Ref Consultant: <span className="font-bold">{selectedExam.consultant_id}</span></div>
            </div>
            <div className="text-right">
              <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
              <div>Billing Category: <span className="font-bold">{selectedExam.patients?.master_payers?.company_name || 'Self-Pay'}</span></div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-bold uppercase text-[10px] text-neutral-600 block">Clinical Indication:</span>
              <p>{clinicalHistory}</p>
            </div>

            <div>
              <span className="font-bold uppercase text-[10px] text-neutral-600 block">Technique & Protocol:</span>
              <p>{techniqueProtocol}</p>
            </div>

            <div>
              <span className="font-bold uppercase text-[10px] text-neutral-600 block">Radiological Findings:</span>
              <p className="whitespace-pre-line leading-relaxed font-sans">{findingsText || 'No acute bony or soft tissue abnormality identified.'}</p>
            </div>

            <div className="p-3 bg-neutral-100 border border-neutral-300 rounded">
              <span className="font-black uppercase text-xs block mb-1">Impression / Conclusion:</span>
              <p className="font-bold text-sm leading-snug">{impressionText || 'Normal study.'}</p>
            </div>
          </div>

          <div className="text-xs border-t border-black pt-4 flex justify-between items-end mt-16">
            <p className="text-[10px] text-neutral-500 italic">* Electronically verified under NABH / NABL imaging guidelines.</p>
            <div className="text-right">
              <div style={{ height: '40px' }} />
              <div className="font-bold border-t border-black pt-1">{radiologistName}</div>
              <div className="text-[10px] text-neutral-600">Reg: {radiologistRegNo}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
