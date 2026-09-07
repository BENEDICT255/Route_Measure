import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import type { WorkbookAnalysis, RawSheetData, DetectedColumn } from '../types/workbook';
import { DetectionConfidence } from '../types/workbook';
import type { MeasurementResult } from '../types/coordinates';
import type {
  MeasurementMode,
  DistanceWorkbookAnalysis,
  DestinationSite,
  StartingPoint,
  DistanceAnalysisResult,
} from '../types/distance';
import { validateFile, readWorkbook, generateFileHash } from '../workbook/workbookReader';
import { selectBestSheet } from '../workbook/workbookAnalysis';
import { processWorkbook } from '../workbook/normalization';
import { analyzeDistanceWorkbook, findRealDistanceTable } from '../workbook/distanceDetection';
import { parseDestinationSites, getUniqueRegions } from '../workbook/distanceParser';
import { calculateDistances, recomputeRanks } from '../measurement/distanceCalculator';
import { exportDistanceExcel } from '../exports/distanceExport';
import { exportDistanceKml } from '../exports/distanceKmlExport';
import { formatDistanceMetres, formatDistanceKilometres, formatCoordinate, generateUid } from '../utils/formatters';
import { ACCEPTED_FILE_EXTENSIONS, MAX_FILE_SIZE_DISPLAY } from '../utils/constants';
import { ValidationSeverity } from '../types/coordinates';
import { RouteMap } from '../components/RouteMap';
import { DistanceMap } from '../components/DistanceMap';
import { AssignmentModal } from '../components/AssignmentModal';
import { classifyRoute, ROUTE_COLORS } from '../mapping/GoogleMapsAdapter';
import { HowItWorksModal, AccuracyModal, PrivacyModal } from '../components/LandingModals';
import { AssistantButton } from '../components/AssistantButton';
import { AssistantPanel } from '../components/AssistantPanel';
import { ReviewDataModal } from '../components/ReviewDataModal';
import { ManualColumnReviewCard } from '../components/ManualColumnReviewCard';
import type {
  AssistantPreparationResult,
  AssistantTargetMode,
  NormalizedPointRecord,
  NormalizedDistanceRecord,
} from '../assistant/types';

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

  // Route mode state
  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [sheetData, setSheetData] = useState<RawSheetData | null>(null);
  const [result, setResult] = useState<MeasurementResult | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'coordinates' | 'segments'>('coordinates');

  // Distance mode state
  const [distAnalysis, setDistAnalysis] = useState<DistanceWorkbookAnalysis | null>(null);
  const [destinations, setDestinations] = useState<DestinationSite[]>([]);
  const [startingPoints, setStartingPoints] = useState<StartingPoint[]>([]);
  const [distResult, setDistResult] = useState<DistanceAnalysisResult | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDistanceSiteUid, setSelectedDistanceSiteUid] = useState<string | null>(null);
  const [distStartingPointFilter, setDistStartingPointFilter] = useState<string>('all');
  const [distRegionFilter, setDistRegionFilter] = useState<string>('all');
  const [distRankSort, setDistRankSort] = useState<'furthest' | 'nearest'>('furthest');
  const [distSearchQuery, setDistSearchQuery] = useState<string>('');

  // Assistant & Manual review state
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [reviewModalResult, setReviewModalResult] = useState<AssistantPreparationResult | null>(null);
  const [isManualReviewOpen, setIsManualReviewOpen] = useState<boolean>(false);
  const [detectionUncertain, setDetectionUncertain] = useState<boolean>(false);
  const [assistantPreparedResult, setAssistantPreparedResult] = useState<AssistantPreparationResult | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<'how-it-works' | 'accuracy' | 'privacy' | null>(null);

  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('gmaps_api_key') || (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
  );

  // Ensure persisted theme is applied
  useEffect(() => {
    const saved = localStorage.getItem('routemeasure_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gmaps_api_key', newKey);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── File Handler ───────────────────────────────────────────────
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
    generateFileHash(file).then(setFileHash);

    try {
      if (measurementMode === 'distance') {
        // Distance mode detection
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: false, raw: true });
        const sheetNames = workbook.SheetNames;
        if (sheetNames.length === 0) {
          setError('The workbook contains no readable worksheets.');
          return;
        }

        const firstSheetName = sheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const allRawData: (string | number | null | undefined)[][] = worksheet
          ? XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true })
          : [];

        const tableResult = findRealDistanceTable(allRawData, firstSheetName);
        const analysis = analyzeDistanceWorkbook(tableResult.sheetData, allRawData, sheetNames);
        setDistAnalysis(analysis);

        if (!analysis.latitudeColumn || !analysis.longitudeColumn) {
          setError('Could not detect latitude and longitude columns. Please ensure your workbook contains valid coordinate columns.');
          return;
        }

        const { destinations: parsedDests } = parseDestinationSites(
          tableResult.sheetData,
          analysis,
          file.name
        );
        setDestinations(parsedDests);

        // Pre-populate detected reference points from metadata (e.g. Amanzi Warehouse)
        if (analysis.detectedReferencePoints.length > 0) {
          setStartingPoints(analysis.detectedReferencePoints);
        } else {
          setStartingPoints([]);
        }
      } else {
        // Route mode detection (LV & MV Route)
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

        const isUncertain =
          !best.analysis.latitudeColumn ||
          !best.analysis.longitudeColumn ||
          best.analysis.hasAmbiguity ||
          best.analysis.latitudeColumn.confidence === DetectionConfidence.Low ||
          best.analysis.longitudeColumn.confidence === DetectionConfidence.Low;

        setDetectionUncertain(isUncertain);
      }
    } catch (err) {
      setError(
        `Failed to read the workbook: ${err instanceof Error ? err.message : 'Unknown error'}.`
      );
    }
  }, [measurementMode]);

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

  // ─── Starting Point Assignment Handlers (Distance Mode) ─────────
  const handleAssignStartingPoint = useCallback((destUids: string[], sp: StartingPoint) => {
    // Add to starting points library if not already present
    setStartingPoints((prev) => {
      if (prev.some((s) => s.uid === sp.uid)) return prev;
      return [...prev, sp];
    });

    setDestinations((prev) =>
      prev.map((d) =>
        destUids.includes(d.uid) && d.status !== 'invalid'
          ? { ...d, assignedStartingPointUid: sp.uid, status: 'assigned' as const }
          : d
      )
    );
  }, []);

  const handleClearAssignment = useCallback((destUids: string[]) => {
    setDestinations((prev) =>
      prev.map((d) =>
        destUids.includes(d.uid) && d.status !== 'invalid'
          ? { ...d, assignedStartingPointUid: null, status: 'unassigned' as const }
          : d
      )
    );
  }, []);

  const handleExcludeDestinations = useCallback((destUids: string[]) => {
    setDestinations((prev) =>
      prev.map((d) =>
        destUids.includes(d.uid) ? { ...d, status: 'excluded' as const } : d
      )
    );
  }, []);

  const handleIncludeDestinations = useCallback((destUids: string[]) => {
    setDestinations((prev) =>
      prev.map((d) =>
        destUids.includes(d.uid) && d.status === 'excluded'
          ? { ...d, status: d.assignedStartingPointUid ? ('assigned' as const) : ('unassigned' as const) }
          : d
      )
    );
  }, []);

  const handleAddStartingPoint = useCallback((sp: StartingPoint) => {
    setStartingPoints((prev) => {
      if (prev.some((s) => s.uid === sp.uid || s.name.toLowerCase() === sp.name.toLowerCase())) {
        return prev;
      }
      return [...prev, sp];
    });
  }, []);

  const handleRemoveStartingPoint = useCallback((uid: string) => {
    setStartingPoints((prev) => prev.filter((sp) => sp.uid !== uid));
    setDestinations((prev) =>
      prev.map((d) =>
        d.assignedStartingPointUid === uid
          ? { ...d, assignedStartingPointUid: null, status: 'unassigned' as const }
          : d
      )
    );
  }, []);

  // Distance mode assignment summary
  const distanceAssignmentSummary = useMemo(() => {
    const total = destinations.length;
    const assigned = destinations.filter((d) => d.status === 'assigned').length;
    const unassigned = destinations.filter((d) => d.status === 'unassigned').length;
    const excluded = destinations.filter((d) => d.status === 'excluded').length;
    const invalid = destinations.filter((d) => d.status === 'invalid').length;

    // Breakdown per starting point
    const breakdown: { sp: StartingPoint; count: number }[] = [];
    const countMap = new Map<string, number>();
    for (const d of destinations) {
      if (d.status === 'assigned' && d.assignedStartingPointUid) {
        countMap.set(d.assignedStartingPointUid, (countMap.get(d.assignedStartingPointUid) || 0) + 1);
      }
    }
    for (const sp of startingPoints) {
      const c = countMap.get(sp.uid) || 0;
      if (c > 0) breakdown.push({ sp, count: c });
    }

    return { total, assigned, unassigned, excluded, invalid, breakdown };
  }, [destinations, startingPoints]);

  const canConfirmDistance =
    distanceAssignmentSummary.unassigned === 0 && distanceAssignmentSummary.assigned > 0;

  // ─── Process / Calculate ─────────────────────────────────────────
  const handleProcess = useCallback(() => {
    setIsProcessing(true);
    setError(null);

    setTimeout(() => {
      try {
        if (measurementMode === 'distance') {
          // Calculate canonical independent point-to-point distances
          const distCalcResult = calculateDistances(
            destinations,
            startingPoints,
            fileName,
            distAnalysis?.selectedWorksheet || ''
          );
          setDistResult(distCalcResult);
          setDistStartingPointFilter('all');
          setSidebarCollapsed(true);
          setShowMap(false);
          setIsProcessing(false);
          setScreen('results');
        } else {
          // Calculate LV/MV route network
          if (!sheetData || !analysis) return;
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
          setSidebarCollapsed(true);
          setShowMap(false);
          setIsProcessing(false);
          setScreen('results');
        }
      } catch (err) {
        setError(`Processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsProcessing(false);
      }
    }, 150);
  }, [measurementMode, destinations, startingPoints, fileName, distAnalysis, sheetData, analysis]);

  const handleAssistantUseInRouteMeasure = useCallback(
    (
      modeOrResult: AssistantPreparationResult | AssistantTargetMode,
      pts?: NormalizedPointRecord[],
      sts?: NormalizedDistanceRecord[]
    ) => {
      let targetMode: AssistantTargetMode;
      let points: NormalizedPointRecord[];
      let sites: NormalizedDistanceRecord[];

      if (typeof modeOrResult === 'object' && 'mode' in modeOrResult) {
        targetMode = modeOrResult.mode;
        points = modeOrResult.points;
        sites = modeOrResult.sites;
      } else {
        targetMode = modeOrResult;
        points = pts || [];
        sites = sts || [];
      }

      setReviewModalResult(null);
      setIsAssistantOpen(false);

      if (targetMode === 'lv_mv') {
        const headers = ['Route Type', 'Point ID', 'Latitude', 'Longitude', 'Description'];
        const rows = points.map((p) => [
          p.routeType,
          p.pointId,
          p.latitude,
          p.longitude,
          p.description || '',
        ]);

        const customSheetData: RawSheetData = {
          sheetName: 'AI Prepared Route',
          headers,
          rows,
          totalRowCount: rows.length + 1,
        };

        const latCol: DetectedColumn = {
          columnIndex: 2,
          originalHeader: 'Latitude',
          confidence: DetectionConfidence.High,
          reason: 'Assistant verified',
        };
        const lonCol: DetectedColumn = {
          columnIndex: 3,
          originalHeader: 'Longitude',
          confidence: DetectionConfidence.High,
          reason: 'Assistant verified',
        };
        const ptCol: DetectedColumn = {
          columnIndex: 1,
          originalHeader: 'Point ID',
          confidence: DetectionConfidence.High,
          reason: 'Assistant verified',
        };
        const routeCol: DetectedColumn = {
          columnIndex: 0,
          originalHeader: 'Route Type',
          confidence: DetectionConfidence.High,
          reason: 'Assistant verified',
        };
        const descCol: DetectedColumn = {
          columnIndex: 4,
          originalHeader: 'Description',
          confidence: DetectionConfidence.High,
          reason: 'Assistant verified',
        };

        const customAnalysis: WorkbookAnalysis = {
          worksheetNames: ['AI Prepared Route'],
          selectedWorksheet: 'AI Prepared Route',
          headerRow: 0,
          latitudeColumn: latCol,
          longitudeColumn: lonCol,
          pointColumn: ptCol,
          routeColumn: routeCol,
          descriptionColumn: descCol,
          orderColumn: null,
          coordinateRowCount: points.length,
          previewRows: points.slice(0, 5).map((p, i) => ({
            Row: i + 2,
            Latitude: p.latitude ?? '',
            Longitude: p.longitude ?? '',
          })),
          allHeaders: headers,
          hasAmbiguity: false,
          orderingMethod: 'row',
          orderingDescription: 'Sequenced network polyline (AI prepared)',
        };

        setSheetData(customSheetData);
        setAnalysis(customAnalysis);
        setMeasurementMode('route');
        setFileName('RouteMeasure_Assistant_Data.xlsx');

        const measurementResult = processWorkbook(customSheetData, customAnalysis, 'RouteMeasure_Assistant_Data.xlsx');
        setResult(measurementResult);
        setSelectedFilter('all');
        setSidebarCollapsed(true);
        setShowMap(false);
        setScreen('results');
      } else {
        const newDests: DestinationSite[] = sites.map((s, idx) => ({
          uid: s.id || generateUid(),
          siteId: s.siteId,
          legacySiteId: s.legacySiteId,
          siteName: s.siteName,
          region: s.region || 'Default Region',
          latitude: s.latitude!,
          longitude: s.longitude!,
          description: s.description,
          assignedStartingPointUid: null,
          status: 'unassigned' as const,
          sourceRow: idx + 2,
          sourceSheet: 'AI Prepared Sites',
          metadata: {
            'Site ID': s.siteId,
            'Site Name': s.siteName,
            'Region': s.region || '',
            'Latitude': s.latitude!,
            'Longitude': s.longitude!,
          },
        }));

        setDestinations(newDests);
        setMeasurementMode('distance');
        setFileName('RouteMeasure_Assistant_Destinations.xlsx');
        setDistStartingPointFilter('all');
        setIsAssignModalOpen(true);
      }
    },
    []
  );

  const handleNewUpload = useCallback(() => {
    setScreen('upload-confirm');
    setIsProcessing(false);
    setError(null);
    setDetectionUncertain(false);
    setIsManualReviewOpen(false);
    setFileObject(null);
    setFileName('');
    setFileSizeStr('');
    setFileHash('');
    setAnalysis(null);
    setSheetData(null);
    setResult(null);
    setSelectedFilter('all');
    setActiveTab('coordinates');
    setDistAnalysis(null);
    setDestinations([]);
    setStartingPoints([]);
    setDistResult(null);
    setSelectedDistanceSiteUid(null);
    setDistStartingPointFilter('all');
    setDistRegionFilter('all');
    setDistRankSort('furthest');
    setDistSearchQuery('');
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

  // Compute active routes and displayed summary dynamically for Route mode
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
        r.points.map((pt, idx) => ({
          routeName: r.name,
          routeCls: classifyRoute(r.name),
          point: pt,
          distanceFromPrevious: idx === 0 ? 0 : r.segments[idx - 1]?.distanceMetres || 0,
          cumulativeDistance: idx === 0 ? 0 : r.segments[idx - 1]?.cumulativeDistanceMetres || 0,
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
        pointDistances: matched.points.map((pt, idx) => ({
          routeName: matched.name,
          routeCls: classifyRoute(matched.name),
          point: pt,
          distanceFromPrevious: idx === 0 ? 0 : matched.segments[idx - 1]?.distanceMetres || 0,
          cumulativeDistance: idx === 0 ? 0 : matched.segments[idx - 1]?.cumulativeDistanceMetres || 0,
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
      const sheet = workbook.addWorksheet('Route Summary');

      // Title block
      sheet.addRow(['TRANSMISSION LINE ROUTE MEASUREMENT REPORT']);
      sheet.addRow([`Route: ${displayedSummary.name}`]);
      sheet.addRow([`Total Distance: ${formatDistanceKilometres(displayedSummary.totalDistanceMetres)} (${formatDistanceMetres(displayedSummary.totalDistanceMetres)})`]);
      sheet.addRow([`Total Coordinate Points: ${displayedSummary.coordinateCount}`]);
      sheet.addRow([`Total Line Segments: ${displayedSummary.segmentCount}`]);
      sheet.addRow([`Start Point: ${displayedSummary.startPoint.displayLabel}`]);
      sheet.addRow([`End Point: ${displayedSummary.endPoint.displayLabel}`]);
      sheet.addRow([`Source File: ${fileName}`]);
      sheet.addRow([`Calculation Method: WGS84 Geodesic (Karney/GeographicLib)`]);
      sheet.addRow([`Generated: ${new Date().toISOString()}`]);
      sheet.addRow([]);

      // Headers
      const headerRow = sheet.addRow(['Seq', 'Route', 'Point', 'Latitude', 'Longitude', 'Cumulative Distance (m)']);
      headerRow.font = { bold: true };

      displayedSummary.pointDistances.forEach((pd, idx) => {
        sheet.addRow([
          idx + 1,
          pd.routeName,
          pd.point.displayLabel,
          pd.point.latitude,
          pd.point.longitude,
          pd.cumulativeDistance,
        ]);
      });

      sheet.columns = [
        { width: 8 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 16 },
        { width: 26 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `${fileName.replace(/\.xlsx$/i, '')}_RouteMeasure_Report.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  }, [result, displayedSummary, fileName]);

  const handleExportKML = useCallback(() => {
    if (!result || !displayedSummary) return;

    try {
      const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(displayedSummary.name)}</name>
    <description>Total Distance: ${formatDistanceKilometres(displayedSummary.totalDistanceMetres)}</description>
    <Placemark>
      <name>${escapeXml(displayedSummary.name)} Path</name>
      <LineString>
        <coordinates>
${displayedSummary.pointDistances.map((pd) => `          ${pd.point.longitude},${pd.point.latitude},0`).join('\n')}
        </coordinates>
      </LineString>
    </Placemark>
${displayedSummary.pointDistances
  .map(
    (pd, idx) => `    <Placemark>
      <name>${escapeXml(pd.point.displayLabel)}</name>
      <description>Sequence: ${idx + 1} | Cumulative: ${formatDistanceMetres(pd.cumulativeDistance)}</description>
      <Point>
        <coordinates>${pd.point.longitude},${pd.point.latitude},0</coordinates>
      </Point>
    </Placemark>`
  )
  .join('\n')}
  </Document>
</kml>`;

      const blob = new Blob([kmlContent], {
        type: 'application/vnd.google-earth.kml+xml',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.xlsx$/i, '')}_Route.kml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export KML:', err);
    }
  }, [result, displayedSummary, fileName]);

  const handleExportDistExcel = useCallback(async () => {
    if (!distResult) return;
    try {
      await exportDistanceExcel(distResult, fileHash);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [distResult, fileHash]);

  const handleExportDistKml = useCallback(() => {
    if (!distResult) return;
    exportDistanceKml(distResult);
  }, [distResult]);

  // Filtered distance results for Results table
  const filteredDistResults = useMemo(() => {
    if (!distResult) return [];
    let list = distResult.results;

    if (distStartingPointFilter !== 'all') {
      list = list.filter((r) => r.startingPointUid === distStartingPointFilter);
    }

    if (distRegionFilter !== 'all') {
      list = list.filter((r) => {
        const dest = distResult.destinations.find((d) => d.uid === r.destinationUid);
        return dest?.region === distRegionFilter;
      });
    }

    if (distSearchQuery.trim()) {
      const q = distSearchQuery.toLowerCase();
      list = list.filter((r) => {
        const dest = distResult.destinations.find((d) => d.uid === r.destinationUid);
        if (!dest) return false;
        return (
          (dest.siteId && dest.siteId.toLowerCase().includes(q)) ||
          (dest.siteName && dest.siteName.toLowerCase().includes(q)) ||
          (dest.legacySiteId && dest.legacySiteId.toLowerCase().includes(q)) ||
          (dest.region && dest.region.toLowerCase().includes(q))
        );
      });
    }

    return recomputeRanks(list, distRankSort);
  }, [distResult, distStartingPointFilter, distRegionFilter, distSearchQuery, distRankSort]);

  // Distance regions
  const distRegions = useMemo(() => {
    if (!distResult) return [];
    return getUniqueRegions(distResult.destinations);
  }, [distResult]);

  return (
    <div className="rm-workspace-root">
      {/* ─── TOP HEADER ─── */}
      <header className="rm-top-header">
        <div className="rm-top-header-inner">
          <div className="rm-header-left-group">
            <div className="editorial-brand" onClick={() => navigate('/')}>
              <div className="editorial-logo-icon">
                <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="#2563eb" fillOpacity="0.16" />
                  <path d="M8 24L12 8L16 18L20 12L24 24" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="8" r="2.2" fill="#2563eb" />
                  <circle cx="16" cy="18" r="2.2" fill="#2563eb" />
                  <circle cx="20" cy="12" r="2.2" fill="#2563eb" />
                </svg>
              </div>
              <span className="editorial-brand-name">RouteMeasure</span>
            </div>
          </div>

          <div className="rm-header-center-badge">
            {screen === 'results' && measurementMode ? (
              <div className="rm-header-mode-indicator">
                <span className="rm-header-mode-tag">
                  {measurementMode === 'route' ? 'LV & MV Route' : 'Distance Between Points'}
                </span>
                <button className="rm-header-change-type-btn" onClick={handleChangeMode}>
                  Change Type
                </button>
              </div>
            ) : (
              <span>Precision Geospatial Measurement</span>
            )}
          </div>

          <div className="rm-header-actions">
            <button className="rm-btn-clear" onClick={handleClear}>
              Clear
            </button>
            <button className="rm-btn-new-upload" onClick={handleClear}>
              + New Upload
            </button>
          </div>
        </div>
      </header>

      {/* ─── MODE SELECTION SCREEN (when on upload-confirm screen) ─── */}
      {screen === 'upload-confirm' && (
        <div className="rm-upload-confirm-page">
          <div className="rm-geospatial-watermark" aria-hidden="true">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="crosshair-grid-m" width="120" height="120" patternUnits="userSpaceOnUse">
                  <path d="M 60 55 L 60 65 M 55 60 L 65 60" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.06" />
                  <circle cx="60" cy="60" r="1.5" fill="#3b82f6" fillOpacity="0.05" />
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
      )}

      {/* ─── UPLOAD MODAL OVERLAY (appears over mode selection) ──────── */}
      {measurementMode && screen === 'upload-confirm' && (
        <div className="rm-upload-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) { setMeasurementMode(null); handleNewUpload(); } }}>
          <div className="rm-upload-modal-content">
            <button className="rm-upload-modal-close" onClick={() => { setMeasurementMode(null); handleNewUpload(); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>

            <div className="rm-upload-modal-header">
              <div className="rm-upload-modal-title">
                {measurementMode === 'route' ? 'Upload Route Coordinates' : 'Upload Site Data'}
              </div>
              <div className="rm-upload-modal-subtitle">
                {measurementMode === 'route'
                  ? 'Upload an Excel workbook with LV/MV network coordinate sequences'
                  : 'Upload an Excel workbook containing destination site coordinates.'}
              </div>
            </div>

            {error && !detectionUncertain && (
              <div className="rm-alert-box rm-alert-error">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5V9M8 11.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div style={{ whiteSpace: 'pre-line' }}>{error}</div>
              </div>
            )}

            {/* Detection Uncertain Notice (Section 44) */}
            {detectionUncertain && (
              <div
                className="rm-alert-box rm-alert-warn"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '16px',
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '10px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#d97706" strokeWidth="1.5"/>
                    <path d="M8 5V9M8 11.5V12" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#b45309' }}>
                    We couldn't confidently identify this workbook.
                  </div>
                </div>
                <div style={{ fontSize: '12.5px', color: '#78350f' }}>
                  Automatic detection could not find recognizable coordinate headers. Choose how you would like to proceed:
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="rm-btn-confirm-process"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                    onClick={() => setIsManualReviewOpen(true)}
                  >
                    Review Columns
                  </button>
                  <button
                    type="button"
                    className="rm-btn-ai-hint"
                    onClick={() => setIsAssistantOpen(true)}
                  >
                    ✦ Prepare with RouteMeasure Assistant
                  </button>
                  <button
                    type="button"
                    className="rm-btn-cancel"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                    onClick={handleNewUpload}
                  >
                    Choose Another File
                  </button>
                </div>
              </div>
            )}

            <div className="rm-upload-modal-grid">
              {/* LEFT: Upload */}
              <div className="rm-card rm-upload-card">
                <h2 className="rm-card-title">
                  {measurementMode === 'route' ? 'Upload Coordinate File' : 'Upload Site Data'}
                </h2>
                <p className="rm-card-subtitle">
                  {measurementMode === 'route'
                    ? 'Upload an Excel workbook containing latitude and longitude coordinates.'
                    : 'Upload an Excel workbook containing destination site coordinates.'}
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
                      <rect width="48" height="48" rx="24" fill="var(--rm-surface-subtle)" />
                      <path d="M24 16V28M24 16L19 21M24 16L29 21" stroke="var(--rm-text-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 30C12.5 30 11 28.5 11 27C11 25.5 12 24.2 13.5 24C14 20.5 17 18 20.5 18C23.5 18 26 19.8 27 22.5C28.5 22.5 30 23.5 30.5 25C32 25.5 33 27 33 28.5C33 30.5 31.5 32 29.5 32H15" stroke="var(--rm-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

              {/* RIGHT: Confirm Detected Data */}
              <div className="rm-card rm-confirm-card">
                <h2 className="rm-card-title">Confirm Detected Data</h2>
                <p className="rm-card-subtitle">
                  Please review and confirm the detected data before processing.
                </p>

                {/* DISTANCE MODE CONFIRM CARD */}
                {measurementMode === 'distance' && distAnalysis ? (
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
                        <div className="rm-field-value">{distAnalysis.selectedWorksheet}</div>
                      </div>

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3V13M8 13L4 9M8 13L12 9" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Site ID Column
                        </div>
                        <div className="rm-field-value">{distAnalysis.siteIdColumn?.originalHeader || 'Not detected'}</div>
                      </div>

                      {distAnalysis.legacySiteIdColumn && (
                        <div className="rm-field-row">
                          <div className="rm-field-label">
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                              <path d="M8 5V8L10 10" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                            Legacy Site ID Column
                          </div>
                          <div className="rm-field-value">{distAnalysis.legacySiteIdColumn.originalHeader}</div>
                        </div>
                      )}

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M3 4H13M3 8H13M3 12H9" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                          Site Name Column
                        </div>
                        <div className="rm-field-value">{distAnalysis.siteNameColumn?.originalHeader || 'Not detected'}</div>
                      </div>

                      {distAnalysis.regionColumn && (
                        <div className="rm-field-row">
                          <div className="rm-field-label">
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                              <circle cx="8" cy="8" r="2" fill="#64748b"/>
                            </svg>
                            Region Column
                          </div>
                          <div className="rm-field-value">{distAnalysis.regionColumn.originalHeader}</div>
                        </div>
                      )}

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3V13M8 13L4 9M8 13L12 9" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Latitude Column
                        </div>
                        <div className="rm-field-value">{distAnalysis.latitudeColumn?.originalHeader || 'Not detected'}</div>
                      </div>

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Longitude Column
                        </div>
                        <div className="rm-field-value">{distAnalysis.longitudeColumn?.originalHeader || 'Not detected'}</div>
                      </div>

                      <div className="rm-field-row">
                        <div className="rm-field-label">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                            <circle cx="8" cy="8" r="2" fill="#64748b"/>
                          </svg>
                          Destination Sites
                        </div>
                        <div className="rm-field-value font-bold">{distAnalysis.siteCount}</div>
                      </div>
                    </div>

                    {/* Preview Table for Distance Mode */}
                    <div className="rm-preview-section">
                      <div className="rm-preview-header">Destination Preview (first 5 rows)</div>
                      <div className="rm-preview-table-wrap">
                        <table className="rm-preview-table">
                          <thead>
                            <tr>
                              <th>HT SITE ID</th>
                              <th>SITE NAME</th>
                              <th>REGION/WHS</th>
                              <th>LATITUDE</th>
                              <th>LONGITUDE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {destinations.slice(0, 5).map((dest, idx) => (
                              <tr key={dest.uid || idx}>
                                <td className="font-mono font-bold">{dest.siteId || '—'}</td>
                                <td className="font-semibold">{dest.siteName || '—'}</td>
                                <td>{dest.region || '—'}</td>
                                <td className="numeric font-mono">{dest.latitude.toFixed(5)}</td>
                                <td className="numeric font-mono">{dest.longitude.toFixed(5)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* STARTING POINT ASSIGNMENT SECTION (BEFORE CONFIRM) */}
                    <div className="rm-assignment-progress-card">
                      <div className="rm-assign-progress-header">
                        <div className="rm-assign-progress-left">
                          <div className="rm-assign-icon-bubble">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </div>
                          <div>
                            <div className="rm-assign-progress-title">Starting Point Assignment</div>
                            <div className="rm-assign-progress-subtitle">
                              {distanceAssignmentSummary.unassigned === 0 && distanceAssignmentSummary.assigned > 0
                                ? 'All destination sites ready for calculation'
                                : 'Every destination site must be paired with an origin'}
                            </div>
                          </div>
                        </div>

                        <div className="rm-assign-progress-badge-wrap">
                          {distanceAssignmentSummary.unassigned === 0 && distanceAssignmentSummary.assigned > 0 ? (
                            <span className="rm-badge-assigned-complete">
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              {distanceAssignmentSummary.assigned} of {distanceAssignmentSummary.total} Sites Assigned
                            </span>
                          ) : (
                            <span className="rm-badge-assigned-pending">
                              <span className="rm-pending-dot" />
                              {distanceAssignmentSummary.assigned} of {distanceAssignmentSummary.total} Sites Assigned
                            </span>
                          )}
                        </div>
                      </div>

                      {distanceAssignmentSummary.unassigned > 0 && (
                        <div className="rm-assign-alert-banner">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>
                            <strong>{distanceAssignmentSummary.unassigned} destination site{distanceAssignmentSummary.unassigned !== 1 ? 's' : ''}</strong> require a starting origin before calculation can proceed.
                          </span>
                        </div>
                      )}

                      {distanceAssignmentSummary.breakdown.length > 0 && (
                        <div className="rm-assign-breakdown-box">
                          <div className="rm-breakdown-caption">Active Starting Point Distribution:</div>
                          <div className="rm-breakdown-tags">
                            {distanceAssignmentSummary.breakdown.map(({ sp, count }: { sp: StartingPoint; count: number }) => (
                              <div key={sp.uid} className="rm-breakdown-tag">
                                <span className="rm-tag-dot" />
                                <span className="rm-tag-name">{sp.name}</span>
                                <span className="rm-tag-count">{count} site{count !== 1 ? 's' : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rm-assign-action-bar">
                        <button
                          type="button"
                          className={`rm-btn-open-assignment ${distanceAssignmentSummary.assigned > 0 ? 'is-edit' : 'is-primary'}`}
                          onClick={() => setIsAssignModalOpen(true)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>{distanceAssignmentSummary.assigned > 0 ? 'Modify Starting Point Assignments' : 'Assign Starting Points'}</span>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 2 }}>
                            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Confirmation Actions */}
                    <div className="rm-confirm-actions">
                      <button className="rm-btn-cancel" onClick={() => { setMeasurementMode(null); handleNewUpload(); }}>
                        Cancel
                      </button>
                      <button
                        className="rm-btn-confirm-process"
                        onClick={handleProcess}
                        disabled={!canConfirmDistance || isProcessing}
                        title={!canConfirmDistance ? 'Assign all included destination sites before confirming' : ''}
                      >
                        {isProcessing ? 'Calculating…' : 'Confirm & Process →'}
                      </button>
                    </div>
                  </>
                ) : isManualReviewOpen && sheetData ? (
                  <ManualColumnReviewCard
                    sheetData={sheetData}
                    initialAnalysis={analysis}
                    mode={measurementMode || 'route'}
                    onModeChange={(newM) => setMeasurementMode(newM)}
                    onConfirm={(customAnalysis) => {
                      setAnalysis(customAnalysis);
                      setIsManualReviewOpen(false);
                      setDetectionUncertain(false);
                      setError(null);
                    }}
                    onCancel={() => setIsManualReviewOpen(false)}
                    onOpenAssistant={() => setIsAssistantOpen(true)}
                  />
                ) : measurementMode === 'route' && analysis ? (
                  /* ROUTE MODE CONFIRM CARD (LV & MV ROUTE) */
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
                              const latVal = analysis.latitudeColumn ? (row[analysis.latitudeColumn.originalHeader] ?? row['Latitude']) : undefined;
                              const lonVal = analysis.longitudeColumn ? (row[analysis.longitudeColumn.originalHeader] ?? row['Longitude']) : undefined;
                              return (
                                <tr key={idx}>
                                  <td className="rm-row-num">{(analysis.headerRow ?? 0) + 2 + idx}</td>
                                  <td className="numeric font-mono">
                                    {typeof latVal === 'number' ? latVal.toFixed(5) : latVal !== undefined ? String(latVal) : '-'}
                                  </td>
                                  <td className="numeric font-mono">
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
                      <button className="rm-btn-cancel" onClick={() => { setMeasurementMode(null); handleNewUpload(); }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rm-btn-manual-columns"
                        onClick={() => setIsManualReviewOpen(true)}
                      >
                        Review / Change Columns
                      </button>
                      <button
                        className="rm-btn-confirm-process"
                        onClick={handleProcess}
                        disabled={isProcessing || !analysis.latitudeColumn || !analysis.longitudeColumn || detectionUncertain}
                        title={detectionUncertain ? 'Please review columns or prepare data before confirming' : ''}
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

      {/* ─── STARTING POINT ASSIGNMENT MODAL ───────────────────────── */}
      {measurementMode === 'distance' && (
        <AssignmentModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          destinations={destinations}
          startingPoints={startingPoints}
          onAssign={handleAssignStartingPoint}
          onClearAssignment={handleClearAssignment}
          onExclude={handleExcludeDestinations}
          onInclude={handleIncludeDestinations}
          onAddStartingPoint={handleAddStartingPoint}
          onRemoveStartingPoint={handleRemoveStartingPoint}
        />
      )}

      {/* ─── SCREEN 2: RESULTS (DISTANCE MODE) ────────────────────── */}
      {screen === 'results' && measurementMode === 'distance' && distResult && (
        <div className={`rm-results-workspace-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : 'sidebar-is-expanded'}`}>
          {/* CHATGPT-STYLE SIDEBAR FOR DISTANCE MODE */}
          {sidebarCollapsed ? (
            <aside className="rm-sidebar-rail" title="Navigation">
              <button
                className="rm-rail-btn rm-rail-toggle-btn"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>

              <div className="rm-rail-divider" />

              <button
                className="rm-rail-btn"
                onClick={handleNewUpload}
                title="New Upload"
                aria-label="New Upload"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>

              <button
                className={`rm-rail-btn ${distStartingPointFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDistStartingPointFilter('all')}
                title="All Destinations"
                aria-label="All Destinations"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
              </button>

              <button
                className="rm-rail-btn"
                onClick={handleExportDistExcel}
                title="Export Excel Report"
                aria-label="Export Excel"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                </svg>
              </button>

              <button
                className="rm-rail-btn"
                onClick={handleExportDistKml}
                title="Export KML Map"
                aria-label="Export KML"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </button>

              <div className="rm-rail-bottom">
                <button
                  className="rm-rail-btn"
                  onClick={() => setActiveModal('accuracy')}
                  title="About & Accuracy"
                  aria-label="About"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              </div>
            </aside>
          ) : (
            <aside className="rm-results-sidebar rm-sidebar-expanded">
              <div className="rm-sidebar-header">
                <div className="rm-sidebar-title-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" fill="#10b981" />
                  </svg>
                  <span>RouteMeasure</span>
                </div>
                <button
                  className="rm-sidebar-collapse-btn"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                  </svg>
                </button>
              </div>

              <button className="rm-sidebar-new-upload-btn" onClick={handleNewUpload}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>New Measurement</span>
              </button>

              {/* STARTING POINTS LIST */}
              <div className="rm-sidebar-section">
                <div className="rm-sidebar-section-title">STARTING POINTS</div>
                <button
                  className={`rm-sidebar-btn ${distStartingPointFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setDistStartingPointFilter('all')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  All ({distResult.summary.destinationCount})
                </button>

                {distResult.startingPoints.map((sp) => {
                  const count = distResult.results.filter((r) => r.startingPointUid === sp.uid).length;
                  return (
                    <button
                      key={sp.uid}
                      className={`rm-sidebar-btn ${distStartingPointFilter === sp.uid ? 'active' : ''}`}
                      onClick={() => setDistStartingPointFilter(sp.uid)}
                    >
                      <span className="rm-sp-dot-indicator" />
                      {sp.name} ({count})
                    </button>
                  );
                })}
              </div>

              {/* EXPORTS */}
              <div className="rm-sidebar-section">
                <div className="rm-sidebar-section-title">EXPORT DELIVERABLES</div>
                <button className="rm-sidebar-btn" onClick={handleExportDistExcel}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="#10b981" strokeWidth="1.4"/>
                    <path d="M5 5L11 11M11 5L5 11" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Excel Report (.xlsx)
                </button>

                <button className="rm-sidebar-btn" onClick={handleExportDistKml}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#3b82f6" strokeWidth="1.4"/>
                    <ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="#3b82f6" strokeWidth="1.2"/>
                    <line x1="8" y1="2" x2="8" y2="14" stroke="#3b82f6" strokeWidth="1.2"/>
                  </svg>
                  GIS Export (.kml)
                </button>
              </div>

              <div className="rm-sidebar-section">
                <div className="rm-sidebar-section-title">DOCUMENTATION</div>
                <button className="rm-sidebar-btn" onClick={() => setActiveModal('accuracy')}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                    <line x1="8" y1="7" x2="8" y2="11" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="8" cy="5" r="0.7" fill="#64748b"/>
                  </svg>
                  About &amp; Geodesics
                </button>
                <button className="rm-sidebar-btn" onClick={() => setActiveModal('how-it-works')}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                    <path d="M6 6.5C6 5.4 6.9 4.5 8 4.5C9.1 4.5 10 5.4 10 6.5C10 7.4 9.4 7.9 8.8 8.3C8.3 8.7 8 9.1 8 9.8" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="8" cy="11.8" r="0.7" fill="#64748b"/>
                  </svg>
                  How It Works
                </button>
              </div>

              <div className="rm-sidebar-bottom-section">
                <div className="rm-sidebar-footer-note">
                  Geodesic calculations computed in browser via Karney WGS84 inverse ellipsoid algorithm.
                </div>
              </div>
            </aside>
          )}

          {/* MAIN RESULTS CONTENT */}
          <main className="rm-results-main">
            <div className={`rm-results-grid ${!showMap ? 'map-hidden' : ''}`}>
              {/* LEFT COLUMN: Site Distance Analysis & Results Table */}
              <div className="rm-results-left-col">
                {/* TOP SITE DISTANCE ANALYSIS CARD */}
                <div className="rm-summary-card">
                  <div className="rm-summary-title">Site Distance Analysis</div>
                  <div className="rm-summary-primary-value">
                    <span className="rm-summary-dist-m">
                      {distResult.summary.destinationCount} Destination Sites
                    </span>
                    <span className="rm-summary-dist-km">
                      Measured from {distResult.summary.startingPointCount} starting point{distResult.summary.startingPointCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="rm-summary-metrics-grid">
                    <div className="rm-metric-box">
                      <div className="rm-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6" stroke="#3b82f6" strokeWidth="1.4"/>
                          <circle cx="8" cy="8" r="2" fill="#3b82f6"/>
                        </svg>
                      </div>
                      <div className="rm-metric-val">{distResult.summary.destinationCount}</div>
                      <div className="rm-metric-label">DESTINATIONS</div>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="5" stroke="#10b981" strokeWidth="1.4"/>
                          <path d="M8 5V8L10 9" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="rm-metric-val">{distResult.summary.startingPointCount}</div>
                      <div className="rm-metric-label">STARTING POINTS</div>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 13L6 5L10 9L14 3" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="rm-metric-val">{distResult.summary.averageDistanceKm.toFixed(1)} km</div>
                      <div className="rm-metric-label">AVERAGE DIST</div>
                    </div>

                    {distResult.summary.furthestSite && (
                      <div className="rm-metric-box">
                        <div className="rm-metric-icon">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 12L12 4M12 4H7M12 4V9" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="rm-metric-val font-semibold">{distResult.summary.furthestSite.distanceKm.toFixed(1)} km</div>
                        <div className="rm-metric-label" title={distResult.summary.furthestSite.name}>
                          FURTHEST ({distResult.summary.furthestSite.name})
                        </div>
                      </div>
                    )}

                    {distResult.summary.nearestSite && (
                      <div className="rm-metric-box">
                        <div className="rm-metric-icon">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M12 12L4 4M4 4H9M4 4V9" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="rm-metric-val font-semibold">{distResult.summary.nearestSite.distanceKm.toFixed(1)} km</div>
                        <div className="rm-metric-label" title={distResult.summary.nearestSite.name}>
                          NEAREST ({distResult.summary.nearestSite.name})
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* DISTANCE RESULTS TABLE CARD */}
                <div className="rm-tabs-card">
                  {/* Table Toolbar */}
                  <div className="rm-dist-results-toolbar">
                    <div className="rm-dist-results-toolbar-left">
                      {/* Sort Toggle */}
                      <div className="rm-sort-toggle-group">
                        <button
                          type="button"
                          className={`rm-sort-toggle-btn ${distRankSort === 'furthest' ? 'active' : ''}`}
                          onClick={() => setDistRankSort('furthest')}
                          title="Rank furthest destination sites first"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3V13M8 3L4 7M8 3L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Rank (Furthest First)
                        </button>
                        <button
                          type="button"
                          className={`rm-sort-toggle-btn ${distRankSort === 'nearest' ? 'active' : ''}`}
                          onClick={() => setDistRankSort('nearest')}
                          title="Rank nearest destination sites first"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M8 13V3M8 13L4 9M8 13L12 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Rank (Nearest First)
                        </button>
                      </div>

                      {/* Region Filter */}
                      {distRegions.length > 0 && (
                        <select
                          className="rm-dist-filter-select"
                          value={distRegionFilter}
                          onChange={(e) => setDistRegionFilter(e.target.value)}
                        >
                          <option value="all">All Regions ({distRegions.length})</option>
                          {distRegions.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}

                      {/* Starting Point Filter */}
                      <select
                        className="rm-dist-filter-select"
                        value={distStartingPointFilter}
                        onChange={(e) => setDistStartingPointFilter(e.target.value)}
                      >
                        <option value="all">All Starting Points</option>
                        {distResult.startingPoints.map((sp) => (
                          <option key={sp.uid} value={sp.uid}>{sp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rm-dist-results-toolbar-right">
                      <div className="rm-dist-search-wrap">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <input
                          type="text"
                          className="rm-dist-search-input"
                          placeholder="Search sites..."
                          value={distSearchQuery}
                          onChange={(e) => setDistSearchQuery(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className={`rm-map-toggle-btn ${showMap ? 'active' : ''}`}
                        onClick={() => setShowMap(!showMap)}
                        title={showMap ? 'Hide Map' : 'Show Map'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                          <line x1="8" y1="2" x2="8" y2="18" />
                          <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                        {showMap ? 'Hide Map' : 'View on Map'}
                      </button>
                    </div>
                  </div>

                  {/* Distance Results Table */}
                  <div className="rm-data-table-wrap">
                    <table className="rm-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 50 }}>RANK</th>
                          <th>HT SITE ID</th>
                          <th>LEGACY SITE ID</th>
                          <th>SITE NAME</th>
                          <th>REGION/WHS</th>
                          <th>STARTING POINT</th>
                          <th>SOURCE</th>
                          <th>START LAT</th>
                          <th>START LON</th>
                          <th>DEST LAT</th>
                          <th>DEST LON</th>
                          <th style={{ textAlign: 'right' }}>DISTANCE (KM)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDistResults.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="rm-table-empty-cell">
                              No results match the active filters.
                            </td>
                          </tr>
                        ) : (
                          filteredDistResults.map((res) => {
                            const dest = distResult.destinations.find((d) => d.uid === res.destinationUid);
                            const sp = distResult.startingPoints.find((s) => s.uid === res.startingPointUid);
                            const isSelected = selectedDistanceSiteUid === res.destinationUid;

                            return (
                              <tr
                                key={res.destinationUid}
                                className={isSelected ? 'selected-row' : ''}
                                onClick={() => setSelectedDistanceSiteUid(res.destinationUid)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td className="rm-seq-col font-bold">{res.rank}</td>
                                <td className="font-mono font-bold">{dest?.siteId || '—'}</td>
                                <td className="font-mono text-muted">{dest?.legacySiteId || '—'}</td>
                                <td className="font-semibold">{dest?.siteName || '—'}</td>
                                <td>
                                  {dest?.region ? <span className="rm-region-pill">{dest.region}</span> : '—'}
                                </td>
                                <td className="font-semibold">{sp?.name || '—'}</td>
                                <td>
                                  {sp ? (
                                    <span className={`rm-sp-source-badge rm-source-${sp.source}`}>
                                      {sp.source === 'sheet' ? 'Uploaded' : sp.source === 'detected' ? 'Detected' : 'Manual'}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="font-mono">{sp ? sp.latitude.toFixed(5) : '—'}</td>
                                <td className="font-mono">{sp ? sp.longitude.toFixed(5) : '—'}</td>
                                <td className="font-mono">{dest ? dest.latitude.toFixed(5) : '—'}</td>
                                <td className="font-mono">{dest ? dest.longitude.toFixed(5) : '—'}</td>
                                <td className="numeric font-bold" style={{ textAlign: 'right', color: '#2563eb' }}>
                                  {res.distanceKm.toFixed(1)} km
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Google Maps Satellite View with independent lines */}
              {showMap && (
                <div className="rm-results-right-col">
                  <DistanceMap
                    analysisResult={distResult}
                    startingPointFilter={distStartingPointFilter}
                    selectedSiteUid={selectedDistanceSiteUid}
                    onSiteSelect={setSelectedDistanceSiteUid}
                    apiKey={apiKey}
                    onApiKeyChange={handleApiKeyChange}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ─── SCREEN 2: RESULTS (ROUTE MODE - LV & MV) ─────────────── */}
      {screen === 'results' && measurementMode === 'route' && result && displayedSummary && (
        <div className={`rm-results-workspace-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : 'sidebar-is-expanded'}`}>
          {/* CHATGPT-STYLE SIDEBAR */}
          {sidebarCollapsed ? (
            /* COLLAPSED SLIM ICON RAIL */
            <aside className="rm-sidebar-rail" title="Navigation">
              <button
                className="rm-rail-btn rm-rail-toggle-btn"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>

              <div className="rm-rail-divider" />

              <button
                className="rm-rail-btn"
                onClick={handleNewUpload}
                title="New Upload"
                aria-label="New Upload"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>

              <button
                className={`rm-rail-btn ${selectedFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleFilterChange('all')}
                title="All Routes"
                aria-label="All Routes"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19L9 9L15 15L20 5" />
                </svg>
              </button>

              <button
                className="rm-rail-btn"
                onClick={handleExportExcel}
                title="Export Excel Report"
                aria-label="Export Excel"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                </svg>
              </button>

              <button
                className="rm-rail-btn"
                onClick={handleExportKML}
                title="Export KML Map"
                aria-label="Export KML"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </button>

              <div className="rm-rail-bottom">
                <button
                  className="rm-rail-btn"
                  onClick={() => setActiveModal('accuracy')}
                  title="About & Accuracy"
                  aria-label="About"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              </div>
            </aside>
          ) : (
            /* EXPANDED FULL SIDEBAR */
            <aside className="rm-results-sidebar rm-sidebar-expanded">
              {/* Sidebar Header with Toggle Icon */}
              <div className="rm-sidebar-header">
                <div className="rm-sidebar-title-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19L9 9L15 15L20 5" />
                  </svg>
                  <span>RouteMeasure</span>
                </div>
                <button
                  className="rm-sidebar-collapse-btn"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                  </svg>
                </button>
              </div>

              {/* Action Button: New Upload */}
              <button className="rm-sidebar-new-upload-btn" onClick={handleNewUpload}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>New Measurement</span>
              </button>

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
                    const active = selectedFilter === r.uid || selectedFilter.toLowerCase() === r.name.toLowerCase() || (selectedFilter.toLowerCase() === cls && !isAllSelected);
                    return (
                      <button
                        key={r.uid}
                        className={`rm-sidebar-btn ${active ? 'active' : ''}`}
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
                          }}
                        />
                        {r.name} ({formatDistanceKilometres(r.totalDistanceMetres)})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* EXPORT SECTION */}
              <div className="rm-sidebar-section">
                <div className="rm-sidebar-section-title">EXPORT DELIVERABLES</div>
                <button className="rm-sidebar-btn" onClick={handleExportExcel}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="#10b981" strokeWidth="1.4"/>
                    <path d="M5 5L11 11M11 5L5 11" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Excel Report (.xlsx)
                </button>

                <button className="rm-sidebar-btn" onClick={handleExportKML}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#3b82f6" strokeWidth="1.4"/>
                    <ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="#3b82f6" strokeWidth="1.2"/>
                    <line x1="8" y1="2" x2="8" y2="14" stroke="#3b82f6" strokeWidth="1.2"/>
                  </svg>
                  GIS Export (.kml)
                </button>
              </div>

              {/* DOCUMENTATION & HELP */}
              <div className="rm-sidebar-section">
                <div className="rm-sidebar-section-title">DOCUMENTATION</div>
                <button className="rm-sidebar-btn" onClick={() => setActiveModal('accuracy')}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                    <line x1="8" y1="7" x2="8" y2="11" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="8" cy="5" r="0.7" fill="#64748b"/>
                  </svg>
                  About &amp; Geodesics
                </button>
                <button className="rm-sidebar-btn" onClick={() => setActiveModal('how-it-works')}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.4"/>
                    <path d="M6 6.5C6 5.4 6.9 4.5 8 4.5C9.1 4.5 10 5.4 10 6.5C10 7.4 9.4 7.9 8.8 8.3C8.3 8.7 8 9.1 8 9.8" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="8" cy="11.8" r="0.7" fill="#64748b"/>
                  </svg>
                  How It Works
                </button>
              </div>

              {/* Sidebar Footer Note */}
              <div className="rm-sidebar-bottom-section">
                <div className="rm-sidebar-footer-note">
                  Geodesic measurements calculated using Karney's algorithm on the WGS84 reference ellipsoid.
                </div>
              </div>
            </aside>
          )}

          {/* MAIN RESULTS CONTENT AREA */}
          <main className="rm-results-main">
            <div className={`rm-results-grid ${!showMap ? 'map-hidden' : ''}`}>
              {/* LEFT COLUMN: Summary Card & Data Table */}
              <div className="rm-results-left-col">
                {/* METRICS CARD */}
                <div className="rm-summary-card">
                  <div className="rm-summary-title">Coordinate-Derived Route Distance</div>
                  <div className="rm-summary-primary-value">
                    <span className="rm-summary-dist-m">
                      {formatDistanceMetres(displayedSummary.totalDistanceMetres)}
                    </span>
                    <span className="rm-summary-dist-km">
                      {formatDistanceKilometres(displayedSummary.totalDistanceMetres)}
                    </span>
                  </div>

                  <div className="rm-summary-metrics-grid">
                    <div className="rm-metric-box">
                      <div className="rm-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6" stroke="#3b82f6" strokeWidth="1.4"/>
                          <circle cx="8" cy="8" r="2" fill="#3b82f6"/>
                        </svg>
                      </div>
                      <div className="rm-metric-val">{displayedSummary.coordinateCount}</div>
                      <div className="rm-metric-label">POINTS</div>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 12L6 6L10 10L14 4" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="rm-metric-val">{displayedSummary.segmentCount}</div>
                      <div className="rm-metric-label">SEGMENTS</div>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 13L13 3M13 3H7M13 3V9" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="rm-metric-val font-semibold">{displayedSummary.startPoint.displayLabel}</div>
                      <div className="rm-metric-label">START</div>
                    </div>

                    <div className="rm-metric-box">
                      <div className="rm-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 3L13 13M13 13H7M13 13V7" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="rm-metric-val font-semibold">{displayedSummary.endPoint.displayLabel}</div>
                      <div className="rm-metric-label">END</div>
                    </div>
                  </div>
                </div>

                {/* DATA TABLE CARD */}
                <div className="rm-tabs-card">
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
                    <div style={{ flex: 1 }} />
                    <button
                      type="button"
                      className={`rm-map-toggle-btn ${showMap ? 'active' : ''}`}
                      onClick={() => setShowMap(!showMap)}
                      title={showMap ? 'Hide Map' : 'Show Map'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                        <line x1="8" y1="2" x2="8" y2="18" />
                        <line x1="16" y1="6" x2="16" y2="22" />
                      </svg>
                      {showMap ? 'Hide Map' : 'View on Map'}
                    </button>
                  </div>

                  <div className="rm-data-table-wrap">
                    {activeTab === 'coordinates' ? (
                      <table className="rm-data-table">
                        <thead>
                          <tr>
                            <th>SEQ</th>
                            <th>ROUTE</th>
                            <th>POINT</th>
                            <th>LATITUDE</th>
                            <th>LONGITUDE</th>
                            <th style={{ textAlign: 'right' }}>CUMULATIVE DISTANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedSummary.pointDistances.map((pd, idx) => (
                            <tr key={`${pd.routeName}-${idx}`}>
                              <td className="rm-seq-col">{idx + 1}</td>
                              <td>
                                <span className={`rm-table-route-badge rm-badge-${pd.routeCls}`}>
                                  {pd.routeName}
                                </span>
                              </td>
                              <td className="font-semibold">{pd.point.displayLabel}</td>
                              <td className="numeric font-mono">{formatCoordinate(pd.point.latitude)}</td>
                              <td className="numeric font-mono">{formatCoordinate(pd.point.longitude)}</td>
                              <td className="numeric font-mono" style={{ textAlign: 'right' }}>
                                {formatDistanceMetres(pd.cumulativeDistance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="rm-data-table">
                        <thead>
                          <tr>
                            <th>SEG</th>
                            <th>ROUTE</th>
                            <th>FROM</th>
                            <th>TO</th>
                            <th style={{ textAlign: 'right' }}>DISTANCE</th>
                            <th style={{ textAlign: 'right' }}>CUMULATIVE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedSummary.segments.map((seg, idx) => (
                            <tr key={`${seg.routeName}-${idx}`}>
                              <td className="rm-seq-col">{seg.segmentNumber}</td>
                              <td>
                                <span className={`rm-table-route-badge rm-badge-${seg.routeCls}`}>
                                  {seg.routeName}
                                </span>
                              </td>
                              <td className="font-semibold">{seg.fromPoint.displayLabel}</td>
                              <td className="font-semibold">{seg.toPoint.displayLabel}</td>
                              <td className="numeric font-mono font-bold" style={{ textAlign: 'right', color: '#2563eb' }}>
                                {formatDistanceMetres(seg.distanceMetres)}
                              </td>
                              <td className="numeric font-mono" style={{ textAlign: 'right' }}>
                                {formatDistanceMetres(seg.cumulativeDistanceMetres)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Interactive Map */}
              {showMap && (
                <div className="rm-results-right-col">
                  <RouteMap
                    route={activeRoutes[0] || null}
                    allRoutes={activeRoutes}
                    selectedFilter={selectedFilter}
                    onFilterChange={handleFilterChange}
                    apiKey={apiKey}
                    onApiKeyChange={handleApiKeyChange}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ─── ROUTEMEASURE ASSISTANT (Visible on Measurement / Upload workspace) ─── */}
      {screen === 'upload-confirm' && (
        <>
          <AssistantButton
            isOpen={isAssistantOpen}
            onToggle={() => setIsAssistantOpen((prev) => !prev)}
            hasUnreadOrPrepared={Boolean(assistantPreparedResult)}
          />
          <AssistantPanel
            isOpen={isAssistantOpen}
            onClose={() => setIsAssistantOpen(false)}
            onMinimize={() => setIsAssistantOpen(false)}
            currentMode={measurementMode}
            onOpenReviewModal={(result) => {
              setAssistantPreparedResult(result);
              setReviewModalResult(result);
            }}
            onUseInRouteMeasure={handleAssistantUseInRouteMeasure}
            onOpenManualReview={sheetData ? () => setIsManualReviewOpen(true) : undefined}
          />
        </>
      )}

      {/* Review Data Modal */}
      {reviewModalResult && (
        <ReviewDataModal
          isOpen={Boolean(reviewModalResult)}
          mode={reviewModalResult.mode}
          initialPoints={reviewModalResult.points}
          initialSites={reviewModalResult.sites}
          onClose={() => setReviewModalResult(null)}
          onConfirmUseInRouteMeasure={handleAssistantUseInRouteMeasure}
        />
      )}

      {/* ─── MODALS ─────────────────────────────────────────────────── */}
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
