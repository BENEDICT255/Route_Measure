/**
 * Distance mode workbook detection module.
 *
 * Extends the existing header/column detection for site-specific columns
 * used in the Distance Between Points measurement mode.
 *
 * Reuses lat/lon detection from headerDetection.ts and columnDetection.ts.
 */

import type { DetectedColumn, RawSheetData } from '../types/workbook';
import type { DistanceWorkbookAnalysis, StartingPoint } from '../types/distance';
import { DetectionConfidence } from '../types/workbook';
import { detectColumns } from './headerDetection';
import { detectColumnsFromValues } from './columnDetection';
import { generateUid } from '../utils/formatters';

// ─── Site-specific header aliases ──────────────────────────────────

const SITE_ID_ALIASES = new Set([
  'site id', 'siteid', 'site_id', 'ht site id', 'ht_site_id', 'htsiteid',
  'ht site', 'site code', 'site_code', 'sitecode', 'tower id', 'tower_id',
]);

const LEGACY_ID_ALIASES = new Set([
  'legacy site id', 'legacy_site_id', 'legacysiteid', 'legacy id',
  'legacy_id', 'legacyid', 'old id', 'old_id', 'oldid', 'old site id',
]);

const SITE_NAME_ALIASES = new Set([
  'site name', 'site_name', 'sitename', 'location', 'location name',
  'location_name', 'place', 'place name', 'place_name', 'town', 'village',
  'settlement',
]);

const REGION_ALIASES = new Set([
  'region', 'region/whs', 'whs', 'warehouse', 'cluster', 'area', 'zone',
  'district', 'province', 'state', 'county', 'territory',
]);

const DESCRIPTION_ALIASES = new Set([
  'description', 'desc', 'remarks', 'remark', 'comment', 'comments',
  'notes', 'note', 'type', 'category',
]);

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesAlias(normalizedHeader: string, aliases: Set<string>): boolean {
  return aliases.has(normalizedHeader);
}

function containsAlias(normalizedHeader: string, aliases: Set<string>): boolean {
  for (const alias of aliases) {
    if (normalizedHeader.includes(alias)) return true;
  }
  return false;
}

// ─── Reference point detection ─────────────────────────────────────

/**
 * Attempt to detect reference/warehouse coordinates embedded in the workbook
 * metadata (e.g. above the main data table).
 */
function detectReferencePoints(
  rawData: (string | number | null | undefined)[][],
  headerRowIndex: number
): StartingPoint[] {
  const refs: StartingPoint[] = [];

  // Scan rows above the header for reference coordinate patterns
  for (let i = 0; i < Math.min(headerRowIndex, 20); i++) {
    const row = rawData[i];
    if (!row) continue;

    // Look for patterns like "Warehouse", "Reference", "Origin" in text cells
    // followed by or near numeric coordinate values
    let refName: string | null = null;
    let refLat: number | null = null;
    let refLon: number | null = null;

    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell === null || cell === undefined) continue;

      const cellStr = String(cell).trim();
      const cellLower = cellStr.toLowerCase();

      // Check if this cell contains a reference-like label
      if (
        cellLower.includes('warehouse') ||
        cellLower.includes('reference') ||
        cellLower.includes('origin') ||
        cellLower.includes('depot') ||
        cellLower.includes('hub') ||
        cellLower.includes('base')
      ) {
        refName = cellStr;
      }

      // Check for coordinate-like labels nearby
      if (cellLower === 'latitude' || cellLower === 'lat') {
        // Next cell or cell in next row might be the value
        const nextCell = row[j + 1];
        if (nextCell !== null && nextCell !== undefined) {
          const num = typeof nextCell === 'number' ? nextCell : Number(String(nextCell).trim());
          if (!isNaN(num) && num >= -90 && num <= 90) {
            refLat = num;
          }
        }
      }

      if (cellLower === 'longitude' || cellLower === 'long' || cellLower === 'lon' || cellLower === 'lng') {
        const nextCell = row[j + 1];
        if (nextCell !== null && nextCell !== undefined) {
          const num = typeof nextCell === 'number' ? nextCell : Number(String(nextCell).trim());
          if (!isNaN(num) && num >= -180 && num <= 180) {
            refLon = num;
          }
        }
      }
    }

    // Also check if the row above or below has the coordinate values
    if (refName && (refLat === null || refLon === null)) {
      // Check adjacent rows for coordinate values
      for (let di = -1; di <= 2; di++) {
        const checkRow = rawData[i + di];
        if (!checkRow || di === 0) continue;

        for (let j = 0; j < checkRow.length; j++) {
          const cell = checkRow[j];
          if (cell === null || cell === undefined) continue;

          const cellStr = String(cell).trim().toLowerCase();
          const nextCell = checkRow[j + 1];

          if ((cellStr === 'latitude' || cellStr === 'lat') && nextCell != null) {
            const num = typeof nextCell === 'number' ? nextCell : Number(String(nextCell).trim());
            if (!isNaN(num) && num >= -90 && num <= 90) refLat = num;
          }
          if ((cellStr === 'longitude' || cellStr === 'long' || cellStr === 'lon' || cellStr === 'lng') && nextCell != null) {
            const num = typeof nextCell === 'number' ? nextCell : Number(String(nextCell).trim());
            if (!isNaN(num) && num >= -180 && num <= 180) refLon = num;
          }
        }
      }
    }

    if (refName && refLat !== null && refLon !== null) {
      refs.push({
        uid: generateUid(),
        name: refName,
        latitude: refLat,
        longitude: refLon,
        description: 'Detected from workbook metadata',
        source: 'detected',
        sourceRow: i + 1,
      });
    }
  }

  return refs;
}

