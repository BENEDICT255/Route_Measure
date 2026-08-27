/**
 * Distance mode workbook parser.
 *
 * Parses RawSheetData + DistanceWorkbookAnalysis into DestinationSite[].
 * Each row becomes a destination site with coordinates, metadata, and assignment state.
 */

import type { RawSheetData } from '../types/workbook';
import type { DistanceWorkbookAnalysis, DestinationSite } from '../types/distance';
import type { ValidationMessage } from '../types/coordinates';
import { ValidationSeverity } from '../types/coordinates';
import { generateUid } from '../utils/formatters';

/**
 * Parse destination sites from a workbook using distance mode analysis.
 */
export function parseDestinationSites(
  sheetData: RawSheetData,
  analysis: DistanceWorkbookAnalysis,
  sourceFile: string
): {
  destinations: DestinationSite[];
  validationMessages: ValidationMessage[];
} {
  const destinations: DestinationSite[] = [];
  const messages: ValidationMessage[] = [];

  if (!analysis.latitudeColumn || !analysis.longitudeColumn) {
    messages.push({
      severity: ValidationSeverity.Error,
      message: 'Latitude and/or longitude columns could not be detected.',
    });
    return { destinations, validationMessages: messages };
  }

  const latIdx = analysis.latitudeColumn.columnIndex;
  const lonIdx = analysis.longitudeColumn.columnIndex;
  const siteIdIdx = analysis.siteIdColumn?.columnIndex ?? -1;
  const legacyIdIdx = analysis.legacySiteIdColumn?.columnIndex ?? -1;
  const siteNameIdx = analysis.siteNameColumn?.columnIndex ?? -1;
  const regionIdx = analysis.regionColumn?.columnIndex ?? -1;
  const descIdx = analysis.descriptionColumn?.columnIndex ?? -1;

  for (let i = 0; i < sheetData.rows.length; i++) {
    const row = sheetData.rows[i];
    const sourceRow = i + 2; // 1-indexed, +1 for header

    const rawLat = row[latIdx];
    const rawLon = row[lonIdx];

    // Skip completely empty rows
    if (rawLat == null && rawLon == null) continue;

    // Parse coordinates
    const lat = typeof rawLat === 'number' ? rawLat : Number(String(rawLat ?? '').trim());
    const lon = typeof rawLon === 'number' ? rawLon : Number(String(rawLon ?? '').trim());

    // Validate
    let status: DestinationSite['status'] = 'unassigned';
    let validationError: string | undefined;

    if (isNaN(lat) || isNaN(lon)) {
      status = 'invalid';
      validationError = `Row ${sourceRow}: Invalid coordinate values (lat: ${rawLat}, lon: ${rawLon})`;
      messages.push({
        severity: ValidationSeverity.Error,
        message: validationError,
        sourceRow,
      });
    } else if (lat < -90 || lat > 90) {
      status = 'invalid';
      validationError = `Row ${sourceRow}: Latitude ${lat} is out of range (-90 to +90)`;
      messages.push({
        severity: ValidationSeverity.Error,
        message: validationError,
        sourceRow,
      });
    } else if (lon < -180 || lon > 180) {
      status = 'invalid';
      validationError = `Row ${sourceRow}: Longitude ${lon} is out of range (-180 to +180)`;
      messages.push({
        severity: ValidationSeverity.Error,
        message: validationError,
        sourceRow,
      });
    }

    // Extract metadata
    const extractCell = (idx: number): string | undefined => {
      if (idx < 0) return undefined;
      const val = row[idx];
      if (val == null) return undefined;
      return String(val).trim() || undefined;
    };

    const siteId = extractCell(siteIdIdx);
    const legacySiteId = extractCell(legacyIdIdx);
    const siteName = extractCell(siteNameIdx);
    const region = extractCell(regionIdx);
    const description = extractCell(descIdx);

    // Build metadata record with all original values
    const metadata: Record<string, string | number> = {};
    for (let j = 0; j < sheetData.headers.length; j++) {
      const header = sheetData.headers[j];
      const val = row[j];
      if (header && val != null) {
        metadata[header] = typeof val === 'number' ? val : String(val);
      }
    }

    destinations.push({
      uid: generateUid(),
      latitude: isNaN(lat) ? 0 : lat,
      longitude: isNaN(lon) ? 0 : lon,
      siteId,
      legacySiteId,
      siteName,
      region,
      description,
      sourceRow,
      sourceSheet: sheetData.sheetName,
      metadata,
      assignedStartingPointUid: null,
      status,
      validationError,
    });
  }

  if (destinations.length === 0) {
    messages.push({
      severity: ValidationSeverity.Error,
      message: 'No valid destination sites found in the workbook.',
    });
  } else {
    const validCount = destinations.filter((d) => d.status !== 'invalid').length;
    const invalidCount = destinations.filter((d) => d.status === 'invalid').length;

    messages.push({
      severity: ValidationSeverity.Info,
      message: `Detected ${validCount} destination sites${invalidCount > 0 ? ` (${invalidCount} with invalid coordinates)` : ''}.`,
    });
  }

  return { destinations, validationMessages: messages };
}

/**
 * Get a display label for a destination site.
 * Uses the best available identifier.
 */
export function getDestinationDisplayLabel(dest: DestinationSite): string {
  if (dest.siteId && dest.siteName) return `${dest.siteId} — ${dest.siteName}`;
  if (dest.siteName) return dest.siteName;
  if (dest.siteId) return dest.siteId;
  if (dest.legacySiteId) return dest.legacySiteId;
  return `Site (Row ${dest.sourceRow})`;
}

/**
 * Get the unique regions/groups present in the destination data.
 */
export function getUniqueRegions(destinations: DestinationSite[]): string[] {
  const regions = new Set<string>();
  for (const dest of destinations) {
    if (dest.region) regions.add(dest.region);
  }
  return Array.from(regions).sort();
}
