/**
 * Core coordinate and route types.
 * These types are used throughout the application and are independent of
 * any specific map provider or UI framework.
 */

/** Validation severity levels */
export enum ValidationSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

/** A validation message from coordinate/workbook analysis */
export interface ValidationMessage {
  severity: ValidationSeverity;
  message: string;
  /** Source row in the original spreadsheet (1-indexed) */
  sourceRow?: number;
  /** The point UID this message relates to */
  pointUid?: string;
  /** The route UID this message relates to */
  routeUid?: string;
}

/** A single geographic coordinate point with metadata */
export interface RoutePoint {
  /** Internal unique identifier — never use display labels as primary keys */
  uid: string;
  /** Route this point belongs to */
  routeUid: string;
  /** Sequence index within its route (0-based) */
  sequenceIndex: number;
  /** Latitude in decimal degrees (WGS84) */
  latitude: number;
  /** Longitude in decimal degrees (WGS84) */
  longitude: number;
  /** Original latitude value from the spreadsheet (preserved for audit) */
  originalLatitude: number;
  /** Original longitude value from the spreadsheet (preserved for audit) */
  originalLongitude: number;
  /** Display label (e.g. "LV1", "INT", "Point 3") — NOT unique */
  displayLabel: string;
  /** Optional description from the spreadsheet */
  description?: string;
  /** Source workbook filename */
  sourceFile: string;
  /** Source worksheet name */
  sourceSheet: string;
  /** Original row number in the spreadsheet (1-indexed) */
  sourceRow: number;
  /** Any additional metadata from the original spreadsheet */
  metadata?: Record<string, string | number>;
}

/** A segment between two consecutive route points */
export interface RouteSegment {
  /** Segment number (1-based) */
  segmentNumber: number;
  /** Starting point */
  fromPoint: RoutePoint;
  /** Ending point */
  toPoint: RoutePoint;
  /** Geodesic distance in metres (full precision) */
  distanceMetres: number;
  /** Cumulative distance from route start in metres (full precision) */
  cumulativeDistanceMetres: number;
}

/** Cumulative distance info for a single point */
export interface PointDistance {
  /** The route point */
  point: RoutePoint;
  /** Distance from previous point in metres (0 for first point) */
  distanceFromPrevious: number;
  /** Cumulative distance from route start in metres (0 for first point) */
  cumulativeDistance: number;
}

/** A complete measured route */
export interface MeasuredRoute {
  /** Internal unique identifier */
  uid: string;
  /** Display name (e.g. "LINE-001", "Route 1") */
  name: string;
  /** All points in sequence order */
  points: RoutePoint[];
  /** All segments with distances */
  segments: RouteSegment[];
  /** Per-point cumulative distance data */
  pointDistances: PointDistance[];
  /** Total coordinate-derived route distance in metres (full precision) */
  totalDistanceMetres: number;
  /** Number of coordinate points */
  coordinateCount: number;
  /** Number of segments (coordinateCount - 1) */
  segmentCount: number;
  /** First point */
  startPoint: RoutePoint;
  /** Last point */
  endPoint: RoutePoint;
  /** Validation messages for this route */
  validationMessages: ValidationMessage[];
}

/** Complete measurement result for all routes in a workbook */
export interface MeasurementResult {
  /** All measured routes */
  routes: MeasuredRoute[];
  /** Global validation messages */
  validationMessages: ValidationMessage[];
  /** Source file information */
  sourceFile: string;
  /** Source worksheet */
  sourceSheet: string;
  /** Processing timestamp (ISO 8601) */
  processingTimestamp: string;
  /** Calculation method description */
  calculationMethod: string;
  /** Application version */
  applicationVersion: string;
}
