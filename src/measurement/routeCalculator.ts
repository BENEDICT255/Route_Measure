/**
 * Route calculator module.
 *
 * Takes validated coordinate points and produces a complete MeasuredRoute
 * with segment distances, cumulative distances, and totals.
 *
 * This module is independent of Google Maps and any UI framework.
 */

import type {
  RoutePoint,
  RouteSegment,
  PointDistance,
  MeasuredRoute,
  MeasurementResult,
  ValidationMessage,
} from '../types/coordinates';
import { ValidationSeverity } from '../types/coordinates';
import {
  inverseGeodesic,
  CALCULATION_METHOD,
} from './geodesic';
import {
  checkConsecutiveDuplicates,
  validateRouteMinimumPoints,
} from './coordinateValidation';
import { APP_VERSION } from '../utils/constants';

/**
 * Calculate a complete measured route from an ordered array of route points.
 */
export function calculateRoute(
  routeUid: string,
  routeName: string,
  points: RoutePoint[]
): MeasuredRoute {
  const validationMessages: ValidationMessage[] = [];

  const minPointsMsg = validateRouteMinimumPoints(points, routeName);
  if (minPointsMsg) {
    validationMessages.push(minPointsMsg);
  }

  const duplicateMessages = checkConsecutiveDuplicates(points);
  validationMessages.push(...duplicateMessages);

  const segments: RouteSegment[] = [];
  const pointDistances: PointDistance[] = [];
  let totalDistance = 0;

  if (points.length > 0) {
    pointDistances.push({
      point: points[0],
      distanceFromPrevious: 0,
      cumulativeDistance: 0,
    });
  }

  for (let i = 0; i < points.length - 1; i++) {
    const fromPoint = points[i];
    const toPoint = points[i + 1];

    const segmentDistance = inverseGeodesic(
      fromPoint.latitude,
      fromPoint.longitude,
      toPoint.latitude,
      toPoint.longitude
    );

    totalDistance += segmentDistance;

    segments.push({
      segmentNumber: i + 1,
      fromPoint,
      toPoint,
      distanceMetres: segmentDistance,
      cumulativeDistanceMetres: totalDistance,
    });

    pointDistances.push({
      point: toPoint,
      distanceFromPrevious: segmentDistance,
      cumulativeDistance: totalDistance,
    });
  }

  return {
    uid: routeUid,
    name: routeName,
    points,
    segments,
    pointDistances,
    totalDistanceMetres: totalDistance,
    coordinateCount: points.length,
    segmentCount: segments.length,
    startPoint: points[0],
    endPoint: points[points.length - 1],
    validationMessages,
  };
}

/**
 * Process multiple routes from grouped coordinate data.
 */
export function calculateAllRoutes(
  routeGroups: Map<string, { name: string; points: RoutePoint[] }>,
  sourceFile: string,
  sourceSheet: string
): MeasurementResult {
  const routes: MeasuredRoute[] = [];
  const globalMessages: ValidationMessage[] = [];

  for (const [routeUid, { name, points }] of routeGroups) {
    if (points.length === 0) {
      globalMessages.push({
        severity: ValidationSeverity.Warning,
        message: `Route "${name}" contains no valid coordinate points and was skipped.`,
        routeUid,
      });
      continue;
    }

    const measuredRoute = calculateRoute(routeUid, name, points);
    routes.push(measuredRoute);
  }

  if (routes.length === 0) {
    globalMessages.push({
      severity: ValidationSeverity.Error,
      message: 'No measurable routes were found. At least one route with 2 or more coordinate points is required.',
    });
  }

  return {
    routes,
    validationMessages: globalMessages,
    sourceFile,
    sourceSheet,
    processingTimestamp: new Date().toISOString(),
    calculationMethod: CALCULATION_METHOD,
    applicationVersion: APP_VERSION,
  };
}
