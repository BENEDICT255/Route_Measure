/**
 * RouteMeasure Assistant Deterministic Validation Engine
 * 
 * Strict client-side mathematical and schema validation.
 * The AI proposal must pass through this validator before reaching human review or the measurement engine.
 * AI confidence can NEVER override these deterministic rules.
 */

import type {
  NormalizedPointRecord,
  NormalizedDistanceRecord,
  ValidationStatus,
  AssistantPreparationResult,
  AssistantTargetMode,
} from './types';

export interface CoordinateCheckResult {
  valid: boolean;
  parsedLat: number | null;
  parsedLon: number | null;
  errors: string[];
  warnings: string[];
}

/**
 * Deterministically checks latitude and longitude values.
 */
export function validateCoordinatePair(
  rawLat: unknown,
  rawLon: unknown
): CoordinateCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse numeric values
  let latNum: number | null = null;
  let lonNum: number | null = null;

  if (rawLat !== null && rawLat !== undefined && String(rawLat).trim() !== '') {
    const parsed = Number(rawLat);
    if (Number.isFinite(parsed)) {
      latNum = parsed;
    } else {
      errors.push(`Latitude "${rawLat}" is not a valid number.`);
    }
  } else {
    errors.push('Latitude is missing.');
  }

  if (rawLon !== null && rawLon !== undefined && String(rawLon).trim() !== '') {
    const parsed = Number(rawLon);
    if (Number.isFinite(parsed)) {
      lonNum = parsed;
    } else {
      errors.push(`Longitude "${rawLon}" is not a valid number.`);
    }
  } else {
    errors.push('Longitude is missing.');
  }

  if (latNum !== null && lonNum !== null) {
    // Check for projected coordinates (UTM / Easting / Northing)
    if (Math.abs(latNum) > 1000 || Math.abs(lonNum) > 1000) {
      errors.push(
        `Values (${latNum}, ${lonNum}) appear to be projected coordinates (e.g. UTM Easting/Northing). RouteMeasure requires WGS84 decimal degrees.`
      );
      return { valid: false, parsedLat: latNum, parsedLon: lonNum, errors, warnings };
    }

    // Check latitude range: -90 to +90
    if (latNum < -90 || latNum > 90) {
      // Check if latitude and longitude might be swapped
      if (latNum >= -180 && latNum <= 180 && lonNum >= -90 && lonNum <= 90) {
        errors.push(
          `Latitude ${latNum}° is outside the valid WGS84 range [-90°, +90°]. Coordinates appear to be swapped with longitude.`
        );
      } else {
        errors.push(`Latitude ${latNum}° is outside the valid WGS84 range of -90° to +90°.`);
      }
    }

    // Check longitude range: -180 to +180
    if (lonNum < -180 || lonNum > 180) {
      errors.push(`Longitude ${lonNum}° is outside the valid WGS84 range of -180° to +180°.`);
    }

    // Check for exact zero coordinates (often null GPS placeholder)
    if (latNum === 0 && lonNum === 0) {
      warnings.push('Coordinates are (0.000, 0.000) (Null Island). Verify if this is an intentional GPS location.');
    }
  }

  const valid = errors.length === 0 && latNum !== null && lonNum !== null;
  return { valid, parsedLat: latNum, parsedLon: lonNum, errors, warnings };
}

/**
 * Validates an array of LV/MV normalized points.
 */
export function validateNormalizedPoints(
  rawPoints: Partial<NormalizedPointRecord>[]
): NormalizedPointRecord[] {
  const coordSeen = new Map<string, number>();

  // Count coordinates for duplicate detection
  for (const p of rawPoints) {
    if (p.latitude != null && p.longitude != null) {
      const key = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
      coordSeen.set(key, (coordSeen.get(key) || 0) + 1);
    }
  }

  return rawPoints.map((p, idx) => {
    const id = p.id || `pt-${idx + 1}-${Date.now()}`;
    const pointId = p.pointId ? String(p.pointId).trim() : `Point ${idx + 1}`;
    const coordCheck = validateCoordinatePair(p.latitude ?? p.rawLatitude, p.longitude ?? p.rawLongitude);

    const errors: string[] = [...coordCheck.errors];
    const warnings: string[] = [...(p.warnings || []), ...coordCheck.warnings];

    // Check duplicate coordinates
    if (coordCheck.parsedLat != null && coordCheck.parsedLon != null) {
      const key = `${coordCheck.parsedLat.toFixed(6)},${coordCheck.parsedLon.toFixed(6)}`;
      if ((coordSeen.get(key) || 0) > 1) {
        warnings.push(`Duplicate coordinates detected (${key}).`);
      }
    }

    // Check Route Type
    let routeType = p.routeType || 'unclassified';
    if (routeType === 'unclassified') {
      warnings.push('Route voltage classification is unconfirmed (LV or MV). Review recommended.');
    }

    // Determine status
    let status: ValidationStatus = 'valid';
    if (errors.length > 0) {
      status = 'invalid';
    } else if (warnings.length > 0 || routeType === 'unclassified') {
      status = 'needs_review';
    }

    return {
      id,
      status,
      routeType,
      routeId: p.routeId || (routeType === 'LV' ? 'LV Route' : routeType === 'MV' ? 'MV Route' : 'Route 1'),
      pointId,
      latitude: coordCheck.parsedLat,
      longitude: coordCheck.parsedLon,
      rawLatitude: p.rawLatitude ?? p.latitude ?? undefined,
      rawLongitude: p.rawLongitude ?? p.longitude ?? undefined,
      description: p.description ? String(p.description).trim() : undefined,
      source: p.source || { type: 'unknown' },
      confidence: p.confidence,
      warnings,
      validationErrors: errors.length > 0 ? errors : undefined,
    };
  });
}

