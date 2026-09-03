/**
 * Distance mode workbook detection module.
 *
 * Extends the existing header/column detection for site-specific columns
 * used in the Distance Between Points measurement mode.
 *
 * Intelligently locates the real destination table even if metadata, titles,
 * or warehouse notes appear above the table header.
 */

import type { DetectedColumn, RawSheetData } from '../types/workbook';
import type { DistanceWorkbookAnalysis, StartingPoint } from '../types/distance';
import { DetectionConfidence } from '../types/workbook';
import { generateUid } from '../utils/formatters';

// ─── Site-specific header aliases ──────────────────────────────────

const LATITUDE_ALIASES = new Set(['latitude', 'lat', 'y', 'dest latitude', 'destination latitude', 'site latitude']);
const LONGITUDE_ALIASES = new Set(['longitude', 'long', 'lon', 'lng', 'x', 'dest longitude', 'destination longitude', 'site longitude']);

const SITE_ID_ALIASES = new Set([
  'site id', 'siteid', 'site_id', 'ht site id', 'ht_site_id', 'htsiteid',
  'ht site', 'site code', 'site_code', 'sitecode', 'tower id', 'tower_id',
  'site_no', 'siteno',
]);

const LEGACY_ID_ALIASES = new Set([
  'legacy site id', 'legacy_site_id', 'legacysiteid', 'legacy id',
  'legacy_id', 'legacyid', 'old id', 'old_id', 'oldid', 'old site id',
]);

const SITE_NAME_ALIASES = new Set([
  'site name', 'site_name', 'sitename', 'location', 'location name',
  'location_name', 'place', 'place name', 'place_name', 'town', 'village',
  'settlement', 'station name',
]);

const REGION_ALIASES = new Set([
  'region', 'region/whs', 'region whs', 'whs', 'warehouse', 'cluster', 'area', 'zone',
  'district', 'province', 'state', 'county', 'territory',
]);

const DESCRIPTION_ALIASES = new Set([
  'description', 'desc', 'remarks', 'remark', 'comment', 'comments',
  'notes', 'note', 'type', 'category',
]);

const RANK_ALIASES = new Set([
  'rank', 'rank (furthest)', 'rank furthest', 'rank (nearest)', 'rank nearest', 'order', 'seq', 'sequence', 'no', '#'
]);

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\-\.\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesAlias(normalizedHeader: string, aliases: Set<string>): boolean {
  if (aliases.has(normalizedHeader)) return true;
  // Also check without spaces
  const noSpace = normalizedHeader.replace(/\s+/g, '');
  for (const alias of aliases) {
    if (alias.replace(/\s+/g, '') === noSpace) return true;
  }
  return false;
}

function containsAlias(normalizedHeader: string, aliases: Set<string>): boolean {
  for (const alias of aliases) {
    // Skip very short aliases for substring matching to avoid false positives
    // e.g. "y" matching inside "legacy", "x" matching inside "excel"
    if (alias.length < 3) continue;
    if (normalizedHeader.includes(alias)) return true;
  }
  return false;
}

// ─── Smart Table Finder ─────────────────────────────────────────────

/**
 * Locate the actual destination table header inside a sheet's raw rows,
 * skipping report titles, blank rows, and metadata above the table.
 */
export function findRealDistanceTable(
  rawData: (string | number | null | undefined)[][],
  sheetName: string
): {
  sheetData: RawSheetData;
  headerRowIndex: number;
} {
  if (rawData.length === 0) {
    return {
      sheetData: { sheetName, headers: [], rows: [], totalRowCount: 0 },
      headerRowIndex: 0,
    };
  }

  let bestRowIndex = 0;
  let highestScore = -1;

  const maxScanRows = Math.min(rawData.length, 30);

  for (let i = 0; i < maxScanRows; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    let score = 0;
    let foundLatIdx = -1;
    let foundLonIdx = -1;

    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell == null) continue;
      const str = String(cell).trim();
      if (!str) continue;

      const norm = normalizeHeader(str);

      if (matchesAlias(norm, LATITUDE_ALIASES)) {
        score += 15;
        foundLatIdx = j;
      } else if (matchesAlias(norm, LONGITUDE_ALIASES)) {
        score += 15;
        foundLonIdx = j;
      } else if (matchesAlias(norm, SITE_ID_ALIASES)) {
        score += 12;
      } else if (matchesAlias(norm, SITE_NAME_ALIASES)) {
        score += 10;
      } else if (matchesAlias(norm, LEGACY_ID_ALIASES)) {
        score += 10;
      } else if (matchesAlias(norm, REGION_ALIASES)) {
        score += 8;
      } else if (matchesAlias(norm, RANK_ALIASES)) {
        score += 5;
      } else if (containsAlias(norm, LATITUDE_ALIASES)) {
        score += 6;
        if (foundLatIdx === -1) foundLatIdx = j;
      } else if (containsAlias(norm, LONGITUDE_ALIASES)) {
        score += 6;
        if (foundLonIdx === -1) foundLonIdx = j;
      }
    }

    // Check if subsequent rows contain valid numeric coordinates at foundLatIdx & foundLonIdx
    if (foundLatIdx !== -1 && foundLonIdx !== -1) {
      let validSubsequentCoords = 0;
      for (let k = i + 1; k < Math.min(rawData.length, i + 6); k++) {
        const subRow = rawData[k];
        if (!subRow) continue;
        const latVal = Number(String(subRow[foundLatIdx] ?? '').trim());
        const lonVal = Number(String(subRow[foundLonIdx] ?? '').trim());
        if (!isNaN(latVal) && !isNaN(lonVal) && latVal >= -90 && latVal <= 90 && lonVal >= -180 && lonVal <= 180) {
          validSubsequentCoords++;
        }
      }
      if (validSubsequentCoords > 0) {
        score += validSubsequentCoords * 10;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestRowIndex = i;
    }
  }

  // Extract headers
  const headerRow = rawData[bestRowIndex] || [];
  const headers = headerRow.map((cell) => (cell != null ? String(cell).trim() : ''));

  // Extract data rows
  const dataRows = rawData.slice(bestRowIndex + 1).filter((row) =>
    row && row.some((cell) => cell != null && String(cell).trim() !== '')
  );

  return {
    sheetData: {
      sheetName,
      headers,
      rows: dataRows,
      totalRowCount: rawData.length,
    },
    headerRowIndex: bestRowIndex,
  };
}

