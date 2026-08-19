/**
 * Header detection module.
 */

import type { DetectedColumn, RawSheetData } from '../types/workbook';
import { DetectionConfidence } from '../types/workbook';

const LATITUDE_ALIASES = new Set(['latitude', 'lat', 'y']);
const LONGITUDE_ALIASES = new Set(['longitude', 'long', 'lon', 'lng', 'x']);
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

    if (matchesAlias(normalized, LATITUDE_ALIASES)) {
      latCandidates.push({
        columnIndex: i,
        originalHeader: header,
        confidence: DetectionConfidence.High,
        reason: `Header "${header}" matches known latitude alias`,
      });
    }

    if (matchesAlias(normalized, LONGITUDE_ALIASES)) {
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