/**
 * Validates an array of Distance Between Points destination sites.
 */
export function validateNormalizedDistanceSites(
  rawSites: Partial<NormalizedDistanceRecord>[]
): NormalizedDistanceRecord[] {
  const coordSeen = new Map<string, number>();

  for (const s of rawSites) {
    if (s.latitude != null && s.longitude != null) {
      const key = `${s.latitude.toFixed(6)},${s.longitude.toFixed(6)}`;
      coordSeen.set(key, (coordSeen.get(key) || 0) + 1);
    }
  }

  return rawSites.map((s, idx) => {
    const id = s.id || `dst-${idx + 1}-${Date.now()}`;
    const siteId = s.siteId ? String(s.siteId).trim() : `SITE-${idx + 1}`;
    const siteName = s.siteName ? String(s.siteName).trim() : siteId;
    const coordCheck = validateCoordinatePair(s.latitude ?? s.rawLatitude, s.longitude ?? s.rawLongitude);

    const errors: string[] = [...coordCheck.errors];
    const warnings: string[] = [...(s.warnings || []), ...coordCheck.warnings];

    if (coordCheck.parsedLat != null && coordCheck.parsedLon != null) {
      const key = `${coordCheck.parsedLat.toFixed(6)},${coordCheck.parsedLon.toFixed(6)}`;
      if ((coordSeen.get(key) || 0) > 1) {
        warnings.push(`Duplicate destination coordinates (${key}).`);
      }
    }

    let status: ValidationStatus = 'valid';
    if (errors.length > 0) {
      status = 'invalid';
    } else if (warnings.length > 0) {
      status = 'needs_review';
    }

    return {
      id,
      status,
      siteId,
      legacySiteId: s.legacySiteId ? String(s.legacySiteId).trim() : undefined,
      siteName,
      region: s.region ? String(s.region).trim() : undefined,
      latitude: coordCheck.parsedLat,
      longitude: coordCheck.parsedLon,
      rawLatitude: s.rawLatitude ?? s.latitude ?? undefined,
      rawLongitude: s.rawLongitude ?? s.longitude ?? undefined,
      description: s.description ? String(s.description).trim() : undefined,
      source: s.source || { type: 'unknown' },
      confidence: s.confidence,
      warnings,
      validationErrors: errors.length > 0 ? errors : undefined,
    };
  });
}

/**
 * Computes an overall summary from validated records.
 */
export function buildPreparationSummary(
  mode: AssistantTargetMode,
  points: NormalizedPointRecord[],
  sites: NormalizedDistanceRecord[],
  rawConfidence?: number
): AssistantPreparationResult {
  const isLVMV = mode === 'lv_mv';
  const totalCount = isLVMV ? points.length : sites.length;
  const items = isLVMV ? points : sites;

  const validCount = items.filter((i) => i.status === 'valid').length;
  const needsReviewCount = items.filter((i) => i.status === 'needs_review').length;
  const invalidCount = items.filter((i) => i.status === 'invalid').length;

  let lvCount = 0;
  let mvCount = 0;
  let unclassifiedCount = 0;

  if (isLVMV) {
    lvCount = points.filter((p) => p.routeType === 'LV').length;
    mvCount = points.filter((p) => p.routeType === 'MV').length;
    unclassifiedCount = points.filter((p) => p.routeType === 'unclassified').length;
  }

  let overallStatus: ValidationStatus = 'valid';
  let summaryMessage = 'All coordinates verified and ready for RouteMeasure.';

  if (invalidCount > 0) {
    overallStatus = 'invalid';
    summaryMessage = `${invalidCount} coordinate ${invalidCount === 1 ? 'record has' : 'records have'} errors and must be corrected before measurement.`;
  } else if (needsReviewCount > 0) {
    overallStatus = 'needs_review';
    summaryMessage = `${needsReviewCount} ${needsReviewCount === 1 ? 'record has' : 'records have'} items recommended for review.`;
  }

  return {
    mode,
    rawConfidence,
    totalCount,
    validCount,
    needsReviewCount,
    invalidCount,
    lvCount,
    mvCount,
    unclassifiedCount,
    points,
    sites,
    overallStatus,
    summaryMessage,
  };
}
