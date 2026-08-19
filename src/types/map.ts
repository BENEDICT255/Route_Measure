/**
 * Map provider abstraction.
 * The core system must not depend on Google Maps.
 * This interface allows swapping map providers without touching the measurement engine.
 */

import type { RoutePoint, MeasuredRoute } from './coordinates';

/** Map type options */
export type MapType = 'satellite' | 'hybrid' | 'roadmap';

/** Map adapter interface — provider-agnostic */
export interface MapAdapter {
  /** Initialize the map in a container element */
  initialize(container: HTMLElement): Promise<void>;

  /** Render a route's polyline on the map */
  renderRoute(route: MeasuredRoute): void;

  /** Render point markers on the map */
  renderPoints(points: RoutePoint[], options?: MarkerOptions): void;

  /** Fit the map viewport to show the entire route */
  fitRoute(route: MeasuredRoute): void;

  /** Focus on a specific point */
  focusPoint(point: RoutePoint, zoom?: number): void;

  /** Set the map type (satellite, hybrid, roadmap) */
  setMapType(type: MapType): void;

  /** Clear all rendered routes and markers */
  clear(): void;

  /** Clean up resources */
  destroy(): void;

  /** Whether the map is currently loaded and functional */
  isLoaded(): boolean;

  /** Register a callback for when a point marker is clicked */
  onPointClick(callback: (point: RoutePoint) => void): void;

  /** Toggle point label visibility */
  setPointLabelsVisible(visible: boolean): void;

  /** Toggle segment distance label visibility */
  setSegmentLabelsVisible(visible: boolean): void;

  /** Highlight a specific point */
  highlightPoint(point: RoutePoint | null): void;

  /** Highlight a specific segment */
  highlightSegment(segmentIndex: number | null): void;
}

/** Options for marker rendering */
export interface MarkerOptions {
  /** Show text labels next to markers */
  showLabels?: boolean;
  /** Show segment distance labels on polyline */
  showSegmentDistances?: boolean;
}

/** Map loading state */
export enum MapLoadState {
  NotStarted = 'not_started',
  Loading = 'loading',
  Loaded = 'loaded',
  Failed = 'failed',
}

/** Map error information */
export interface MapError {
  type: 'api_key' | 'network' | 'quota' | 'unknown';
  message: string;
  recoverable: boolean;
}
