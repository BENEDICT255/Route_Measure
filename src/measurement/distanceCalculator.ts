/**
 * Distance Between Points calculation service.
 *
 * Calculates independent geodesic distances from starting points to
 * destination sites. Reuses the existing inverseGeodesic() from geodesic.ts.
 *
 * This module does NOT calculate polyline routes. Each starting-point →
 * destination pair is an independent geodesic measurement.
 */

import { Geodesic } from 'geographiclib-geodesic';
import { inverseGeodesic, CALCULATION_METHOD_SHORT } from './geodesic';
import type {
  DestinationSite,
  StartingPoint,
  DistanceResult,
  DistanceAnalysisResult,
  DistanceAnalysisSummary,
} from '../types/distance';

const APP_VERSION = '1.0.0';

/**
 * Calculate distances for all assigned destination sites.
 *
 * Each destination is measured independently from its assigned starting point.
 * Uses WGS84/Karney/GeographicLib via the shared inverseGeodesic function.
 *
 * @param destinations All destination sites (only 'assigned' will be calculated)
 * @param startingPoints All available starting points
 * @param sourceFile Source filename for the report
 * @param sourceSheet Source worksheet name
 */
export function calculateDistances(
  destinations: DestinationSite[],
  startingPoints: StartingPoint[],
  sourceFile: string,
  sourceSheet: string
): DistanceAnalysisResult {
  const geod = Geodesic.WGS84;
  const spMap = new Map<string, StartingPoint>();
  for (const sp of startingPoints) {
    spMap.set(sp.uid, sp);
  }

  const results: DistanceResult[] = [];

  // Calculate for each assigned destination
  const includedDests = destinations.filter(
    (d) => d.status === 'assigned' && d.assignedStartingPointUid
  );

  for (const dest of includedDests) {
    const sp = spMap.get(dest.assignedStartingPointUid!);
    if (!sp) continue;

    // Use the canonical geodesic engine
    const distanceMetres = inverseGeodesic(
      sp.latitude,
      sp.longitude,
      dest.latitude,
      dest.longitude
    );

    // Calculate bearing
    const inv = geod.Inverse(sp.latitude, sp.longitude, dest.latitude, dest.longitude);
    const bearing = inv.azi1 !== undefined ? (inv.azi1 + 360) % 360 : 0;

    results.push({
      destinationUid: dest.uid,
      startingPointUid: sp.uid,
      distanceMetres,
      distanceKm: distanceMetres / 1000,
      rank: 0, // Computed below
      bearing,
    });
  }

  // Rank by distance (furthest = 1)
  const sorted = [...results].sort((a, b) => b.distanceMetres - a.distanceMetres);
  sorted.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  // Compute summary
  const summary = computeSummary(sorted, destinations, startingPoints);

  return {
    destinations,
    startingPoints,
    results: sorted,
    summary,
    sourceFile,
    sourceSheet,
    processingTimestamp: new Date().toISOString(),
    calculationMethod: `WGS84 ellipsoidal geodesic point-to-point distance using the Karney algorithm via GeographicLib (${CALCULATION_METHOD_SHORT})`,
    applicationVersion: APP_VERSION,
  };
}

/**
 * Compute summary statistics from distance results.
 */
function computeSummary(
  results: DistanceResult[],
  destinations: DestinationSite[],
  startingPoints: StartingPoint[]
): DistanceAnalysisSummary {
  if (results.length === 0) {
    return {
      destinationCount: 0,
      startingPointCount: 0,
      averageDistanceKm: 0,
      nearestSite: null,
      furthestSite: null,
    };
  }

  // Count unique starting points actually used
  const usedSPs = new Set(results.map((r) => r.startingPointUid));

  // Average distance
  const totalKm = results.reduce((sum, r) => sum + r.distanceKm, 0);
  const avgKm = totalKm / results.length;

  // Nearest (excluding zero-distance self-references for meaningful nearest)
  const nonZeroResults = results.filter((r) => r.distanceMetres > 0);
  const sortedAsc = [...(nonZeroResults.length > 0 ? nonZeroResults : results)].sort(
    (a, b) => a.distanceMetres - b.distanceMetres
  );
  const nearest = sortedAsc[0];
  const nearestDest = destinations.find((d) => d.uid === nearest.destinationUid);

  // Furthest
  const sortedDesc = [...results].sort((a, b) => b.distanceMetres - a.distanceMetres);
  const furthest = sortedDesc[0];
  const furthestDest = destinations.find((d) => d.uid === furthest.destinationUid);

  return {
    destinationCount: results.length,
    startingPointCount: usedSPs.size,
    averageDistanceKm: avgKm,
    nearestSite: nearestDest
      ? {
          uid: nearestDest.uid,
          name: nearestDest.siteName || nearestDest.siteId || `Row ${nearestDest.sourceRow}`,
          distanceKm: nearest.distanceKm,
        }
      : null,
    furthestSite: furthestDest
      ? {
          uid: furthestDest.uid,
          name: furthestDest.siteName || furthestDest.siteId || `Row ${furthestDest.sourceRow}`,
          distanceKm: furthest.distanceKm,
        }
      : null,
  };
}

/**
 * Recompute ranks for a filtered subset of results.
 */
export function recomputeRanks(
  results: DistanceResult[],
  rankMode: 'furthest' | 'nearest' = 'furthest'
): DistanceResult[] {
  const sorted =
    rankMode === 'furthest'
      ? [...results].sort((a, b) => b.distanceMetres - a.distanceMetres)
      : [...results].sort((a, b) => a.distanceMetres - b.distanceMetres);

  return sorted.map((r, idx) => ({ ...r, rank: idx + 1 }));
}
