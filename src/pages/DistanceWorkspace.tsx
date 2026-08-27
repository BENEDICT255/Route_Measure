/**
 * Distance Workspace page.
 *
 * Top-level orchestrator for the Distance Between Points measurement mode.
 * Manages the full workflow: Upload → Detect → Assign → Review → Calculate → Results.
 *
 * Rendered inside MeasurementWorkspace when measurementMode === 'distance'.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { RawSheetData } from '../types/workbook';
import type {
  DistanceWorkbookAnalysis,
  DestinationSite,
  StartingPoint,
  DistanceAnalysisResult,
} from '../types/distance';
import { validateFile, readWorkbook, generateFileHash } from '../workbook/workbookReader';
import { analyzeDistanceWorkbook } from '../workbook/distanceDetection';
import { parseDestinationSites, getDestinationDisplayLabel } from '../workbook/distanceParser';
import { calculateDistances } from '../measurement/distanceCalculator';
import { exportDistanceExcel } from '../exports/distanceExport';
import { exportDistanceKml } from '../exports/distanceKmlExport';
import { ACCEPTED_FILE_EXTENSIONS, MAX_FILE_SIZE_DISPLAY } from '../utils/constants';
import { formatNumber } from '../utils/formatters';
import { StartingPointManager } from '../components/StartingPointManager';
import { AssignmentTable } from '../components/AssignmentTable';
import { DistanceResultsPanel } from '../components/DistanceResults';
import { DistanceMap } from '../components/DistanceMap';

import * as XLSX from 'xlsx';

type DistanceScreen = 'upload' | 'assign' | 'results';

interface DistanceWorkspaceProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onNewUpload: () => void;
  stepBarElement: React.ReactNode;
}

export function DistanceWorkspace({
  apiKey,
  onApiKeyChange,
  onNewUpload,
  stepBarElement,
}: DistanceWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [screen, setScreen] = useState<DistanceScreen>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File state
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [fileHash, setFileHash] = useState('');

  // Analysis state
  const [distAnalysis, setDistAnalysis] = useState<DistanceWorkbookAnalysis | null>(null);
  const [rawSheetData, setRawSheetData] = useState<RawSheetData | null>(null);

  // Assignment state
  const [destinations, setDestinations] = useState<DestinationSite[]>([]);
  const [startingPoints, setStartingPoints] = useState<StartingPoint[]>([]);
  const [showSPManager, setShowSPManager] = useState(false);

  // Results state
  const [analysisResult, setAnalysisResult] = useState<DistanceAnalysisResult | null>(null);
  const [selectedSiteUid, setSelectedSiteUid] = useState<string | null>(null);
  const [startingPointFilter, setStartingPointFilter] = useState<string>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ─── File handling ───────────────────────────────────────────────

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setFileObject(file);
    setFileName(file.name);
    setFileSizeStr(formatFileSize(file.size));

    try {
      const { sheets, sheetNames } = await readWorkbook(file);
      if (sheets.size === 0) {
        setError('The workbook contains no readable worksheets.');
        return;
      }

      // Read raw data for reference point detection
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: false, raw: true });
      const firstSheetName = sheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const allRawData: (string | number | null | undefined)[][] = worksheet
        ? XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true })
        : [];

      // Use the first sheet with data
      const selectedSheetName = sheetNames.find((n) => sheets.has(n)) || sheetNames[0];
      const selectedSheet = sheets.get(selectedSheetName);
      if (!selectedSheet) {
        setError('Could not find usable data in the workbook.');
        return;
      }

      setRawSheetData(selectedSheet);

      // Analyze for distance mode
      const analysis = analyzeDistanceWorkbook(selectedSheet, allRawData, sheetNames);
      setDistAnalysis(analysis);

      if (!analysis.latitudeColumn || !analysis.longitudeColumn) {
        setError('Could not detect latitude and longitude columns. Please ensure your workbook has columns with recognizable coordinate headers.');
        return;
      }

      // Parse destination sites
      const { destinations: parsedDests, validationMessages } = parseDestinationSites(
        selectedSheet,
        analysis,
        file.name
      );

      setDestinations(parsedDests);

      // Add detected reference points as starting points
      if (analysis.detectedReferencePoints.length > 0) {
        setStartingPoints((prev) => {
          const existing = new Set(prev.map((sp) => sp.uid));
          const newOnes = analysis.detectedReferencePoints.filter((sp) => !existing.has(sp.uid));
          return [...prev, ...newOnes];
        });
      }

      generateFileHash(file).then(setFileHash);

      // Move to assignment screen
      setScreen('assign');
    } catch (err) {
      setError(`Failed to read the workbook: ${err instanceof Error ? err.message : 'Unknown error'}.`);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ─── Starting point management ──────────────────────────────────

  const handleAddSP = useCallback((sp: StartingPoint) => {
    setStartingPoints((prev) => [...prev, sp]);
  }, []);

  const handleRemoveSP = useCallback((uid: string) => {
    setStartingPoints((prev) => prev.filter((sp) => sp.uid !== uid));
    // Unassign any destinations using this starting point
    setDestinations((prev) =>
      prev.map((d) =>
        d.assignedStartingPointUid === uid
          ? { ...d, assignedStartingPointUid: null, status: 'unassigned' as const }
          : d
      )
    );
  }, []);

  const handleUpdateSP = useCallback((sp: StartingPoint) => {
    setStartingPoints((prev) => prev.map((s) => (s.uid === sp.uid ? sp : s)));
  }, []);

  // ─── Assignment management ──────────────────────────────────────

  const handleAssign = useCallback((destUids: string[], spUid: string) => {
    setDestinations((prev) =>
      prev.map((d) =>
        destUids.includes(d.uid) && d.status !== 'invalid'
          ? { ...d, assignedStartingPointUid: spUid, status: 'assigned' as const }
          : d
      )
    );
  }, []);

  const handleExclude = useCallback((destUids: string[]) => {
    setDestinations((prev) =>
      prev.map((d) =>
        destUids.includes(d.uid)
          ? { ...d, status: 'excluded' as const }
          : d
      )
    );
  }, []);

  const handleInclude = useCallback((destUids: string[]) => {
    setDestinations((prev) =>
      prev.map((d) =>
        destUids.includes(d.uid) && d.status === 'excluded'
          ? { ...d, status: d.assignedStartingPointUid ? 'assigned' as const : 'unassigned' as const }
          : d
      )
    );
  }, []);

  // ─── Calculation ────────────────────────────────────────────────

  const assignmentSummary = useMemo(() => {
    const total = destinations.length;
    const assigned = destinations.filter((d) => d.status === 'assigned').length;
    const unassigned = destinations.filter((d) => d.status === 'unassigned').length;
    const excluded = destinations.filter((d) => d.status === 'excluded').length;
    const invalid = destinations.filter((d) => d.status === 'invalid').length;

    // Per starting point breakdown
    const spBreakdown: { name: string; count: number }[] = [];
    const spCountMap = new Map<string, number>();
    for (const d of destinations) {
      if (d.assignedStartingPointUid && d.status === 'assigned') {
        spCountMap.set(d.assignedStartingPointUid, (spCountMap.get(d.assignedStartingPointUid) || 0) + 1);
      }
    }
    for (const sp of startingPoints) {
      const count = spCountMap.get(sp.uid) || 0;
      if (count > 0) spBreakdown.push({ name: sp.name, count });
    }

    return { total, assigned, unassigned, excluded, invalid, spBreakdown };
  }, [destinations, startingPoints]);

  const canCalculate = assignmentSummary.unassigned === 0 && assignmentSummary.assigned > 0;

  const handleCalculate = useCallback(() => {
    setIsProcessing(true);
    setError(null);

    setTimeout(() => {
      try {
        const result = calculateDistances(
          destinations,
          startingPoints,
          fileName,
          distAnalysis?.selectedWorksheet || ''
        );
        setAnalysisResult(result);
        setIsProcessing(false);
        setScreen('results');
      } catch (err) {
        setError(`Calculation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsProcessing(false);
      }
    }, 150);
  }, [destinations, startingPoints, fileName, distAnalysis]);

  // ─── Export handlers ────────────────────────────────────────────

  const handleExportExcel = useCallback(async () => {
    if (!analysisResult) return;
    try {
      await exportDistanceExcel(analysisResult, fileHash);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [analysisResult, fileHash]);

  const handleExportKml = useCallback(() => {
    if (!analysisResult) return;
    exportDistanceKml(analysisResult);
  }, [analysisResult]);

  // ─── Clear ──────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setScreen('upload');
    setFileObject(null);
    setFileName('');
    setFileSizeStr('');
    setFileHash('');
    setDistAnalysis(null);
    setRawSheetData(null);
    setDestinations([]);
    setStartingPoints([]);
    setAnalysisResult(null);
    setSelectedSiteUid(null);
    setStartingPointFilter('all');
    setError(null);
    setShowSPManager(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      {/* ─── UPLOAD SCREEN ─── */}
      {screen === 'upload' && (
        <div className="rm-upload-confirm-page">
          <div className="rm-geospatial-watermark" aria-hidden="true">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="crosshair-grid-d" width="120" height="120" patternUnits="userSpaceOnUse">
                  <path d="M 60 55 L 60 65 M 55 60 L 65 60" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.12" />
                  <circle cx="60" cy="60" r="1.5" fill="#3b82f6" fillOpacity="0.1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#crosshair-grid-d)" />
            </svg>
          </div>

          <div className="rm-upload-confirm-container">
            {error && (
              <div className="rm-alert-box rm-alert-error">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5V9M8 11.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div style={{ whiteSpace: 'pre-line' }}>{error}</div>
              </div>
            )}

            <div className="rm-card" style={{ maxWidth: 640, margin: '0 auto' }}>
              <h2 className="rm-card-title">Upload Site Data</h2>
              <p className="rm-card-subtitle">
                Upload an Excel workbook containing destination site coordinates (latitude, longitude).
              </p>

              <div
                className={`rm-dropzone ${dragOver ? 'drag-over' : ''} ${fileObject ? 'has-file' : ''}`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div className="rm-dropzone-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 16V4M12 4L8 8M12 4L16 8" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 16V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V16" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="rm-dropzone-title">
                  Drag & drop your Excel file here
                </div>
                <div className="rm-dropzone-subtitle">
                  or click to browse
                </div>
                <button className="rm-dropzone-browse" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  Browse Files
                </button>
                <div className="rm-dropzone-footer">
                  Accepted: .xlsx • Max size: {MAX_FILE_SIZE_DISPLAY}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
                onChange={onFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── ASSIGNMENT SCREEN ─── */}
      {screen === 'assign' && (
        <div className="rm-distance-assign-page">
          <div className="rm-distance-assign-content">
            {error && (
              <div className="rm-alert-box rm-alert-error">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5V9M8 11.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div>{error}</div>
              </div>
            )}

            {/* File info strip */}
            {fileObject && (
              <div className="rm-file-status-row" style={{ marginBottom: 16 }}>
                <div className="rm-file-status-left">
                  <div className="rm-file-xls-icon"><span>XLS</span></div>
                  <div className="rm-file-meta">
                    <div className="rm-file-name">{fileName}</div>
                    <div className="rm-file-size">{fileSizeStr}</div>
                  </div>
                </div>
                <div className="rm-file-status-right">
                  <div className="rm-upload-success-badge">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="#10b981" />
                      <path d="M5 8L7 10L11 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{distAnalysis?.siteCount || 0} sites detected</span>
                  </div>
                </div>
              </div>
            )}

            {/* Starting Point Manager Modal */}
            {showSPManager && (
              <div className="rm-sp-manager-overlay">
                <div className="rm-sp-manager-modal">
                  <StartingPointManager
                    startingPoints={startingPoints}
                    onAdd={handleAddSP}
                    onRemove={handleRemoveSP}
                    onUpdate={handleUpdateSP}
                    onClose={() => setShowSPManager(false)}
                  />
                </div>
              </div>
            )}

            {/* Assignment Table */}
            <AssignmentTable
              destinations={destinations}
              startingPoints={startingPoints}
              onAssign={handleAssign}
              onExclude={handleExclude}
              onInclude={handleInclude}
              onOpenStartingPointManager={() => setShowSPManager(true)}
            />

            {/* ─── REVIEW & CALCULATE SECTION ─── */}
            <div className="rm-distance-review-section">
              <div className="rm-distance-review-card">
                <h3 className="rm-distance-review-title">Distance Measurement Review</h3>

                <div className="rm-distance-review-stats">
                  <div className="rm-distance-review-stat">
                    <span className="rm-distance-review-stat-val">{assignmentSummary.total}</span>
                    <span className="rm-distance-review-stat-label">Destinations</span>
                  </div>
                  <div className="rm-distance-review-stat">
                    <span className="rm-distance-review-stat-val">{assignmentSummary.spBreakdown.length}</span>
                    <span className="rm-distance-review-stat-label">Starting Points</span>
                  </div>
                  <div className="rm-distance-review-stat">
                    <span className="rm-distance-review-stat-val rm-review-stat-green">{assignmentSummary.assigned}</span>
                    <span className="rm-distance-review-stat-label">Assigned</span>
                  </div>
                  {assignmentSummary.excluded > 0 && (
                    <div className="rm-distance-review-stat">
                      <span className="rm-distance-review-stat-val">{assignmentSummary.excluded}</span>
                      <span className="rm-distance-review-stat-label">Excluded</span>
                    </div>
                  )}
                </div>

                {assignmentSummary.spBreakdown.length > 0 && (
                  <div className="rm-distance-review-breakdown">
                    {assignmentSummary.spBreakdown.map((sp) => (
                      <div key={sp.name} className="rm-distance-review-sp-row">
                        <span className="rm-distance-review-sp-name">{sp.name}</span>
                        <span className="rm-distance-review-sp-arrow">→</span>
                        <span className="rm-distance-review-sp-count">{sp.count} sites</span>
                      </div>
                    ))}
                  </div>
                )}

                {assignmentSummary.unassigned > 0 && (
                  <div className="rm-distance-review-warning">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1L15 14H1L8 1Z" stroke="#f59e0b" strokeWidth="1.4" strokeLinejoin="round" />
                      <path d="M8 6V10M8 12V12.5" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <span>{assignmentSummary.unassigned} sites still need a starting point.</span>
                  </div>
                )}

                <div className="rm-distance-review-actions">
                  <button className="rm-btn-cancel" onClick={() => setScreen('upload')}>
                    ← Back
                  </button>
                  <button
                    className="rm-btn-confirm-process"
                    onClick={handleCalculate}
                    disabled={!canCalculate || isProcessing}
                  >
                    {isProcessing ? 'Calculating…' : 'Calculate Distances →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── RESULTS SCREEN ─── */}
      {screen === 'results' && analysisResult && (
        <div className={`rm-results-workspace-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`} style={{ position: 'relative' }}>
          {/* Floating expand tab */}
          {sidebarCollapsed && (
            <button
              className="rm-sidebar-expand-tab"
              onClick={() => setSidebarCollapsed(false)}
              title="Show Sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Sidebar</span>
            </button>
          )}

          {/* LEFT SIDEBAR */}
          <aside className={`rm-results-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="rm-sidebar-header">
              <div style={{ flex: 1 }}>
                <button className="rm-sidebar-btn active" style={{ cursor: 'default' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="8" cy="8" r="2" fill="currentColor" />
                  </svg>
                  Distance Analysis
                </button>
              </div>
              <button
                className="rm-sidebar-collapse-btn"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse Sidebar"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Starting Point Filter */}
            <div className="rm-sidebar-section">
              <div className="rm-sidebar-section-title">STARTING POINTS</div>
              <button
                className={`rm-sidebar-btn ${startingPointFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStartingPointFilter('all')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                All ({analysisResult.summary.destinationCount})
              </button>
              {analysisResult.startingPoints.map((sp) => {
                const count = analysisResult.results.filter((r) => r.startingPointUid === sp.uid).length;
                return (
                  <button
                    key={sp.uid}
                    className={`rm-sidebar-btn ${startingPointFilter === sp.uid ? 'active' : ''}`}
                    onClick={() => setStartingPointFilter(sp.uid)}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#3b82f6', display: 'inline-block', flexShrink: 0,
                    }} />
                    {sp.name} ({count})
                  </button>
                );
              })}
            </div>

            {/* Export */}
            <div className="rm-sidebar-section">
              <div className="rm-sidebar-section-title">EXPORT</div>
              <button className="rm-sidebar-btn" onClick={handleExportExcel}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M5 5L11 11M11 5L5 11" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Excel Report
              </button>
              <button className="rm-sidebar-btn" onClick={handleExportKml}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                  <ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                KML Export
              </button>
            </div>

            <div className="rm-sidebar-bottom-section">
              <div className="rm-sidebar-footer-note">
                All processing is done in your browser.<br />Your data is never uploaded.
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="rm-results-main">
            <div className="rm-results-grid">
              {/* LEFT: Results Panel */}
              <div className="rm-results-left-col">
                <DistanceResultsPanel
                  analysisResult={analysisResult}
                  onExportExcel={handleExportExcel}
                  onExportKml={handleExportKml}
                  onSiteSelect={setSelectedSiteUid}
                  selectedSiteUid={selectedSiteUid}
                  startingPointFilter={startingPointFilter}
                  onStartingPointFilterChange={setStartingPointFilter}
                />
              </div>

              {/* RIGHT: Map */}
              <div className="rm-results-right-col">
                <DistanceMap
                  analysisResult={analysisResult}
                  startingPointFilter={startingPointFilter}
                  selectedSiteUid={selectedSiteUid}
                  onSiteSelect={setSelectedSiteUid}
                  apiKey={apiKey}
                  onApiKeyChange={onApiKeyChange}
                />
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  );
}
