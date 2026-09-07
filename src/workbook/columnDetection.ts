/**
 * Column detection module.
 */

import type { DetectedColumn, RawSheetData } from '../types/workbook';
import { DetectionConfidence } from '../types/workbook';

const NON_COORDINATE_HEADER_ALIASES = new Set([
  's/n', 'sn', 's n', 's.n.', 's no', 's.no', 'serial', 'serial no', 'serial number',
  'no', 'no.', 'number', '#', 'item', 'item no', 'item #', 'item number',
  'qty', 'quantity', 'quantities', 'count',
  'rate', 'amount', 'price', 'cost', 'total', 'total price', 'subtotal',
  'services', 'transportation', 'unit', 'units', 'uom',
  'page', 'page no', 'id', 'site id', 'siteid', 'station id',
  'description', 'desc', 'item description', 'scope', 'specification', 'spec',
  'remarks', 'remark', 'comments', 'comment', 'status',
  'date', 'day', 'month', 'year', 'time',
  'pct', 'percent', 'percentage', '%',
  'currency', 'tzs', 'usd', 'eur', 'gbp', 'kes', 'ugx', 'vat', 'tax',
  'ref', 'reference', 'code', 'site code'
]);

export function isNonCoordinateHeader(header?: string): boolean {
  if (!header) return false;
  const norm = header.toLowerCase().trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ').trim();
  const clean = norm.replace(/[()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  if (NON_COORDINATE_HEADER_ALIASES.has(norm) || NON_COORDINATE_HEADER_ALIASES.has(clean)) return true;

  const rawNorm = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (['sn', 'sno', 'no', 'qty', 'item', 'price', 'cost', 'total', 'rate', 'amount', 'tzs', 'usd'].includes(rawNorm)) {
    return true;
  }

  // Keywords that decisively indicate financial, indexing, or quantity columns
  if (/\b(price|cost|total|services|transportation|qty|quantity|amount|tzs|usd|vat|tax|rate|subtotal|serial)\b/i.test(clean)) {
    return true;
  }

  return false;
}

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
  isSequential: boolean;
  isConstant: boolean;
  hasDecimals: boolean;
} {
  let numericCount = 0;
  let totalCount = 0;
  let min = Infinity;
  let max = -Infinity;
  let isSequential = true;
  let isConstant = true;
  let hasDecimals = false;
  let prevVal: number | null = null;
  let firstVal: number | null = null;

  for (const row of sheetData.rows) {
    const cell = row[columnIndex];
    if (cell === null || cell === undefined || String(cell).trim() === '') continue;

    totalCount++;
    const num = typeof cell === 'number' ? cell : Number(String(cell).trim());

    if (!isNaN(num) && isFinite(num)) {
      numericCount++;
      min = Math.min(min, num);
      max = Math.max(max, num);

      // Check for decimal precision
      if (Math.abs(num - Math.round(num)) > 1e-6) {
        hasDecimals = true;
      }

      // Check constant
      if (firstVal === null) {
        firstVal = num;
      } else if (num !== firstVal) {
        isConstant = false;
      }

      // Check sequential integers (e.g. 1, 2, 3...)
      if (prevVal !== null && num !== prevVal + 1) {
        isSequential = false;
      }
      prevVal = num;
    }
  }

  const isNumeric = totalCount > 0 && numericCount / totalCount >= 0.8;
  const allInLatRange = isNumeric && min >= -90 && max <= 90;
  const allInLonRange = isNumeric && min >= -180 && max <= 180;

  const header = sheetData.headers[columnIndex];
  const isBlacklisted = isNonCoordinateHeader(header);

  // Columns with sequential integers starting at 1 (serial numbers) or constant values with no decimals are not coordinates
  const isLikelyRowIndex = totalCount >= 3 && isSequential && min >= 0 && !hasDecimals;
  const isLikelyConstant = totalCount >= 3 && isConstant && !hasDecimals;

  const couldBeLatitude =
    allInLatRange &&
    numericCount >= 2 &&
    !isBlacklisted &&
    !isLikelyRowIndex &&
    !isLikelyConstant;

  const couldBeLongitude =
    allInLonRange &&
    numericCount >= 2 &&
    !isBlacklisted &&
    !isLikelyRowIndex &&
    !isLikelyConstant;

  return {
    isNumeric,
    numericCount,
    totalCount,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    couldBeLatitude,
    couldBeLongitude,
    allInLatRange,
    allInLonRange,
    isSequential,
    isConstant,
    hasDecimals,
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
    // If neither column has decimal values (e.g. all whole integers), they should NOT be blindly treated as coordinates
    const hasAnyDecimals = couldBeBoth.some((a) => a.analysis.hasDecimals);
    if (!hasAnyDecimals) {
      return {
        latitudeColumn: null,
        longitudeColumn: null,
        ambiguous: false,
        reason: 'Columns contain only integers without coordinate decimal precision.',
      };
    }

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
