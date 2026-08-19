/**
 * Geodesic distance calculation using GeographicLib (Karney algorithm).
 *
 * This is the CANONICAL measurement engine.
 * It uses the WGS84 ellipsoid and Karney's geodesic algorithm.
 *
 * This module must NEVER use:
 * - Haversine formula
 * - Google Maps geometry computeLength
 * - Google Directions/Routes API
 * - Any spherical approximation
 *
 * Google Maps is for visualization only.
 */

import { Geodesic } from 'geographiclib-geodesic';

/**
 * WGS84 ellipsoid geodesic calculator.
 * Uses the Karney algorithm via GeographicLib.
 */
const geod = Geodesic.WGS84;

/**
 * Calculate the geodesic distance between two points on the WGS84 ellipsoid.
 *
 * Uses the Karney inverse geodesic algorithm via GeographicLib.
 * Returns the distance in metres at full double precision.
 *
 * @param lat1 - Latitude of point 1 in decimal degrees
 * @param lon1 - Longitude of point 1 in decimal degrees
 * @param lat2 - Latitude of point 2 in decimal degrees
 * @param lon2 - Longitude of point 2 in decimal degrees
 * @returns Distance in metres (full precision, do NOT round before accumulation)
 */
export function inverseGeodesic(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const result = geod.Inverse(lat1, lon1, lat2, lon2);
  return result.s12 ?? 0;
}

/**
 * Calculate distances for a sequence of consecutive coordinate pairs.
 *
 * For points P1, P2, P3 ... Pn, calculates:
 * d(P1,P2), d(P2,P3), ..., d(Pn-1,Pn)
 *
 * @param coordinates - Array of [latitude, longitude] pairs in route order
 * @returns Array of segment distances in metres (length = coordinates.length - 1)
 */
export function calculateSegmentDistances(
  coordinates: [number, number][]
): number[] {
  if (coordinates.length < 2) {
    return [];
  }

  const distances: number[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lat1, lon1] = coordinates[i];
    const [lat2, lon2] = coordinates[i + 1];
    distances.push(inverseGeodesic(lat1, lon1, lat2, lon2));
  }

  return distances;
}

/**
 * Calculate cumulative distances from route start for each segment.
 *
 * @param segmentDistances - Array of individual segment distances
 * @returns Array of cumulative distances (same length as input)
 */
export function calculateCumulativeDistances(
  segmentDistances: number[]
): number[] {
  const cumulative: number[] = [];
  let running = 0;

  for (const d of segmentDistances) {
    running += d;
    cumulative.push(running);
  }

  return cumulative;
}

/**
 * Calculate total route distance by summing all segment distances.
 *
 * CRITICAL: Sum unrounded segment values. Do NOT round segments before summing.
 *
 * @param segmentDistances - Array of individual segment distances in metres
 * @returns Total distance in metres (full precision)
 */
export function calculateTotalDistance(segmentDistances: number[]): number {
  let total = 0;
  for (const d of segmentDistances) {
    total += d;
  }
  return total;
}

/** Calculation method description for reports/audit */
export const CALCULATION_METHOD =
  'WGS84 ellipsoidal geodesic polyline measurement using the Karney algorithm via GeographicLib';

/** Calculation method short name */
export const CALCULATION_METHOD_SHORT = 'WGS84/Karney (GeographicLib)';