// ─── Detect site-specific columns ──────────────────────────────────

function detectSiteColumns(sheetData: RawSheetData): {
  siteIdColumn: DetectedColumn | null;
  legacySiteIdColumn: DetectedColumn | null;
  siteNameColumn: DetectedColumn | null;
  regionColumn: DetectedColumn | null;
  descriptionColumn: DetectedColumn | null;
} {
  let siteIdCol: DetectedColumn | null = null;
  let legacyIdCol: DetectedColumn | null = null;
  let siteNameCol: DetectedColumn | null = null;
  let regionCol: DetectedColumn | null = null;
  let descCol: DetectedColumn | null = null;

  for (let i = 0; i < sheetData.headers.length; i++) {
    const header = sheetData.headers[i];
    if (!header || header.trim() === '') continue;

    const normalized = normalizeHeader(header);

    if (!siteIdCol && (matchesAlias(normalized, SITE_ID_ALIASES) || containsAlias(normalized, SITE_ID_ALIASES))) {
      siteIdCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, SITE_ID_ALIASES)
          ? DetectionConfidence.High
          : DetectionConfidence.Medium,
        reason: `Header "${header}" matches site ID pattern`,
      };
    }

    if (!legacyIdCol && (matchesAlias(normalized, LEGACY_ID_ALIASES) || containsAlias(normalized, LEGACY_ID_ALIASES))) {
      legacyIdCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, LEGACY_ID_ALIASES)
          ? DetectionConfidence.High
          : DetectionConfidence.Medium,
        reason: `Header "${header}" matches legacy ID pattern`,
      };
    }

    if (!siteNameCol && (matchesAlias(normalized, SITE_NAME_ALIASES) || containsAlias(normalized, SITE_NAME_ALIASES))) {
      // Avoid misidentifying the point/label column as site name
      if (normalized !== 'name' || sheetData.headers.length > 5) {
        siteNameCol = {
          columnIndex: i,
          originalHeader: header,
          confidence: matchesAlias(normalized, SITE_NAME_ALIASES)
            ? DetectionConfidence.High
            : DetectionConfidence.Medium,
          reason: `Header "${header}" matches site name pattern`,
        };
      }
    }

    if (!regionCol && (matchesAlias(normalized, REGION_ALIASES) || containsAlias(normalized, REGION_ALIASES))) {
      regionCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, REGION_ALIASES)
          ? DetectionConfidence.High
          : DetectionConfidence.Medium,
        reason: `Header "${header}" matches region pattern`,
      };
    }

    if (!descCol && matchesAlias(normalized, DESCRIPTION_ALIASES)) {
      descCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.Medium,
        reason: `Header "${header}" matches description pattern`,
      };
    }
  }

  return {
    siteIdColumn: siteIdCol,
    legacySiteIdColumn: legacyIdCol,
    siteNameColumn: siteNameCol,
    regionColumn: regionCol,
    descriptionColumn: descCol,
  };
}

