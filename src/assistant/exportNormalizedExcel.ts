/**
 * Export clean normalized Excel workbook from RouteMeasure Assistant data.
 * Produces a standardized .xlsx file with clean primary data and an optional review notes sheet.
 */

import * as XLSX from 'xlsx';
import type { NormalizedPointRecord, NormalizedDistanceRecord, AssistantTargetMode } from './types';

export function exportAssistantNormalizedExcel(
  mode: AssistantTargetMode,
  points: NormalizedPointRecord[],
  sites: NormalizedDistanceRecord[],
  filenamePrefix = 'RouteMeasure_Clean_Data'
): void {
  const wb = XLSX.utils.book_new();

  if (mode === 'lv_mv') {
    // Sheet 1: RouteMeasure_Data
    const dataRows = points.map((p) => ({
      'Route Type': p.routeType,
      'Route ID': p.routeId || (p.routeType === 'LV' ? 'LV Route' : 'MV Route'),
      'Point ID': p.pointId,
      'Latitude': p.latitude ?? (p.rawLatitude != null ? String(p.rawLatitude) : ''),
      'Longitude': p.longitude ?? (p.rawLongitude != null ? String(p.rawLongitude) : ''),
      'Description': p.description || '',
      'Source Provenance': formatProvenance(p.source),
    }));

    const wsData = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, wsData, 'RouteMeasure_Data');

    // Sheet 2: Review_Notes
    const notesRows = points.map((p) => ({
      'Point ID': p.pointId,
      'Validation Status': p.status.toUpperCase(),
      'Route Type': p.routeType,
      'Warnings / Notes': p.warnings.join('; ') || (p.status === 'valid' ? 'Verified valid' : ''),
      'Validation Errors': (p.validationErrors || []).join('; '),
      'Source': formatProvenance(p.source),
      'Confidence': p.confidence != null ? `${(p.confidence * 100).toFixed(0)}%` : 'N/A',
    }));

    const wsNotes = XLSX.utils.json_to_sheet(notesRows);
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Review_Notes');
  } else {
    // Distance mode
    const dataRows = sites.map((s) => ({
      'HT Site ID': s.siteId,
      'Legacy Site ID': s.legacySiteId || '',
      'Site Name': s.siteName,
      'Region / WHS': s.region || '',
      'Latitude': s.latitude ?? (s.rawLatitude != null ? String(s.rawLatitude) : ''),
      'Longitude': s.longitude ?? (s.rawLongitude != null ? String(s.rawLongitude) : ''),
      'Description': s.description || '',
      'Source Provenance': formatProvenance(s.source),
    }));

    const wsData = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, wsData, 'RouteMeasure_Destinations');

    // Sheet 2: Review_Notes
    const notesRows = sites.map((s) => ({
      'Site ID': s.siteId,
      'Site Name': s.siteName,
      'Validation Status': s.status.toUpperCase(),
      'Warnings / Notes': s.warnings.join('; ') || (s.status === 'valid' ? 'Verified valid' : ''),
      'Validation Errors': (s.validationErrors || []).join('; '),
      'Source': formatProvenance(s.source),
      'Confidence': s.confidence != null ? `${(s.confidence * 100).toFixed(0)}%` : 'N/A',
    }));

    const wsNotes = XLSX.utils.json_to_sheet(notesRows);
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Review_Notes');
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const outFileName = `${filenamePrefix}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, outFileName);
}

function formatProvenance(src: NormalizedPointRecord['source']): string {
  if (!src) return 'Unknown';
  const parts: string[] = [];
  if (src.file) parts.push(src.file);
  if (src.sheet) parts.push(`Sheet: ${src.sheet}`);
  if (src.page) parts.push(`Page: ${src.page}`);
  if (src.row) parts.push(`Row: ${src.row}`);
  if (src.line) parts.push(`Line: ${src.line}`);
  if (src.reference) parts.push(src.reference);
  return parts.length > 0 ? parts.join(' | ') : src.type || 'Unknown';
}
