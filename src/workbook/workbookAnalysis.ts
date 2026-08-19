/**
 * Workbook analysis module.
 */

import type { WorkbookAnalysis, RawSheetData } from '../types/workbook';
import { detectColumns } from './headerDetection';
import { detectColumnsFromValues } from './columnDetection';

export function analyzeSheet(
  sheetData: RawSheetData,
  allSheetNames: string[]
): WorkbookAnalysis {
  const headerResult = detectColumns(sheetData);

  let latCol = headerResult.latitude;
  let lonCol = headerResult.longitude;
  let altLat = headerResult.alternativeLatColumns;
  let altLon = headerResult.alternativeLonColumns;
  let hasAmbiguity = false;
  let ambiguityDescription: string | undefined;

  if (!latCol || !lonCol) {
    const valueResult = detectColumnsFromValues(sheetData);

    if (!latCol && valueResult.latitudeColumn) {
      latCol = valueResult.latitudeColumn;
    }
    if (!lonCol && valueResult.longitudeColumn) {
      lonCol = valueResult.longitudeColumn;
    }

    if (valueResult.ambiguous) {
      hasAmbiguity = true;
      ambiguityDescription = valueResult.reason;
    }
  }

  if (altLat.length > 0) {
    hasAmbiguity = true;
    ambiguityDescription = `Found ${altLat.length + 1} possible latitude columns. Please select the correct one.`;
  }
  if (altLon.length > 0) {
    hasAmbiguity = true;
    ambiguityDescription = `Found ${altLon.length + 1} possible longitude columns. Please select the correct one.`;
  }

  let coordinateRowCount = 0;
  if (latCol && lonCol) {
    for (const row of sheetData.rows) {
      const lat = row[latCol.columnIndex];
      const lon = row[lonCol.columnIndex];
      if (
        lat !== null &&
        lat !== undefined &&
        String(lat).trim() !== '' &&
        lon !== null &&
        lon !== undefined &&
        String(lon).trim() !== ''
      ) {
        coordinateRowCount++;
      }
    }
  }

  const previewRows: Record<string, string | number>[] = [];
  const previewCount = Math.min(5, sheetData.rows.length);
  for (let i = 0; i < previewCount; i++) {
    const row = sheetData.rows[i];
    const record: Record<string, string | number> = {};
    record['Row'] = i + 2;

    if (latCol) {
      const latVal = row[latCol.columnIndex];
      record['Latitude'] = latVal !== null && latVal !== undefined ? latVal as string | number : '';
    }
    if (lonCol) {
      const lonVal = row[lonCol.columnIndex];
      record['Longitude'] = lonVal !== null && lonVal !== undefined ? lonVal as string | number : '';
    }

    previewRows.push(record);
  }

  return {
    worksheetNames: allSheetNames,
    selectedWorksheet: sheetData.sheetName,
    headerRow: 0,
    latitudeColumn: latCol,
    longitudeColumn: lonCol,
    pointColumn: headerResult.point,
    routeColumn: headerResult.route,
    descriptionColumn: headerResult.description,
    orderColumn: headerResult.order,
    coordinateRowCount,
    previewRows,
    allHeaders: sheetData.headers,
    hasAmbiguity,
    ambiguityDescription,
    alternativeLatColumns: altLat.length > 0 ? altLat : undefined,
    alternativeLonColumns: altLon.length > 0 ? altLon : undefined,
    orderingMethod: 'row',
    orderingDescription: 'Excel row order',
  };
}

export function selectBestSheet(
  sheets: Map<string, RawSheetData>,
  sheetNames: string[]
): { sheetName: string; analysis: WorkbookAnalysis } | null {
  if (sheets.size === 0) return null;

  let bestSheet: string | null = null;
  let bestAnalysis: WorkbookAnalysis | null = null;
  let bestScore = -1;

  for (const [sheetName, sheetData] of sheets) {
    const analysis = analyzeSheet(sheetData, sheetNames);
    let score = 0;

    if (analysis.latitudeColumn) {
      score += analysis.latitudeColumn.confidence === 'high' ? 10 : 5;
    }
    if (analysis.longitudeColumn) {
      score += analysis.longitudeColumn.confidence === 'high' ? 10 : 5;
    }
    score += analysis.coordinateRowCount;

    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheetName;
      bestAnalysis = analysis;
    }
  }

  if (bestSheet && bestAnalysis) {
    return { sheetName: bestSheet, analysis: bestAnalysis };
  }

  const firstSheet = sheetNames[0];
  const firstData = sheets.get(firstSheet)!;
  return {
    sheetName: firstSheet,
    analysis: analyzeSheet(firstData, sheetNames),
  };
}