// ─── Main analysis function ────────────────────────────────────────

/**
 * Analyze a workbook for the Distance Between Points mode.
 *
 * Detects lat/lon columns (reusing existing detection), plus site-specific
 * columns like Site ID, Site Name, Region/WHS, etc.
 *
 * Also scans for embedded reference/warehouse coordinates in metadata rows.
 */
export function analyzeDistanceWorkbook(
  sheetData: RawSheetData,
  allRawData: (string | number | null | undefined)[][] | null,
  worksheetNames: string[]
): DistanceWorkbookAnalysis {
  // Reuse existing lat/lon header detection
  const headerResult = detectColumns(sheetData);

  let latCol = headerResult.latitude;
  let lonCol = headerResult.longitude;

  // Fall back to value-based detection if headers didn't match
  if (!latCol || !lonCol) {
    const valueResult = detectColumnsFromValues(sheetData);
    if (!latCol && valueResult.latitudeColumn) latCol = valueResult.latitudeColumn;
    if (!lonCol && valueResult.longitudeColumn) lonCol = valueResult.longitudeColumn;
  }

  // Detect site-specific columns
  const siteColumns = detectSiteColumns(sheetData);

  // Count usable coordinate rows
  let coordRowCount = 0;
  if (latCol && lonCol) {
    for (const row of sheetData.rows) {
      const latVal = row[latCol.columnIndex];
      const lonVal = row[lonCol.columnIndex];
      if (latVal != null && lonVal != null) {
        const lat = typeof latVal === 'number' ? latVal : Number(String(latVal).trim());
        const lon = typeof lonVal === 'number' ? lonVal : Number(String(lonVal).trim());
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          coordRowCount++;
        }
      }
    }
  }

  // Build preview rows
  const previewRows: Record<string, string | number>[] = [];
  for (let i = 0; i < Math.min(sheetData.rows.length, 5); i++) {
    const row = sheetData.rows[i];
    const record: Record<string, string | number> = {};
    for (let j = 0; j < sheetData.headers.length; j++) {
      const header = sheetData.headers[j] || `Col ${j + 1}`;
      const val = row[j];
      if (val !== null && val !== undefined) {
        record[header] = typeof val === 'number' ? val : String(val);
      }
    }
    previewRows.push(record);
  }

  // Detect reference points from metadata rows above the data table
  const headerRowIndex = findHeaderRowIndex(sheetData, allRawData);
  const detectedRefs = allRawData ? detectReferencePoints(allRawData, headerRowIndex) : [];

  return {
    worksheetNames,
    selectedWorksheet: sheetData.sheetName,
    headerRow: 0,
    latitudeColumn: latCol,
    longitudeColumn: lonCol,
    siteIdColumn: siteColumns.siteIdColumn,
    legacySiteIdColumn: siteColumns.legacySiteIdColumn,
    siteNameColumn: siteColumns.siteNameColumn,
    regionColumn: siteColumns.regionColumn,
    descriptionColumn: siteColumns.descriptionColumn,
    detectedReferencePoints: detectedRefs,
    allHeaders: sheetData.headers.filter((h) => h && h.trim() !== ''),
    previewRows,
    siteCount: coordRowCount,
    coordinateRowCount: coordRowCount,
  };
}

function findHeaderRowIndex(
  sheetData: RawSheetData,
  allRawData: (string | number | null | undefined)[][] | null
): number {
  if (!allRawData) return 0;
  // Try to find the header row by matching the first header
  const firstHeader = sheetData.headers[0];
  if (!firstHeader) return 0;
  for (let i = 0; i < Math.min(allRawData.length, 20); i++) {
    const row = allRawData[i];
    if (row && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() === firstHeader.trim())) {
      return i;
    }
  }
  return 0;
}
