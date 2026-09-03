/**
 * Types for the Distance Between Points measurement mode.
 *
 * This mode measures independent geodesic distances from starting/reference
 * points to destination sites. It does NOT calculate polyline routes.
 *
 * These types are completely independent of the LV/MV route types in coordinates.ts.
 */

import type { DetectedColumn } from './workbook';

// ─── Starting Point ────────────────────────────────────────────────

/** Source of a starting point */
export type StartingPointSource = 'manual' | 'sheet' | 'workbook' | 'detected';

/** A starting/reference point (origin for distance measurement) */
export interface StartingPoint {
  /** Internal unique identifier */
  uid: string;
  /** Display name (e.g. "Amanzi Warehouse" or "Nanyamba — TZMT2156") */
  name: string;
  /** Latitude in decimal degrees (WGS84) */
  latitude: number;
  /** Longitude in decimal degrees (WGS84) */
  longitude: number;
  /** Optional description */
  description?: string;
  /** How this starting point was created */
  source: StartingPointSource;
  /** Site ID if source === 'sheet' or 'workbook' */
  startingSiteId?: string;
  /** Source site UID if source === 'sheet' */
  sourceSiteUid?: string;
  /** Source row in workbook (if source === 'workbook' or 'detected' or 'sheet') */
  sourceRow?: number;
}

// ─── Destination Site ──────────────────────────────────────────────

/** Assignment status for a destination site */
export type DestinationStatus = 'unassigned' | 'assigned' | 'excluded' | 'invalid';

/** A destination site parsed from the uploaded workbook */
export interface DestinationSite {
  /** Internal unique identifier */
  uid: string;
  /** Latitude in decimal degrees (WGS84) */
  latitude: number;
  /** Longitude in decimal degrees (WGS84) */
  longitude: number;
  /** Site ID (e.g. HT Site ID) — optional */
  siteId?: string;
  /** Legacy Site ID — optional */
  legacySiteId?: string;
  /** Human-readable site name — optional */
  siteName?: string;
  /** Region / WHS / cluster — optional */
  region?: string;
  /** Optional description */
  description?: string;
  /** Row number in the source spreadsheet (1-indexed) */
  sourceRow: number;
  /** Source worksheet name */
  sourceSheet: string;
  /** All original cell values from this row */
  metadata: Record<string, string | number>;
  /** UID of the assigned starting point (null if unassigned) */
  assignedStartingPointUid: string | null;
  /** Current assignment status */
  status: DestinationStatus;
  /** Validation error message if status === 'invalid' */
  validationError?: string;
}

// ─── Distance Result ───────────────────────────────────────────────

/** A single calculated distance from starting point to destination */
export interface DistanceResult {
  /** UID of the destination site */
  destinationUid: string;
  /** UID of the starting point used */
  startingPointUid: string;
  /** Geodesic distance in metres (full precision) */
  distanceMetres: number;
  /** Geodesic distance in kilometres */
  distanceKm: number;
  /** Rank (1 = furthest by default) — computed dynamically */
  rank: number;
  /** Forward azimuth from starting point to destination (degrees) */
  bearing: number;
}

// ─── Distance Analysis Result ──────────────────────────────────────

/** Summary statistics for a distance analysis */
export interface DistanceAnalysisSummary {
  /** Total number of destination sites (excluding excluded) */
  destinationCount: number;
  /** Number of unique starting points used */
  startingPointCount: number;
  /** Average distance in km */
  averageDistanceKm: number;
  /** Nearest destination site */
  nearestSite: { uid: string; name: string; distanceKm: number } | null;
  /** Furthest destination site */
  furthestSite: { uid: string; name: string; distanceKm: number } | null;
}

/** Complete distance analysis result */
export interface DistanceAnalysisResult {
  /** All destination sites (including excluded, for reference) */
  destinations: DestinationSite[];
  /** All starting points */
  startingPoints: StartingPoint[];
  /** Calculated distance results (only for included/assigned destinations) */
  results: DistanceResult[];
  /** Summary statistics */
  summary: DistanceAnalysisSummary;
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

// ─── Distance Workbook Analysis ────────────────────────────────────

/** Extended workbook analysis for distance mode */
export interface DistanceWorkbookAnalysis {
  /** Available worksheet names */
  worksheetNames: string[];
  /** Selected worksheet name */
  selectedWorksheet: string;
  /** Detected header row (0-based) */
  headerRow: number;
  /** Detected latitude column */
  latitudeColumn: DetectedColumn | null;
  /** Detected longitude column */
  longitudeColumn: DetectedColumn | null;
  /** Detected site ID column (HT Site ID, Site ID, etc.) */
  siteIdColumn: DetectedColumn | null;
  /** Detected legacy site ID column */
  legacySiteIdColumn: DetectedColumn | null;
  /** Detected site name column */
  siteNameColumn: DetectedColumn | null;
  /** Detected region/WHS column */
  regionColumn: DetectedColumn | null;
  /** Detected description column */
  descriptionColumn: DetectedColumn | null;
  /** Reference/warehouse coordinates detected in workbook metadata */
  detectedReferencePoints: StartingPoint[];
  /** All headers from the detected header row */
  allHeaders: string[];
  /** First few rows for preview */
  previewRows: Record<string, string | number>[];
  /** Number of usable site rows found */
  siteCount: number;
  /** Number of coordinate rows */
  coordinateRowCount: number;
}

// ─── Measurement Mode ──────────────────────────────────────────────

/** The two measurement modes supported by RouteMeasure */
export type MeasurementMode = 'route' | 'distance';
