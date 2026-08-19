/**
 * Column detection module.
 */

import type { DetectedColumn, RawSheetData } from '../types/workbook';
import { DetectionConfidence } from '../types/workbook';

export function analyzeColumnValues(
  sheetData: RawSheetData,
  columnIndex: number
): {
  isNumeric: boolean;
  numericCount: number;
  totalCount: number;
  min: number;
  max: number;
  couldBeLatitude: boolean;
  couldBeLongitude: boolean;
  allInLatRange: boolean;
  allInLonRange: boolean;
} {
  let numericCount = 0;
  let totalCount = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const row of sheetData.rows) {
    const cell = row[columnIndex];
    if (cell === null || cell === undefined || String(cell).trim() === '') continue;

    totalCount++;
    const num = typeof cell === 'number' ? cell : Number(String(cell).trim());

    if (!isNaN(num) && isFinite(num)) {
      numericCount++;
      min = Math.min(min, num);
      max = Math.max(max, num);
    }
  }

  const isNumeric = totalCount > 0 && numericCount / totalCount >= 0.8;
  const allInLatRange = isNumeric && min >= -90 && max <= 90;
  const allInLonRange = isNumeric && min >= -180 && max <= 180;

  return {
    isNumeric,
    numericCount,
    totalCount,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    couldBeLatitude: allInLatRange && numericCount >= 2,
    couldBeLongitude: allInLonRange && numericCount >= 2,
    allInLatRange,
    allInLonRange,
  };
}

export function detectColumnsFromValues(
  sheetData: RawSheetData
): {
  latitudeColumn: DetectedColumn | null;
  longitudeColumn: DetectedColumn | null;
  ambiguous: boolean;
  reason: string;
} {
  const analyses: {
    columnIndex: number;
    header: string;
    analysis: ReturnType<typeof analyzeColumnValues>;
  }[] = [];

  for (let i = 0; i < sheetData.headers.length; i++) {
    const analysis = analyzeColumnValues(sheetData, i);
    if (analysis.isNumeric && (analysis.couldBeLatitude || analysis.couldBeLongitude)) {
      analyses.push({
        columnIndex: i,
        header: sheetData.headers[i] || `Column ${i + 1}`,
        analysis,
      });
    }
  }

  if (analyses.length < 2) {
    return {
      latitudeColumn: null,
      longitudeColumn: null,
      ambiguous: false,
      reason: 'Could not find at least 2 numeric columns with coordinate-like values.',
    };
  }

  const onlyLat = analyses.filter((a) => a.analysis.allInLatRange && !a.analysis.allInLonRange);
  const couldBeBoth = analyses.filter((a) => a.analysis.allInLatRange && a.analysis.allInLonRange);
  const onlyLon = analyses.filter((a) => !a.analysis.allInLatRange && a.analysis.allInLonRange);

  if (onlyLon.length >= 1 && (onlyLat.length >= 1 || couldBeBoth.length >= 1)) {
    const lon = onlyLon[0];
    const lat = onlyLat.length > 0 ? onlyLat[0] : couldBeBoth[0];

    return {
      latitudeColumn: {
        columnIndex: lat.columnIndex,
        originalHeader: lat.header,
        confidence: DetectionConfidence.Medium,
        reason: `Column values are within latitude range (-90 to +90)`,
      },
      longitudeColumn: {
        columnIndex: lon.columnIndex,
        originalHeader: lon.header,
        confidence: DetectionConfidence.Medium,
        reason: `Column values exceed latitude range but are within longitude range (-180 to +180)`,
      },
      ambiguous: false,
      reason: 'Detected from value ranges: one column exceeds ±90 (must be longitude).',
    };
  }

  if (couldBeBoth.length >= 2) {
    return {
      latitudeColumn: {
        columnIndex: couldBeBoth[0].columnIndex,
        originalHeader: couldBeBoth[0].header,
        confidence: DetectionConfidence.Low,
        reason: `Column values are within both latitude and longitude ranges — ambiguous`,
      },
      longitudeColumn: {
        columnIndex: couldBeBoth[1].columnIndex,
        originalHeader: couldBeBoth[1].header,
        confidence: DetectionConfidence.Low,
        reason: `Column values are within both latitude and longitude ranges — ambiguous`,
      },
      ambiguous: true,
      reason: 'Both columns have values within ±90. Cannot determine which is latitude and which is longitude without user confirmation.',
    };
  }

  return {
    latitudeColumn: null,
    longitudeColumn: null,
    ambiguous: false,
    reason: 'Could not reliably detect coordinate columns from values alone.',
  };
}