// ─── Reference Point Detection ──────────────────────────────────────

/**
 * Scan rows above the table header for reference / warehouse origin coordinates.
 */
export function detectReferencePoints(
  rawData: (string | number | null | undefined)[][],
  headerRowIndex: number
): StartingPoint[] {
  const refs: StartingPoint[] = [];
  if (headerRowIndex <= 0) return refs;

  let refName = 'Warehouse Origin';
  let refLat: number | null = null;
  let refLon: number | null = null;

  for (let i = 0; i < headerRowIndex; i++) {
    const row = rawData[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell == null) continue;
      const str = String(cell).trim();
      const norm = str.toLowerCase();

      // Check if cell is a title like "Amanzi Warehouse Distance Analysis"
      if (norm.includes('warehouse') || norm.includes('origin') || norm.includes('reference') || norm.includes('depot') || norm.includes('hub')) {
        const cleanTitle = str
          .replace(/\s*(distance analysis|analysis|report|site distance)\s*/gi, '')
          .trim();
        if (cleanTitle) {
          refName = cleanTitle;
        }
      }

      // Check for labels like "Warehouse Latitude" or "Latitude"
      if (norm === 'warehouse latitude' || norm === 'origin latitude' || norm === 'ref latitude' || norm === 'warehouse lat' || norm === 'latitude' || norm === 'lat') {
        const nextCell = row[j + 1];
        if (nextCell != null) {
          const num = typeof nextCell === 'number' ? nextCell : Number(String(nextCell).trim());
          if (!isNaN(num) && num >= -90 && num <= 90) {
            refLat = num;
          }
        }
      }

      // Check for labels like "Warehouse Longitude" or "Longitude"
      if (norm === 'warehouse longitude' || norm === 'origin longitude' || norm === 'ref longitude' || norm === 'warehouse lon' || norm === 'warehouse long' || norm === 'longitude' || norm === 'long' || norm === 'lon' || norm === 'lng') {
        const nextCell = row[j + 1];
        if (nextCell != null) {
          const num = typeof nextCell === 'number' ? nextCell : Number(String(nextCell).trim());
          if (!isNaN(num) && num >= -180 && num <= 180) {
            refLon = num;
          }
        }
      }
    }
  }

  if (refLat !== null && refLon !== null) {
    refs.push({
      uid: generateUid(),
      name: refName,
      latitude: refLat,
      longitude: refLon,
      description: 'Detected from workbook metadata',
      source: 'detected',
      sourceRow: 1,
    });
  }

  return refs;
}

// ─── Detect Site Columns ────────────────────────────────────────────

