/**
 * Route detection module.
 */

import type { ParsedPoint } from '../types/workbook';

export interface RouteGroup {
  routeId: string;
  routeName: string;
  points: ParsedPoint[];
}

export function detectRoutes(points: ParsedPoint[]): RouteGroup[] {
  const hasRouteIds = points.some(
    (p) => p.routeId !== undefined && p.routeId !== null && String(p.routeId).trim() !== ''
  );

  if (!hasRouteIds) {
    return [
      {
        routeId: 'route-1',
        routeName: 'Route 1',
        points,
      },
    ];
  }

  const routeMap = new Map<string, ParsedPoint[]>();
  const routeOrder: string[] = [];

  for (const point of points) {
    const routeId = String(point.routeId || 'Route 1').trim();
    if (!routeMap.has(routeId)) {
      routeMap.set(routeId, []);
      routeOrder.push(routeId);
    }
    routeMap.get(routeId)!.push(point);
  }

  return routeOrder.map((routeId) => ({
    routeId: `route-${routeId}`,
    routeName: routeId,
    points: routeMap.get(routeId)!,
  }));
}
