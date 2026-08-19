/**
 * Coordinate validation module.
 *
 * Validates coordinate data before measurement.
 * Distinguishes between errors, warnings, and informational messages.
 */

import type {
  ValidationMessage,
  RoutePoint,
} from '../types/coordinates';
import { ValidationSeverity } from '../types/coordinates';

/** Minimum latitude value (WGS84) */
const MIN_LATITUDE = -90;
/** Maximum latitude value (WGS84) */
const MAX_LATITUDE = 90;
/** Minimum longitude value (WGS84) */
const MIN_LONGITUDE = -180;
/** Maximum longitude value (WGS84) */
const MAX_LONGITUDE = 180;

/**
 * Validate a single latitude value.
 * Must be between -90 and +90.
 */
export function isValidLatitude(value: number): boolean {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    isFinite(value) &&
    value >= MIN_LATITUDE &&
    value <= MAX_LATITUDE
  );
}

/**
 * Validate a single longitude value.
 * Must be between -180 and +180.
 */
export function isValidLongitude(value: number): boolean {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    isFinite(value) &&
    value >= MIN_LONGITUDE &&
    value <= MAX_LONGITUDE
  );
}

/**
 * Parse a raw coordinate value to a number.
 * Handles string values that represent numbers (e.g. coordinates stored as text).
 */
export function parseCoordinateValue(
  raw: string | number | null | undefined
): number | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  if (typeof raw === 'number') {
    return isFinite(raw) ? raw : null;
  }

  const trimmed = String(raw).trim();
  if (trimmed === '') return null;

  const parsed = Number(trimmed);
  return isFinite(parsed) ? parsed : null;
}

/**
 * Validate an array of parsed points and produce validation messages.
 */
export function validateCoordinates(
  points: {
    sourceRow: number;
    label: string;
    latitude: number | null;
    longitude: number | null;
    routeUid: string;
  }[]
): {
  validPoints: typeof points;
  messages: ValidationMessage[];
  hasErrors: boolean;
} {
  const messages: ValidationMessage[] = [];
  const validPoints: typeof points = [];
  let hasErrors = false;

  if (points.length === 0) {
    messages.push({
      severity: ValidationSeverity.Error,
      message: 'No coordinate data was found in the workbook.',
    });
    return { validPoints: [], messages, hasErrors: true };
  }

  for (const point of points) {
    const { sourceRow, label, latitude, longitude, routeUid } = point;
    let pointValid = true;

    if (latitude === null) {
      messages.push({
        severity: ValidationSeverity.Error,
        message: `Latitude is missing for row ${sourceRow}${label ? ` (${label})` : ''}.`,
        sourceRow,
        routeUid,
      });
      pointValid = false;
      hasErrors = true;
    }

    if (longitude === null) {
      messages.push({
        severity: ValidationSeverity.Error,
        message: `Longitude is missing for row ${sourceRow}${label ? ` (${label})` : ''}.`,
        sourceRow,
        routeUid,
      });
      pointValid = false;
      hasErrors = true;
    }

    if (latitude !== null && !isValidLatitude(latitude)) {
      messages.push({
        severity: ValidationSeverity.Error,
        message: `Latitude ${latitude} is invalid for row ${sourceRow}${label ? ` (${label})` : ''}. Latitude must be between -90 and +90.`,
        sourceRow,
        routeUid,
      });
      pointValid = false;
      hasErrors = true;
    }

    if (longitude !== null && !isValidLongitude(longitude)) {
      messages.push({
        severity: ValidationSeverity.Error,
        message: `Longitude ${longitude} is invalid for row ${sourceRow}${label ? ` (${label})` : ''}. Longitude must be between -180 and +180.`,
        sourceRow,
        routeUid,
      });
      pointValid = false;
      hasErrors = true;
    }

    if (pointValid) {
      validPoints.push(point);
    }
  }

  return { validPoints, messages, hasErrors };
}

/**
 * Check for identical consecutive coordinates in a route.
 */
export function checkConsecutiveDuplicates(
  points: RoutePoint[]
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    if (
      prev.latitude === curr.latitude &&
      prev.longitude === curr.longitude
    ) {
      messages.push({
        severity: ValidationSeverity.Warning,
        message: `Points ${prev.sequenceIndex + 1} (${prev.displayLabel}) and ${curr.sequenceIndex + 1} (${curr.displayLabel}) have identical coordinates. Segment distance will be 0 m.`,
        sourceRow: curr.sourceRow,
        pointUid: curr.uid,
        routeUid: curr.routeUid,
      });
    }
  }

  return messages;
}

/**
 * Check if a route has enough points for measurement.
 */
export function validateRouteMinimumPoints(
  points: RoutePoint[],
  routeName: string
): ValidationMessage | null {
  if (points.length === 0) {
    return {
      severity: ValidationSeverity.Error,
      message: `Route "${routeName}" contains no valid coordinates.`,
    };
  }

  if (points.length === 1) {
    return {
      severity: ValidationSeverity.Error,
      message: `Route "${routeName}" contains only 1 valid coordinate. At least 2 coordinates are required to calculate a route distance.`,
      pointUid: points[0].uid,
    };
  }

  return null;
}

/**
 * Detect if latitude and longitude columns may be swapped.
 */
export function detectPossibleLatLonSwap(
  latValues: number[],
  lonValues: number[]
): {
  possiblySwapped: boolean;
  reason: string;
} {
  const latAllValid = latValues.every((v) => isValidLatitude(v));
  const lonAllValid = lonValues.every((v) => isValidLongitude(v));

  if (!latAllValid && lonAllValid) {
    const swappedLatValid = lonValues.every((v) => isValidLatitude(v));
    const swappedLonValid = latValues.every((v) => isValidLongitude(v));

    if (swappedLatValid && swappedLonValid) {
      return {
        possiblySwapped: true,
        reason:
          'The detected latitude column contains values outside the valid range (-90 to +90), but swapping latitude and longitude columns would produce valid coordinates.',
      };
    }
  }

  return { possiblySwapped: false, reason: '' };
}