function detectSiteColumns(sheetData: RawSheetData): {
  siteIdColumn: DetectedColumn | null;
  legacySiteIdColumn: DetectedColumn | null;
  siteNameColumn: DetectedColumn | null;
  regionColumn: DetectedColumn | null;
  descriptionColumn: DetectedColumn | null;
  latitudeColumn: DetectedColumn | null;
  longitudeColumn: DetectedColumn | null;
} {
  let latCol: DetectedColumn | null = null;
  let lonCol: DetectedColumn | null = null;
  let siteIdCol: DetectedColumn | null = null;
  let legacyIdCol: DetectedColumn | null = null;
  let siteNameCol: DetectedColumn | null = null;
  let regionCol: DetectedColumn | null = null;
  let descCol: DetectedColumn | null = null;

  for (let i = 0; i < sheetData.headers.length; i++) {
    const header = sheetData.headers[i];
    if (!header || header.trim() === '') continue;

    const normalized = normalizeHeader(header);

    // Latitude
    if (!latCol && (matchesAlias(normalized, LATITUDE_ALIASES) || containsAlias(normalized, LATITUDE_ALIASES))) {
      latCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, LATITUDE_ALIASES) ? DetectionConfidence.High : DetectionConfidence.Medium,
        reason: `Header "${header}" matches latitude pattern`,
      };
      continue;
    }

    // Longitude
    if (!lonCol && (matchesAlias(normalized, LONGITUDE_ALIASES) || containsAlias(normalized, LONGITUDE_ALIASES))) {
      lonCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, LONGITUDE_ALIASES) ? DetectionConfidence.High : DetectionConfidence.Medium,
        reason: `Header "${header}" matches longitude pattern`,
      };
      continue;
    }

    // Site ID (HT Site ID)
    if (!siteIdCol && (matchesAlias(normalized, SITE_ID_ALIASES) || containsAlias(normalized, SITE_ID_ALIASES))) {
      siteIdCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, SITE_ID_ALIASES) ? DetectionConfidence.High : DetectionConfidence.Medium,
        reason: `Header "${header}" matches site ID pattern`,
      };
      continue;
    }

    // Legacy Site ID
    if (!legacyIdCol && (matchesAlias(normalized, LEGACY_ID_ALIASES) || containsAlias(normalized, LEGACY_ID_ALIASES))) {
      legacyIdCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, LEGACY_ID_ALIASES) ? DetectionConfidence.High : DetectionConfidence.Medium,
        reason: `Header "${header}" matches legacy ID pattern`,
      };
      continue;
    }

    // Site Name
    if (!siteNameCol && (matchesAlias(normalized, SITE_NAME_ALIASES) || containsAlias(normalized, SITE_NAME_ALIASES))) {
      siteNameCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, SITE_NAME_ALIASES) ? DetectionConfidence.High : DetectionConfidence.Medium,
        reason: `Header "${header}" matches site name pattern`,
      };
      continue;
    }

    // Region / WHS
    if (!regionCol && (matchesAlias(normalized, REGION_ALIASES) || containsAlias(normalized, REGION_ALIASES))) {
      regionCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: matchesAlias(normalized, REGION_ALIASES) ? DetectionConfidence.High : DetectionConfidence.Medium,
        reason: `Header "${header}" matches region pattern`,
      };
      continue;
    }

    // Description
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
    latitudeColumn: latCol,
    longitudeColumn: lonCol,
    siteIdColumn: siteIdCol,
    legacySiteIdColumn: legacyIdCol,
    siteNameColumn: siteNameCol,
    regionColumn: regionCol,
    descriptionColumn: descCol,
  };
}

// ─── Main Analysis Function ─────────────────────────────────────────

export function analyzeDistanceWorkbook(
  sheetData: RawSheetData,
  allRawData: (string | number | null | undefined)[][] | null,
  worksheetNames: string[]
): DistanceWorkbookAnalysis {
  // If allRawData is provided, locate real table
  let finalSheetData = sheetData;
  let headerRow = 0;
  let detectedRefs: StartingPoint[] = [];

  if (allRawData && allRawData.length > 0) {
    const tableResult = findRealDistanceTable(allRawData, sheetData.sheetName);
    finalSheetData = tableResult.sheetData;
    headerRow = tableResult.headerRowIndex;
    detectedRefs = detectReferencePoints(allRawData, headerRow);
  }

  // Detect site columns
  const siteColumns = detectSiteColumns(finalSheetData);

  // Count usable coordinate rows
  let coordRowCount = 0;
  const latCol = siteColumns.latitudeColumn;
  const lonCol = siteColumns.longitudeColumn;

  if (latCol && lonCol) {
    for (const row of finalSheetData.rows) {
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

  // Build preview rows with useful columns
  const previewRows: Record<string, string | number>[] = [];
  for (let i = 0; i < Math.min(finalSheetData.rows.length, 5); i++) {
    const row = finalSheetData.rows[i];
    const record: Record<string, string | number> = {};
    for (let j = 0; j < finalSheetData.headers.length; j++) {
      const header = finalSheetData.headers[j] || `Col ${j + 1}`;
      const val = row[j];
      if (val !== null && val !== undefined) {
        record[header] = typeof val === 'number' ? val : String(val);
      }
    }
    previewRows.push(record);
  }

  return {
    worksheetNames,
    selectedWorksheet: finalSheetData.sheetName,
    headerRow,
    latitudeColumn: latCol,
    longitudeColumn: lonCol,
    siteIdColumn: siteColumns.siteIdColumn,
    legacySiteIdColumn: siteColumns.legacySiteIdColumn,
    siteNameColumn: siteColumns.siteNameColumn,
    regionColumn: siteColumns.regionColumn,
    descriptionColumn: siteColumns.descriptionColumn,
    detectedReferencePoints: detectedRefs,
    allHeaders: finalSheetData.headers.filter((h) => h && h.trim() !== ''),
    previewRows,
    siteCount: coordRowCount,
    coordinateRowCount: coordRowCount,
  };
}

