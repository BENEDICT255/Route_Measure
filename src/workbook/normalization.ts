/**
 * Normalization module.
 */

import type { RoutePoint, MeasurementResult, ValidationMessage } from '../types/coordinates';
import { ValidationSeverity } from '../types/coordinates';
import type { WorkbookAnalysis, RawSheetData, ParsedPoint } from '../types/workbook';
import { parseCoordinateValue, validateCoordinates } from '../measurement/coordinateValidation';
import { detectRoutes, type RouteGroup } from './routeDetection';
import { calculateAllRoutes } from '../measurement/routeCalculator';
import { generateUid } from '../utils/formatters';
import { MAX_COORDINATE_ROWS, MAX_ROUTES } from '../utils/constants';
import { sanitizeDisplayText } from '../utils/sanitize';

export function extractParsedPoints(
  sheetData: RawSheetData,
  analysis: WorkbookAnalysis
): { points: ParsedPoint[]; messages: ValidationMessage[] } {
  const messages: ValidationMessage[] = [];

  if (!analysis.latitudeColumn || !analysis.longitudeColumn) {
    messages.push({
      severity: ValidationSeverity.Error,
      message: 'Latitude and longitude columns must be identified before processing.',
    });
    return { points: [], messages };
  }

  const latIdx = analysis.latitudeColumn.columnIndex;
  const lonIdx = analysis.longitudeColumn.columnIndex;
  const pointIdx = analysis.pointColumn?.columnIndex;
  const routeIdx = analysis.routeColumn?.columnIndex;
  const descIdx = analysis.descriptionColumn?.columnIndex;
  const orderIdx = analysis.orderColumn?.columnIndex;

  if (sheetData.rows.length > MAX_COORDINATE_ROWS) {
    messages.push({
      severity: ValidationSeverity.Error,
      message: `The workbook contains ${sheetData.rows.length} data rows, which exceeds the maximum of ${MAX_COORDINATE_ROWS}.`,
    });
    return { points: [], messages };
  }

  const points: ParsedPoint[] = [];

  for (let i = 0; i < sheetData.rows.length; i++) {
    const row = sheetData.rows[i];
    const sourceRow = analysis.headerRow + i + 2;

    const rawLat = row[latIdx];
    const rawLon = row[lonIdx];

    if (
      (rawLat === null || rawLat === undefined || String(rawLat).trim() === '') &&
      (rawLon === null || rawLon === undefined || String(rawLon).trim() === '')
    ) {
      continue;
    }

    const label =
      pointIdx !== undefined && row[pointIdx] !== null && row[pointIdx] !== undefined
        ? sanitizeDisplayText(row[pointIdx])
        : undefined;

    const routeId =
      routeIdx !== undefined && row[routeIdx] !== null && row[routeIdx] !== undefined
        ? String(row[routeIdx]).trim()
        : undefined;

    const description =
      descIdx !== undefined && row[descIdx] !== null && row[descIdx] !== undefined
        ? sanitizeDisplayText(row[descIdx])
        : undefined;

    const orderValue =
      orderIdx !== undefined && row[orderIdx] !== null && row[orderIdx] !== undefined
        ? Number(row[orderIdx])
        : undefined;

    const originalRow: Record<string, string | number | null | undefined> = {};
    for (let j = 0; j < sheetData.headers.length; j++) {
      if (sheetData.headers[j]) {
        originalRow[sheetData.headers[j]] = row[j];
      }
    }

    points.push({
      sourceRow,
      rawLatitude: rawLat,
      rawLongitude: rawLon,
      label,
      routeId,
      description,
      orderValue: isNaN(orderValue as number) ? undefined : orderValue,
      originalRow,
    });
  }

  return { points, messages };
}

export function normalizeToRoutePoints(
  routeGroups: RouteGroup[],
  sourceFile: string,
  sourceSheet: string
): {
  routeMap: Map<string, { name: string; points: RoutePoint[] }>;
  messages: ValidationMessage[];
} {
  const messages: ValidationMessage[] = [];

  if (routeGroups.length > MAX_ROUTES) {
    messages.push({
      severity: ValidationSeverity.Error,
      message: `Found ${routeGroups.length} routes, which exceeds the maximum of ${MAX_ROUTES}.`,
    });
    return { routeMap: new Map(), messages };
  }

  const routeMap = new Map<string, { name: string; points: RoutePoint[] }>();

  for (const group of routeGroups) {
    const routePoints: RoutePoint[] = [];

    const toValidate = group.points.map((p) => ({
      sourceRow: p.sourceRow,
      label: p.label || '',
      latitude: parseCoordinateValue(p.rawLatitude),
      longitude: parseCoordinateValue(p.rawLongitude),
      routeUid: group.routeId,
    }));

    const validation = validateCoordinates(toValidate);
    messages.push(...validation.messages);

    for (let i = 0; i < validation.validPoints.length; i++) {
      const vp = validation.validPoints[i];
      const originalParsed = group.points.find((p) => p.sourceRow === vp.sourceRow);

      routePoints.push({
        uid: generateUid(),
        routeUid: group.routeId,
        sequenceIndex: i,
        latitude: vp.latitude!,
        longitude: vp.longitude!,
        originalLatitude: vp.latitude!,
        originalLongitude: vp.longitude!,
        displayLabel: vp.label || `Point ${i + 1}`,
        description: originalParsed?.description,
        sourceFile,
        sourceSheet,
        sourceRow: vp.sourceRow,
        metadata: originalParsed?.originalRow as Record<string, string | number> | undefined,
      });
    }

    routeMap.set(group.routeId, {
      name: group.routeName,
      points: routePoints,
    });
  }

  return { routeMap, messages };
}

export function processWorkbook(
  sheetData: RawSheetData,
  analysis: WorkbookAnalysis,
  sourceFile: string
): MeasurementResult {
  const { points: parsedPoints, messages: extractMessages } = extractParsedPoints(sheetData, analysis);
  const routeGroups = detectRoutes(parsedPoints);
  const { routeMap, messages: normalizeMessages } = normalizeToRoutePoints(routeGroups, sourceFile, analysis.selectedWorksheet);
  const result = calculateAllRoutes(routeMap, sourceFile, analysis.selectedWorksheet);

  result.validationMessages = [
    ...extractMessages,
    ...normalizeMessages,
    ...result.validationMessages,
  ];

  return result;
}
