import { useState, useMemo } from 'react';
import type { RawSheetData, WorkbookAnalysis, DetectedColumn } from '../types/workbook';
import { DetectionConfidence } from '../types/workbook';

interface ManualColumnReviewCardProps {
  sheetData: RawSheetData;
  initialAnalysis?: WorkbookAnalysis | null;
  mode: 'route' | 'distance';
  onModeChange?: (newMode: 'route' | 'distance') => void;
  onConfirm: (customAnalysis: WorkbookAnalysis) => void;
  onCancel: () => void;
  onOpenAssistant: () => void;
}

export function ManualColumnReviewCard({
  sheetData,
  initialAnalysis,
  mode,
  onModeChange,
  onConfirm,
  onCancel,
  onOpenAssistant,
}: ManualColumnReviewCardProps) {
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(initialAnalysis?.headerRow ?? 0);
  const [selectedLatIdx, setSelectedLatIdx] = useState<number>(
    initialAnalysis?.latitudeColumn?.columnIndex ?? 0
  );
  const [selectedLonIdx, setSelectedLonIdx] = useState<number>(
    initialAnalysis?.longitudeColumn?.columnIndex ?? 1
  );
  const [selectedPointIdx, setSelectedPointIdx] = useState<number>(
    initialAnalysis?.pointColumn?.columnIndex ?? -1
  );
  const [voltageType, setVoltageType] = useState<'LV' | 'MV'>('LV');

  // Available headers
  const headers = useMemo(() => {
    if (sheetData.headers && sheetData.headers.length > 0) {
      return sheetData.headers;
    }
    const maxCols = Math.max(...sheetData.rows.slice(0, 10).map((r) => r.length), 0);
    return Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
  }, [sheetData]);

  // Live preview rows
  const previewRows = useMemo(() => {
    return sheetData.rows.slice(0, 5).map((row, idx) => {
      const latVal = row[selectedLatIdx];
      const lonVal = row[selectedLonIdx];
      const ptVal = selectedPointIdx >= 0 ? row[selectedPointIdx] : `Point ${idx + 1}`;
      return {
        rowNum: headerRowIdx + idx + 2,
        point: ptVal !== null && ptVal !== undefined ? String(ptVal) : `Point ${idx + 1}`,
        lat: latVal !== null && latVal !== undefined ? String(latVal) : '-',
        lon: lonVal !== null && lonVal !== undefined ? String(lonVal) : '-',
      };
    });
  }, [sheetData.rows, selectedLatIdx, selectedLonIdx, selectedPointIdx, headerRowIdx]);

  const handleApply = () => {
    const latCol: DetectedColumn = {
      columnIndex: selectedLatIdx,
      originalHeader: headers[selectedLatIdx] || `Column ${selectedLatIdx + 1}`,
      confidence: DetectionConfidence.High,
      reason: 'User manual selection',
    };

    const lonCol: DetectedColumn = {
      columnIndex: selectedLonIdx,
      originalHeader: headers[selectedLonIdx] || `Column ${selectedLonIdx + 1}`,
      confidence: DetectionConfidence.High,
      reason: 'User manual selection',
    };

    const ptCol: DetectedColumn | null =
      selectedPointIdx >= 0
        ? {
            columnIndex: selectedPointIdx,
            originalHeader: headers[selectedPointIdx] || `Column ${selectedPointIdx + 1}`,
            confidence: DetectionConfidence.High,
            reason: 'User manual selection',
          }
        : null;

    const customAnalysis: WorkbookAnalysis = {
      worksheetNames: initialAnalysis?.worksheetNames || [sheetData.sheetName],
      selectedWorksheet: sheetData.sheetName,
      headerRow: headerRowIdx,
      latitudeColumn: latCol,
      longitudeColumn: lonCol,
      pointColumn: ptCol,
      routeColumn: null,
      descriptionColumn: null,
      orderColumn: null,
      coordinateRowCount: sheetData.rows.length,
      previewRows: previewRows.map((r) => ({
        Row: r.rowNum,
        Latitude: r.lat,
        Longitude: r.lon,
      })),
      allHeaders: headers,
      hasAmbiguity: false,
      orderingMethod: 'row',
      orderingDescription: `${voltageType} Route (${sheetData.sheetName})`,
    };

    onConfirm(customAnalysis);
  };

  return (
    <div className="rm-manual-review-card">
      <div className="rm-manual-review-header">
        <div className="rm-manual-review-badge">Manual Column & Voltage Mapper</div>
        <h3 className="rm-manual-review-title">Review & Map Coordinate Columns</h3>
        <p className="rm-manual-review-desc">
          Select which columns contain your coordinates, choose the voltage classification, and verify against the preview table.
        </p>
      </div>

      {/* Selectors Grid */}
      <div className="rm-manual-selectors-grid">
        {/* Voltage / Route Type */}
        <div className="rm-selector-group">
          <label className="rm-selector-label">ROUTE VOLTAGE</label>
          <div className="rm-voltage-toggle-group">
            <button
              type="button"
              className={`rm-v-btn ${voltageType === 'LV' ? 'active-lv' : ''}`}
              onClick={() => {
                setVoltageType('LV');
                if (mode !== 'route' && onModeChange) onModeChange('route');
              }}
            >
              ⚡ Low Voltage (LV)
            </button>
            <button
              type="button"
              className={`rm-v-btn ${voltageType === 'MV' ? 'active-mv' : ''}`}
              onClick={() => {
                setVoltageType('MV');
                if (mode !== 'route' && onModeChange) onModeChange('route');
              }}
            >
              ⚡ Medium Voltage (MV)
            </button>
          </div>
        </div>

        {/* Latitude Column */}
        <div className="rm-selector-group">
          <label className="rm-selector-label" htmlFor="select-lat-col">
            LATITUDE COLUMN
          </label>
          <select
            id="select-lat-col"
            className="rm-selector-dropdown font-mono"
            value={selectedLatIdx}
            onChange={(e) => setSelectedLatIdx(Number(e.target.value))}
          >
            {headers.map((h, i) => {
              const sampleVal = sheetData.rows[0]?.[i];
              const sampleStr = sampleVal != null ? ` (${sampleVal})` : '';
              return (
                <option key={i} value={i}>
                  {h || `Col ${i + 1}`}{sampleStr}
                </option>
              );
            })}
          </select>
        </div>

        {/* Longitude Column */}
        <div className="rm-selector-group">
          <label className="rm-selector-label" htmlFor="select-lon-col">
            LONGITUDE COLUMN
          </label>
          <select
            id="select-lon-col"
            className="rm-selector-dropdown font-mono"
            value={selectedLonIdx}
            onChange={(e) => setSelectedLonIdx(Number(e.target.value))}
          >
            {headers.map((h, i) => {
              const sampleVal = sheetData.rows[0]?.[i];
              const sampleStr = sampleVal != null ? ` (${sampleVal})` : '';
              return (
                <option key={i} value={i}>
                  {h || `Col ${i + 1}`}{sampleStr}
                </option>
              );
            })}
          </select>
        </div>

        {/* Point / Pole Label */}
        <div className="rm-selector-group">
          <label className="rm-selector-label" htmlFor="select-pt-col">
            POLE / POINT LABEL (OPTIONAL)
          </label>
          <select
            id="select-pt-col"
            className="rm-selector-dropdown"
            value={selectedPointIdx}
            onChange={(e) => setSelectedPointIdx(Number(e.target.value))}
          >
            <option value={-1}>None (Auto-number points)</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {h || `Col ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live 5-Row Preview */}
      <div className="rm-manual-preview-wrap">
        <div className="rm-preview-header">Live Preview (First 5 Rows with Selected Columns)</div>
        <table className="rm-preview-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ROW</th>
              <th>POINT / POLE</th>
              <th>LATITUDE</th>
              <th>LONGITUDE</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, idx) => (
              <tr key={idx}>
                <td className="rm-row-num">{r.rowNum}</td>
                <td>{r.point}</td>
                <td className="font-mono numeric">{r.lat}</td>
                <td className="font-mono numeric">{r.lon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="rm-manual-actions">
        <div className="rm-manual-actions-left">
          <button type="button" className="rm-btn-ai-hint" onClick={onOpenAssistant}>
            ✦ Prepare with RouteMeasure Assistant
          </button>
        </div>
        <div className="rm-manual-actions-right">
          <button type="button" className="rm-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rm-btn-confirm-process"
            onClick={handleApply}
          >
            Confirm & Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
