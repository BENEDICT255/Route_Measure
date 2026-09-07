/**
 * Header detection module.
 */

import type { DetectedColumn, RawSheetData } from '../types/workbook';
import { DetectionConfidence } from '../types/workbook';

const LATITUDE_EXACT_ALIASES = new Set([
  'latitude', 'lat', 'y', 'northing', 'north',
  'latitude dd', 'lat dd', 'latitude deg', 'lat deg', 'latitude d',
  'gps latitude', 'gps lat', 'site latitude', 'site lat',
  'pole latitude', 'pole lat', 'coordinate latitude', 'coord latitude',
  'lat n', 'latitude n', 'latitude wgs84', 'wgs84 lat',
  'coord y', 'coordinate y', 'y coord', 'y coordinate'
]);

const LONGITUDE_EXACT_ALIASES = new Set([
  'longitude', 'long', 'lon', 'lng', 'x', 'easting', 'east',
  'longitude dd', 'long dd', 'lon dd', 'lng dd', 'longitude deg', 'long deg', 'lon deg',
  'gps longitude', 'gps long', 'gps lon', 'gps lng',
  'site longitude', 'site long', 'site lon',
  'pole longitude', 'pole long', 'pole lon', 'coordinate longitude', 'coord longitude',
  'lon e', 'long e', 'longitude e', 'longitude wgs84', 'wgs84 lon',
  'coord x', 'coordinate x', 'x coord', 'x coordinate'
]);

const POINT_ALIASES = new Set(['point', 'point id', 'point no', 'pointid', 'pointno', 'pole', 'pole no', 'poleno', 'pole number', 'pole description', 'name', 'label', 'id', 'marker', 'station', 'wp', 'waypoint']);
const ROUTE_ALIASES = new Set(['route', 'route id', 'routeid', 'line', 'line id', 'lineid', 'circuit', 'section', 'group']);
const DESCRIPTION_ALIASES = new Set(['description', 'desc', 'remarks', 'remark', 'comment', 'comments', 'notes', 'note', 'type']);
const ORDER_ALIASES = new Set(['sequence', 'seq', 'order', 'no', 'number', '#', 'index', 'sort']);

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesAlias(normalizedHeader: string, aliases: Set<string>): boolean {
  return aliases.has(normalizedHeader);
}

function isLatitudeHeader(normalized: string): boolean {
  const clean = normalized.replace(/[()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  if (LATITUDE_EXACT_ALIASES.has(clean)) return true;
  if (/\b(latitude|northing)\b/i.test(clean)) return true;
  if (/\blat\b/i.test(clean) && !/\b(relative|plate|plateau|template|latest|late)\b/i.test(clean)) {
    return true;
  }
  return false;
}

function isLongitudeHeader(normalized: string): boolean {
  const clean = normalized.replace(/[()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  if (LONGITUDE_EXACT_ALIASES.has(clean)) return true;
  if (/\b(longitude|easting)\b/i.test(clean)) return true;
  if (/\b(lon|lng|long)\b/i.test(clean) && !/\b(along|belong|prolong|furlong)\b/i.test(clean)) {
    return true;
  }
  return false;
}

export function detectColumns(sheetData: RawSheetData): {
  latitude: DetectedColumn | null;
  longitude: DetectedColumn | null;
  point: DetectedColumn | null;
  route: DetectedColumn | null;
  description: DetectedColumn | null;
  order: DetectedColumn | null;
  alternativeLatColumns: DetectedColumn[];
  alternativeLonColumns: DetectedColumn[];
} {
  const latCandidates: DetectedColumn[] = [];
  const lonCandidates: DetectedColumn[] = [];
  let pointCol: DetectedColumn | null = null;
  let routeCol: DetectedColumn | null = null;
  let descCol: DetectedColumn | null = null;
  let orderCol: DetectedColumn | null = null;

  for (let i = 0; i < sheetData.headers.length; i++) {
    const header = sheetData.headers[i];
    if (!header || header.trim() === '') continue;

    const normalized = normalizeHeader(header);

    if (isLatitudeHeader(normalized)) {
      latCandidates.push({
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.High,
        reason: `Header "${header}" matches known latitude alias`,
      });
    }

    if (isLongitudeHeader(normalized)) {
      lonCandidates.push({
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.High,
        reason: `Header "${header}" matches known longitude alias`,
      });
    }

    if (!pointCol && matchesAlias(normalized, POINT_ALIASES)) {
      pointCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.High,
        reason: `Header "${header}" matches known point/label alias`,
      };
    }

    if (!routeCol && matchesAlias(normalized, ROUTE_ALIASES)) {
      routeCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.High,
        reason: `Header "${header}" matches known route alias`,
      };
    }

    if (!descCol && matchesAlias(normalized, DESCRIPTION_ALIASES)) {
      descCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.Medium,
        reason: `Header "${header}" matches known description alias`,
      };
    }

    if (!orderCol && matchesAlias(normalized, ORDER_ALIASES)) {
      orderCol = {
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.Medium,
        reason: `Header "${header}" matches known ordering alias`,
      };
    }
  }

  return {
    latitude: latCandidates.length > 0 ? latCandidates[0] : null,
    longitude: lonCandidates.length > 0 ? lonCandidates[0] : null,
    point: pointCol,
    route: routeCol,
    description: descCol,
    order: orderCol,
    alternativeLatColumns: latCandidates.length > 1 ? latCandidates : [],
    alternativeLonColumns: lonCandidates.length > 1 ? lonCandidates : [],
  };
}
