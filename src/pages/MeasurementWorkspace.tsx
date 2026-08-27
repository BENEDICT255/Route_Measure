import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkbookAnalysis, RawSheetData } from '../types/workbook';
import type { MeasurementResult } from '../types/coordinates';
import { validateFile, readWorkbook, generateFileHash } from '../workbook/workbookReader';
import { selectBestSheet } from '../workbook/workbookAnalysis';
import { processWorkbook } from '../workbook/normalization';
import { formatDistanceMetres, formatDistanceKilometres, formatCoordinate } from '../utils/formatters';
import { ACCEPTED_FILE_EXTENSIONS, MAX_FILE_SIZE_DISPLAY } from '../utils/constants';
import { ValidationSeverity } from '../types/coordinates';
import { RouteMap } from '../components/RouteMap';
import { classifyRoute, ROUTE_COLORS } from '../mapping/GoogleMapsAdapter';
import { HowItWorksModal, AccuracyModal, PrivacyModal } from '../components/LandingModals';

import type { MeasurementMode } from '../types/distance';
import { DistanceWorkspace } from './DistanceWorkspace';

type WorkspaceScreen = 'upload-confirm' | 'results';

export function MeasurementWorkspace() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [measurementMode, setMeasurementMode] = useState<MeasurementMode | null>(null);
  const [screen, setScreen] = useState<WorkspaceScreen>('upload-confirm');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileObject, setFileObject] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [fileHash, setFileHash] = useState('');

  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [sheetData, setSheetData] = useState<RawSheetData | null>(null);

  const [result, setResult] = useState<MeasurementResult | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'coordinates' | 'segments'>('coordinates');
  const [activeModal, setActiveModal] = useState<'how-it-works' | 'accuracy' | 'privacy' | null>(null);

  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('gmaps_api_key') || (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
  );

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gmaps_api_key', newKey);
  };

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

      const best = selectBestSheet(sheets, sheetNames);
      if (!best) {
        setError('Could not find coordinate data in the workbook.');
        return;
      }

      const selectedSheetData = sheets.get(best.sheetName)!;
      setSheetData(selectedSheetData);
      setAnalysis(best.analysis);

      generateFileHash(file).then(setFileHash);

      if (!best.analysis.latitudeColumn || !best.analysis.longitudeColumn) {
        setError(
          'Could not automatically detect latitude and longitude columns. Please ensure your workbook has columns with recognizable coordinate headers.'
        );
      }
    } catch (err) {
      setError(
        `Failed to read the workbook: ${err instanceof Error ? err.message : 'Unknown error'}.`
      );
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

  const handleProcess = useCallback(() => {
    if (!sheetData || !analysis) return;
    setIsProcessing(true);
    setError(null);

    setTimeout(() => {
      try {
        const measurementResult = processWorkbook(sheetData, analysis, fileName);

        const hasErrors = measurementResult.validationMessages.some(
          (m) => m.severity === ValidationSeverity.Error
        );

        if (measurementResult.routes.length === 0 || (hasErrors && measurementResult.routes.length === 0)) {
          setError(
            measurementResult.validationMessages
              .filter((m) => m.severity === ValidationSeverity.Error)
              .map((m) => m.message)
              .join('\n') || 'No measurable routes found.'
          );
          setIsProcessing(false);
          return;
        }

        setResult(measurementResult);
        setSelectedFilter('all');
        setIsProcessing(false);
        setScreen('results');
      } catch (err) {
        setError(`Processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsProcessing(false);
      }
    }, 150);
  }, [sheetData, analysis, fileName]);

  const handleNewUpload = useCallback(() => {
    setScreen('upload-confirm');
    setIsProcessing(false);
    setError(null);
    setFileObject(null);
    setFileName('');
    setFileSizeStr('');
    setFileHash('');
    setAnalysis(null);
    setSheetData(null);
    setResult(null);
    setSelectedFilter('all');
    setActiveTab('coordinates');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClear = useCallback(() => {
    setMeasurementMode(null);
    handleNewUpload();
  }, [handleNewUpload]);

  const handleChangeMode = useCallback(() => {
    setMeasurementMode(null);
    handleNewUpload();
  }, [handleNewUpload]);

  // Compute active routes and displayed summary dynamically
  const { activeRoutes, displayedSummary, isAllSelected } = useMemo(() => {
    if (!result || result.routes.length === 0) {
      return { activeRoutes: [], displayedSummary: null, isAllSelected: false };
    }

    if (selectedFilter === 'all' || result.routes.length === 1) {
      const all = result.routes;
      const totalDist = all.reduce((sum, r) => sum + r.totalDistanceMetres, 0);
      const totalPoints = all.reduce((sum, r) => sum + r.coordinateCount, 0);
      const totalSegments = all.reduce((sum, r) => sum + r.segmentCount, 0);
      const startPoint = all[0].startPoint;
      const endPoint = all[all.length - 1].endPoint;

      const allPointDistances = all.flatMap((r) =>
        r.pointDistances.map((pd) => ({
          ...pd,
          routeName: r.name,
          routeCls: classifyRoute(r.name),
        }))
      );
      const allSegments = all.flatMap((r) =>
        r.segments.map((s) => ({
          ...s,
          routeName: r.name,
          routeCls: classifyRoute(r.name),
        }))
      );

      return {
        activeRoutes: all,
        isAllSelected: true,
        displayedSummary: {
          name: all.length > 1 ? `All Routes (${all.map((r) => r.name).join(' & ')})` : all[0].name,
          totalDistanceMetres: totalDist,
          coordinateCount: totalPoints,
          segmentCount: totalSegments,
          startPoint,
          endPoint,
          pointDistances: allPointDistances,
          segments: allSegments,
        },
      };
    }

    // Match by uid, or classified type, or name
    const matched =
      result.routes.find((r) => r.uid === selectedFilter) ||
      result.routes.find((r) => classifyRoute(r.name) === selectedFilter.toLowerCase()) ||
      result.routes.find((r) => r.name.toLowerCase() === selectedFilter.toLowerCase()) ||
      result.routes[0];

    return {
      activeRoutes: [matched],
      isAllSelected: false,
      displayedSummary: {
        name: matched.name,
        totalDistanceMetres: matched.totalDistanceMetres,
        coordinateCount: matched.coordinateCount,
        segmentCount: matched.segmentCount,
        startPoint: matched.startPoint,
        endPoint: matched.endPoint,
        pointDistances: matched.pointDistances.map((pd) => ({
          ...pd,
          routeName: matched.name,
          routeCls: classifyRoute(matched.name),
        })),
        segments: matched.segments.map((s) => ({
          ...s,
          routeName: matched.name,
          routeCls: classifyRoute(matched.name),
        })),
      },
    };
  }, [result, selectedFilter]);

  const handleFilterChange = useCallback((filter: string) => {
    setSelectedFilter(filter);
  }, []);

  const handleExportExcel = useCallback(async () => {
    if (!result || !displayedSummary) return;

    try {
      const ExcelJS = await import('exceljs');
      const { saveAs } = await import('file-saver');

      const workbook = new ExcelJS.Workbook();

      const summarySheet = workbook.addWorksheet('Route Summary');
      summarySheet.columns = [
        { header: 'Property', key: 'prop', width: 35 },
        { header: 'Value', key: 'value', width: 40 },
      ];

      summarySheet.addRows([
        { prop: 'Route Selection', value: displayedSummary.name },
        { prop: 'Coordinate Points', value: displayedSummary.coordinateCount },
        { prop: 'Segments', value: displayedSummary.segmentCount },
        { prop: 'Start Point', value: displayedSummary.startPoint.displayLabel },
        { prop: 'End Point', value: displayedSummary.endPoint.displayLabel },
        { prop: 'Coordinate-Derived Route Distance (m)', value: Number(displayedSummary.totalDistanceMetres.toFixed(1)) },
        { prop: 'Coordinate-Derived Route Distance (km)', value: Number((displayedSummary.totalDistanceMetres / 1000).toFixed(4)) },
        { prop: 'Source File', value: result.sourceFile },
        { prop: 'Source Worksheet', value: result.sourceSheet },
        { prop: 'Processing Timestamp', value: result.processingTimestamp },
        { prop: 'Calculation Method', value: result.calculationMethod },
        { prop: 'Application Version', value: result.applicationVersion },
        { prop: 'File Hash (SHA-256)', value: fileHash },
      ]);

      if (isAllSelected && result.routes.length > 1) {
        summarySheet.addRow({ prop: '---', value: '---' });
        summarySheet.addRow({ prop: 'PER-ROUTE BREAKDOWN', value: '' });
        result.routes.forEach((r) => {
          summarySheet.addRow({
            prop: `${r.name} Distance`,
            value: `${formatDistanceMetres(r.totalDistanceMetres)} (${formatDistanceKilometres(r.totalDistanceMetres)})`,
          });
        });
      }

      summarySheet.getRow(1).font = { bold: true };

      const coordSheet = workbook.addWorksheet('Coordinates');
      const coordCols = [
        { header: 'Sequence', key: 'seq', width: 12 },
        ...(isAllSelected && result.routes.length > 1 ? [{ header: 'Route', key: 'route', width: 16 }] : []),
        { header: 'Point', key: 'point', width: 25 },
        { header: 'Latitude', key: 'lat', width: 15 },
        { header: 'Longitude', key: 'lon', width: 15 },
        { header: 'Description', key: 'desc', width: 30 },
        { header: 'Cumulative Distance (m)', key: 'cumDist', width: 25 },
      ];
      coordSheet.columns = coordCols;

      displayedSummary.pointDistances.forEach((pd, idx) => {
        coordSheet.addRow({
          seq: idx + 1,
          ...(isAllSelected && result.routes.length > 1 ? { route: pd.routeName } : {}),
          point: pd.point.displayLabel,
          lat: pd.point.latitude,
          lon: pd.point.longitude,
          desc: pd.point.description || '',
          cumDist: Number(pd.cumulativeDistance.toFixed(1)),
        });
      });
      coordSheet.getRow(1).font = { bold: true };

      const segSheet = workbook.addWorksheet('Segments');
      const segCols = [
        { header: 'Segment', key: 'seg', width: 12 },
        ...(isAllSelected && result.routes.length > 1 ? [{ header: 'Route', key: 'route', width: 16 }] : []),
        { header: 'From', key: 'from', width: 25 },
        { header: 'To', key: 'to', width: 25 },
        { header: 'From Lat', key: 'fromLat', width: 14 },
        { header: 'From Lon', key: 'fromLon', width: 14 },
        { header: 'To Lat', key: 'toLat', width: 14 },
        { header: 'To Lon', key: 'toLon', width: 14 },
        { header: 'Segment Distance (m)', key: 'dist', width: 22 },
        { header: 'Cumulative Distance (m)', key: 'cumDist', width: 22 },
      ];
      segSheet.columns = segCols;

      displayedSummary.segments.forEach((seg, idx) => {
        segSheet.addRow({
          seg: idx + 1,
          ...(isAllSelected && result.routes.length > 1 ? { route: seg.routeName } : {}),
          from: seg.fromPoint.displayLabel,
          to: seg.toPoint.displayLabel,
          fromLat: seg.fromPoint.latitude,
          fromLon: seg.fromPoint.longitude,
          toLat: seg.toPoint.latitude,
          toLon: seg.toPoint.longitude,
          dist: Number(seg.distanceMetres.toFixed(1)),
          cumDist: Number(seg.cumulativeDistanceMetres.toFixed(1)),
        });
      });
      segSheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const cleanName = displayedSummary.name.replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(blob, `RouteMeasure_${cleanName}_Report.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to generate the Excel report.');
    }
  }, [result, displayedSummary, isAllSelected, fileHash]);

  const handleExportKML = useCallback(() => {
    if (!result || !displayedSummary) return;

    const routesToExport = activeRoutes;
    const folders = routesToExport
      .map((route) => {
        const coordString = route.points.map((p) => `${p.longitude},${p.latitude},0`).join('\n              ');
        const placemarks = route.points
          .map(
            (p) => `
          <Placemark>
            <name>${escapeXml(p.displayLabel)}</name>
            <description>${escapeXml(p.description || `Sequence: ${p.sequenceIndex + 1}`)}</description>
            <Point>
              <coordinates>${p.longitude},${p.latitude},0</coordinates>
            </Point>
          </Placemark>`
          )
          .join('');

        const cls = classifyRoute(route.name);
        const colorKml = cls === 'lv' ? 'ff42b9f4' : 'ffff6b2f';

        return `
      <Folder>
        <name>${escapeXml(route.name)} (${formatDistanceMetres(route.totalDistanceMetres)})</name>
        <Style id="style_${escapeXml(route.uid)}">
          <LineStyle>
            <color>${colorKml}</color>
            <width>4</width>
          </LineStyle>
        </Style>
        <Placemark>
          <name>${escapeXml(route.name)} Route Line</name>
          <styleUrl>#style_${escapeXml(route.uid)}</styleUrl>
          <LineString>
            <coordinates>
                ${coordString}
            </coordinates>
          </LineString>
        </Placemark>
        ${placemarks}
      </Folder>`;
      })
      .join('');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(displayedSummary.name)} — RouteMeasure</name>
    <description>Coordinate-derived route distance: ${formatDistanceMetres(displayedSummary.totalDistanceMetres)} (${formatDistanceKilometres(displayedSummary.totalDistanceMetres)})</description>
    ${folders}
  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = displayedSummary.name.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `RouteMeasure_${cleanName}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, activeRoutes, displayedSummary]);

  return (
    <div className="rm-workspace-root">
      {/* ─── TOP APPLICATION HEADER ───────────────────────────────── */}
      <header className="rm-top-header">
        <a href="/" className="rm-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <svg className="rm-logo-icon" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#2563eb" fillOpacity="0.2"/>
            <path d="M8 24L12 8L16 18L20 12L24 24" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="8" r="2.2" fill="#60a5fa"/>
            <circle cx="16" cy="18" r="2.2" fill="#60a5fa"/>
            <circle cx="20" cy="12" r="2.2" fill="#60a5fa"/>
          </svg>
          <span className="rm-logo-text">RouteMeasure</span>
        </a>

        <div className="rm-header-center-text">
          Upload your Excel file and generate accurate route distance
        </div>

        <div className="rm-header-actions">
          <button className="rm-btn-clear" onClick={handleClear}>
            Clear
          </button>
          <button className="rm-btn-new-upload" onClick={handleClear}>
            + New Upload
          </button>
        </div>
      </header>

      {/* ─── TWO-STEP PROGRESS INDICATOR ──────────────────────────── */}
      <div className="rm-step-bar-container">
        <div className="rm-step-bar">
          {/* Step 1: Upload & Confirm */}
          <div className="rm-step-item">
            <div className={`rm-step-circle ${screen === 'upload-confirm' ? 'active' : 'completed'}`}>
              {screen === 'results' ? '✓' : '1'}
            </div>
            <span className={`rm-step-label ${screen === 'upload-confirm' ? 'active' : 'completed'}`}>
              Upload & Confirm
            </span>
          </div>

          {/* Connector line */}
          <div className={`rm-step-connector ${screen === 'results' ? 'completed' : ''}`} />

          {/* Step 2: Results */}
          <div className="rm-step-item">
            <div className={`rm-step-circle ${screen === 'results' ? 'active' : 'future'}`}>
              2
            </div>
            <span className={`rm-step-label ${screen === 'results' ? 'active' : 'future'}`}>
              Results
            </span>
          </div>
        </div>

        {measurementMode && (
          <div className="rm-active-mode-bar">
            <span className="rm-active-mode-label">Measurement Type:</span>
            <span className={`rm-active-mode-pill rm-mode-pill-${measurementMode}`}>
              {measurementMode === 'route' ? 'LV & MV Route' : 'Distance Between Points'}
            </span>
            <button className="rm-change-mode-btn" onClick={handleChangeMode}>
              Change measurement type
            </button>
          </div>
        )}
      </div>

      {/* ─── DISTANCE WORKSPACE (when mode is 'distance') ─────────── */}
      {measurementMode === 'distance' ? (
        <DistanceWorkspace
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
          onNewUpload={handleClear}
          stepBarElement={null}
        />
      ) : measurementMode === null ? (
        /* ─── MODE SELECTION (when no mode selected yet) ────────── */
        <div className="rm-upload-confirm-page">
          <div className="rm-geospatial-watermark" aria-hidden="true">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="crosshair-grid-m" width="120" height="120" patternUnits="userSpaceOnUse">
                  <path d="M 60 55 L 60 65 M 55 60 L 65 60" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.12" />
                  <circle cx="60" cy="60" r="1.5" fill="#3b82f6" fillOpacity="0.1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#crosshair-grid-m)" />
            </svg>
          </div>

          <div className="rm-upload-confirm-container">
            <div className="rm-mode-selection-wrap">
              <div className="rm-mode-selection-header">
                <h2 className="rm-mode-selection-title">What would you like to measure?</h2>
                <p className="rm-mode-selection-subtitle">Select your measurement workflow to continue</p>
              </div>
              <div className="rm-mode-cards-grid">
                {/* Option A: LV & MV Route */}
                <div
                  className="rm-mode-card"
                  onClick={() => setMeasurementMode('route')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="rm-mode-card-badge">Network Polyline</div>
                  <div className="rm-mode-card-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M4 18L9 8L15 14L20 4" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="4" cy="18" r="2.5" fill="#60a5fa"/>
                      <circle cx="9" cy="8" r="2.5" fill="#60a5fa"/>
                      <circle cx="15" cy="14" r="2.5" fill="#60a5fa"/>
                      <circle cx="20" cy="4" r="2.5" fill="#60a5fa"/>
                    </svg>
                  </div>
                  <h3 className="rm-mode-card-title">LV &amp; MV Route</h3>
                  <p className="rm-mode-card-desc">
                    Measure ordered LV/MV network routes from coordinate sequences.
                  </p>
                  <div className="rm-mode-card-cta">
                    <span>Select LV &amp; MV Route →</span>
                  </div>
                </div>

                {/* Option B: Distance Between Points */}
                <div
                  className="rm-mode-card"
                  onClick={() => setMeasurementMode('distance')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="rm-mode-card-badge rm-badge-green">Origin to Site</div>
                  <div className="rm-mode-card-icon rm-icon-green">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <circle cx="6" cy="12" r="4" stroke="#10b981" strokeWidth="2" fill="#10b981" fillOpacity="0.2"/>
                      <circle cx="18" cy="6" r="3" stroke="#10b981" strokeWidth="2"/>
                      <circle cx="19" cy="18" r="3" stroke="#10b981" strokeWidth="2"/>
                      <path d="M9.5 10.5L15.5 7.5M9.5 13.5L16.5 16.5" stroke="#10b981" strokeWidth="1.8" strokeDasharray="3 2"/>
                    </svg>
                  </div>
                  <h3 className="rm-mode-card-title">Distance Between Points</h3>
                  <p className="rm-mode-card-desc">
                    Measure each site's distance from a selected starting point.
                  </p>
                  <div className="rm-mode-card-cta rm-cta-green">
                    <span>Select Distance Between Points →</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── EXISTING ROUTE MODE (when mode is 'route') ─────────── */
        <>
          {/* ─── SCREEN 1: UPLOAD & CONFIRM ───────────────────────────── */}
          {screen === 'upload-confirm' && (
            <div className="rm-upload-confirm-page">
              {/* Decorative Engineering/Geospatial Watermark */}
              <div className="rm-geospatial-watermark" aria-hidden="true">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="crosshair-grid" width="120" height="120" patternUnits="userSpaceOnUse">
                      <path d="M 60 55 L 60 65 M 55 60 L 65 60" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.12" />
                      <circle cx="60" cy="60" r="1.5" fill="#3b82f6" fillOpacity="0.1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#crosshair-grid)" />
                  <path d="M -50,150 Q 250,50 600,180 T 1200,90" fill="none" stroke="#2563eb" strokeWidth="0.9" strokeOpacity="0.08" />
                  <path d="M -30,220 Q 300,110 700,240 T 1300,140" fill="none" stroke="#2563eb" strokeWidth="0.9" strokeOpacity="0.06" />
                  <path d="M 800,500 Q 1100,320 1500,450" fill="none" stroke="#2563eb" strokeWidth="0.8" strokeOpacity="0.07" />
                  <path d="M 750,580 Q 1150,380 1550,520" fill="none" stroke="#2563eb" strokeWidth="0.8" strokeOpacity="0.05" />
                </svg>
              </div>

              <div className="rm-upload-confirm-container">
                {error && (
                  <div className="rm-alert-box rm-alert-error">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 5V9M8 11.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <div style={{ whiteSpace: 'pre-line' }}>{error}</div>
                  </div>
                )}

                <div className="rm-two-col-grid">
                  {/* LEFT CARD: UPLOAD COORDINATE FILE */}
                  <div className="rm-card rm-upload-card">
                    <h2 className="rm-card-title">Upload Coordinate File</h2>
                    <p className="rm-card-subtitle">
                      Upload an Excel workbook containing latitude and longitude coordinates.
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
                    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                      <rect width="48" height="48" rx="24" fill="#eff6ff" />
                      <path d="M24 16V28M24 16L19 21M24 16L29 21" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 30C12.5 30 11 28.5 11 27C11 25.5 12 24.2 13.5 24C14 20.5 17 18 20.5 18C23.5 18 26 19.8 27 22.5C28.5 22.5 30 23.5 30.5 25C32 25.5 33 27 33 28.5C33 30.5 31.5 32 29.5 32H15" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div className="rm-dropzone-title">Drag & drop your Excel file here</div>
                  <div className="rm-dropzone-subtitle">or click to browse</div>

                  <button
                    type="button"
                    className="rm-btn-browse"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
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

                {/* File Upload Status Row */}
                {fileObject && (
                  <div className="rm-file-status-row">
                    <div className="rm-file-status-left">
                      <div className="rm-file-xls-icon">
                        <span>XLS</span>
                      </div>
                      <div className="rm-file-meta">
                        <div className="rm-file-name">{fileName}</div>
                        <div className="rm-file-size">{fileSizeStr}</div>
                      </div>
                    </div>

                    <div className="rm-file-status-right">
                      <div className="rm-upload-success-badge">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" fill="#10b981"/>
                          <path d="M5 8L7 10L11 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>File uploaded successfully</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT CARD: CONFIRM DETECTED DATA */}
              <div className="rm-card rm-confirm-card">
                <h2 className="rm-card-title">Confirm Detected Data</h2>
                <p className="rm-card-subtitle">
                  Please review and confirm the detected data before processing.
                </p>

                {analysis ? (
                  <>
                    <div className="rm-detected-fields-grid">
                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="12" height="12" rx="2" stroke="#64748b" strokeWidth="1.4"/>
                            <path d="M5 5H11M5 8H11M5 11H9" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                          Worksheet
                        </div>
                        <div className="rm-field-value">{analysis.selectedWorksheet}</div>
                      </div>

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3V13M8 13L4 9M8 13L12 9" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Latitude Column
                        </div>
                        <div className="rm-field-value">{analysis.latitudeColumn?.originalHeader || 'Not detected'}</div>
                      </div>

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Longitude Column
                        </div>
                        <div className="rm-field-value">{analysis.longitudeColumn?.originalHeader || 'Not detected'}</div>
                      </div>

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                            <circle cx="8" cy="8" r="2" fill="#64748b"/>
                          </svg>
                          Coordinate Points
                        </div>
                        <div className="rm-field-value font-bold">{analysis.coordinateRowCount}</div>
                      </div>

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M3 4H13M3 8H13M3 12H9" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                          Route Sequence
                        </div>
                        <div className="rm-field-value">{analysis.orderingDescription || 'Excel row order'}</div>
                      </div>
                    </div>

                    {/* Preview Table */}
                    <div className="rm-preview-section">
                      <div className="rm-preview-header">Preview (first 5 rows)</div>
                      <div className="rm-preview-table-wrap">
                        <table className="rm-preview-table">
                          <thead>
                            <tr>
                              <th>ROW</th>
                              <th>LATITUDE</th>
                              <th>LONGITUDE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.previewRows.slice(0, 5).map((row, idx) => {
                              const latVal = analysis.latitudeColumn ? row[analysis.latitudeColumn.originalHeader] : undefined;
                              const lonVal = analysis.longitudeColumn ? row[analysis.longitudeColumn.originalHeader] : undefined;
                              return (
                                <tr key={idx}>
                                  <td className="rm-row-num">{(analysis.headerRow ?? 0) + 2 + idx}</td>
                                  <td className="numeric">
                                    {typeof latVal === 'number' ? latVal.toFixed(5) : latVal !== undefined ? String(latVal) : '-'}
                                  </td>
                                  <td className="numeric">
                                    {typeof lonVal === 'number' ? lonVal.toFixed(5) : lonVal !== undefined ? String(lonVal) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Confirmation Actions */}
                    <div className="rm-confirm-actions">
                      <button className="rm-btn-cancel" onClick={handleNewUpload}>
                        Cancel
                      </button>
                      <button
                        className="rm-btn-confirm-process"
                        onClick={handleProcess}
                        disabled={isProcessing || !analysis.latitudeColumn || !analysis.longitudeColumn}
                      >
                        {isProcessing ? 'Processing…' : 'Confirm & Process →'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rm-confirm-empty-state">
                    <div className="rm-empty-icon">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>
                        <path d="M8 8H16M8 12H16M8 16H12" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="rm-empty-text">Upload a workbook to review detected coordinate data.</div>
                    <div className="rm-empty-subtext">Coordinates and sheet structure will appear here automatically.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SCREEN 2: RESULTS ────────────────────────────────────── */}
      {screen === 'results' && result && displayedSummary && (
        <div className={`rm-results-workspace-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`} style={{ position: 'relative' }}>
          {/* FLOATING EXPAND TAB (Visible only when sidebar is collapsed) */}
          {sidebarCollapsed && (
            <button
              className="rm-sidebar-expand-tab"
              onClick={() => setSidebarCollapsed(false)}
              title="Show Sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Sidebar</span>
            </button>
          )}

          {/* LEFT SIDEBAR (Dark Navy, Collapsible) */}
          <aside className={`rm-results-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            {/* Sidebar Top Section & Collapse Button */}
            <div className="rm-sidebar-header">
              <div style={{ flex: 1 }}>
                <button className="rm-sidebar-btn active" style={{ cursor: 'default' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 13L7 5L11 9L14 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="3" cy="13" r="1.5" fill="currentColor"/>
                    <circle cx="7" cy="5" r="1.5" fill="currentColor"/>
                    <circle cx="11" cy="9" r="1.5" fill="currentColor"/>
                    <circle cx="14" cy="3" r="1.5" fill="currentColor"/>
                  </svg>
                  Process Route
                </button>
              </div>
              <button
                className="rm-sidebar-collapse-btn"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse Sidebar"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Route Selection (if multi-route) */}
            {result.routes.length > 1 && (
              <div className="rm-sidebar-section">
                <div className="rm-sidebar-section-title">ROUTES</div>

                {/* ALL ROUTES BUTTON */}
                <button
                  className={`rm-sidebar-btn ${isAllSelected ? 'active' : ''}`}
                  onClick={() => handleFilterChange('all')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  All ({result.routes.map((r) => r.name).join(' & ')})
                </button>

                {/* INDIVIDUAL ROUTE BUTTONS */}
                {result.routes.map((r) => {
                  const cls = classifyRoute(r.name);
                  const color = ROUTE_COLORS[cls];
                  const isRouteActive = !isAllSelected && activeRoutes.some((ar) => ar.uid === r.uid);
                  return (
                    <button
                      key={r.uid}
                      className={`rm-sidebar-btn ${isRouteActive ? 'active' : ''}`}
                      onClick={() => handleFilterChange(r.uid)}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: color,
                          display: 'inline-block',
                          flexShrink: 0,
                          boxShadow: `0 0 6px ${color}88`,
                        }}
                      />
                      {r.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Export Section */}
            <div className="rm-sidebar-section">
              <div className="rm-sidebar-section-title">EXPORT</div>
              <button className="rm-sidebar-btn" onClick={handleExportExcel}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 5L11 11M11 5L5 11" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Excel Report
              </button>
              <button className="rm-sidebar-btn" onClick={handleExportKML}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                  <ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.2"/>
                  <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                KML Export
              </button>
            </div>

            {/* Bottom Links */}
            <div className="rm-sidebar-bottom-section">
              <button className="rm-sidebar-btn" onClick={() => setActiveModal('accuracy')}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 7V11M8 5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                About
              </button>
              <button className="rm-sidebar-btn" onClick={() => setActiveModal('how-it-works')}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M6.5 6C6.5 5.2 7.2 4.5 8 4.5C8.8 4.5 9.5 5.2 9.5 6C9.5 7 8 7.5 8 9M8 11.5V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Help
              </button>

              <div className="rm-sidebar-footer-note">
                All processing is done in your browser.<br />Your data is never uploaded.
              </div>
            </div>
          </aside>

          {/* MAIN WORKSPACE CONTENT */}
          <main className="rm-results-main">
            <div className="rm-results-grid">
              {/* LEFT COLUMN: MEASUREMENT SUMMARY + DATA TABLES */}
              <div className="rm-results-left-col">
                {/* 1. Distance Summary Card */}
                <div className="rm-card rm-summary-card">
                  <div className="rm-summary-title">
                    Coordinate-Derived Route Distance {result.routes.length > 1 && `(${displayedSummary.name})`}
                  </div>
                  <div className="rm-summary-dist-m">
                    {formatDistanceMetres(displayedSummary.totalDistanceMetres)}
                  </div>
                  <div className="rm-summary-dist-km">
                    {formatDistanceKilometres(displayedSummary.totalDistanceMetres)}
                  </div>

                  {/* 4 Summary Metrics */}
                  <div className="rm-summary-metrics-grid">
                    <div className="rm-metric-box">
                      <div className="rm-metric-top">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6" stroke="#60a5fa" strokeWidth="1.5"/>
                          <circle cx="8" cy="8" r="2" fill="#3b82f6"/>
                        </svg>
                        <span className="rm-metric-val">{displayedSummary.coordinateCount}</span>
                      </div>
                      <span className="rm-metric-label">POINTS</span>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-top">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M2 10L6 6L10 10L14 6" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="rm-metric-val">{displayedSummary.segmentCount}</span>
                      </div>
                      <span className="rm-metric-label">SEGMENTS</span>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-top">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M4 12L12 4M12 4H6M12 4V10" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="rm-metric-val">{displayedSummary.startPoint.displayLabel}</span>
                      </div>
                      <span className="rm-metric-label">START</span>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-top">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M4 4L12 12M12 12H6M12 12V6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="rm-metric-val">{displayedSummary.endPoint.displayLabel}</span>
                      </div>
                      <span className="rm-metric-label">END</span>
                    </div>
                  </div>
                </div>

                {/* 2. Data Tabs Card */}
                <div className="rm-card rm-tabs-card">
                  <div className="rm-data-tabs">
                    <button
                      className={`rm-data-tab ${activeTab === 'coordinates' ? 'active' : ''}`}
                      onClick={() => setActiveTab('coordinates')}
                    >
                      Coordinates ({displayedSummary.coordinateCount})
                    </button>
                    <button
                      className={`rm-data-tab ${activeTab === 'segments' ? 'active' : ''}`}
                      onClick={() => setActiveTab('segments')}
                    >
                      Segments ({displayedSummary.segmentCount})
                    </button>
                  </div>

                  <div className="rm-data-table-container">
                    {activeTab === 'coordinates' && (
                      <table className="rm-data-table">
                        <thead>
                          <tr>
                            <th>SEQ</th>
                            {isAllSelected && result.routes.length > 1 && <th>ROUTE</th>}
                            <th>POINT</th>
                            <th>LATITUDE</th>
                            <th>LONGITUDE</th>
                            <th>CUMULATIVE DISTANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedSummary.pointDistances.map((pd, idx) => (
                            <tr key={`${pd.routeName}_${pd.point.uid}_${idx}`}>
                              <td className="rm-seq-col">{idx + 1}</td>
                              {isAllSelected && result.routes.length > 1 && (
                                <td>
                                  <span className={`rm-route-tag rm-route-tag-${pd.routeCls}`}>
                                    {pd.routeName}
                                  </span>
                                </td>
                              )}
                              <td className="rm-point-label">{pd.point.displayLabel}</td>
                              <td className="numeric">{formatCoordinate(pd.point.latitude)}</td>
                              <td className="numeric">{formatCoordinate(pd.point.longitude)}</td>
                              <td className="numeric font-medium">{formatDistanceMetres(pd.cumulativeDistance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {activeTab === 'segments' && (
                      <table className="rm-data-table">
                        <thead>
                          <tr>
                            <th>SEGMENT</th>
                            {isAllSelected && result.routes.length > 1 && <th>ROUTE</th>}
                            <th>FROM</th>
                            <th>TO</th>
                            <th>SEGMENT DISTANCE</th>
                            <th>CUMULATIVE DISTANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedSummary.segments.map((seg, idx) => (
                            <tr key={`${seg.routeName}_${seg.segmentNumber}_${idx}`}>
                              <td className="rm-seq-col">{idx + 1}</td>
                              {isAllSelected && result.routes.length > 1 && (
                                <td>
                                  <span className={`rm-route-tag rm-route-tag-${seg.routeCls}`}>
                                    {seg.routeName}
                                  </span>
                                </td>
                              )}
                              <td>{seg.fromPoint.displayLabel}</td>
                              <td>{seg.toPoint.displayLabel}</td>
                              <td className="numeric font-medium">{formatDistanceMetres(seg.distanceMetres)}</td>
                              <td className="numeric font-medium">{formatDistanceMetres(seg.cumulativeDistanceMetres)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: DOMINANT SATELLITE MAP */}
              <div className="rm-results-right-col">
                <RouteMap
                  route={activeRoutes[0] || null}
                  allRoutes={result.routes}
                  selectedFilter={selectedFilter}
                  onFilterChange={handleFilterChange}
                  apiKey={apiKey}
                  onApiKeyChange={handleApiKeyChange}
                />
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  )}

      {/* ─── MODAL OVERLAYS ────────────────────────────────────────── */}
      <HowItWorksModal
        isOpen={activeModal === 'how-it-works'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={() => { setActiveModal(null); setScreen('upload-confirm'); }}
      />

      <AccuracyModal
        isOpen={activeModal === 'accuracy'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={() => { setActiveModal(null); setScreen('upload-confirm'); }}
      />

      <PrivacyModal
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={() => { setActiveModal(null); setScreen('upload-confirm'); }}
      />
    </div>
  );
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
