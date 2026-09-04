/**
 * RouteMeasure Assistant Type Definitions
 * Data preparation, provenance tracking, and deterministic validation models.
 */

export type ValidationStatus = 'valid' | 'needs_review' | 'invalid';
export type RouteTypeClassification = 'LV' | 'MV' | 'unclassified';
export type AssistantTargetMode = 'lv_mv' | 'point_to_point';

export interface SourceProvenance {
  type: 'xlsx' | 'xls' | 'csv' | 'pdf' | 'docx' | 'paste' | 'unknown';
  file?: string;
  sheet?: string;
  row?: number;
  page?: number;
  reference?: string;
  line?: number;
}

export interface NormalizedPointRecord {
  id: string;
  status: ValidationStatus;
  routeType: RouteTypeClassification;
  routeId?: string;
  pointId: string;
  latitude: number | null;
  longitude: number | null;
  rawLatitude?: string | number;
  rawLongitude?: string | number;
  description?: string;
  source: SourceProvenance;
  confidence?: number;
  warnings: string[];
  validationErrors?: string[];
}

export interface NormalizedDistanceRecord {
  id: string;
  status: ValidationStatus;
  siteId: string;
  legacySiteId?: string;
  siteName: string;
  region?: string;
  latitude: number | null;
  longitude: number | null;
  rawLatitude?: string | number;
  rawLongitude?: string | number;
  description?: string;
  source: SourceProvenance;
  confidence?: number;
  warnings: string[];
  validationErrors?: string[];
}

export interface AssistantPreparationResult {
  mode: AssistantTargetMode;
  rawConfidence?: number;
  totalCount: number;
  validCount: number;
  needsReviewCount: number;
  invalidCount: number;
  lvCount: number;
  mvCount: number;
  unclassifiedCount: number;
  points: NormalizedPointRecord[];
  sites: NormalizedDistanceRecord[];
  overallStatus: 'valid' | 'needs_review' | 'invalid';
  summaryMessage: string;
}

export interface AssistantFileAttachment {
  name: string;
  size: number;
  type: string;
  dataBase64?: string;
  textContent?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  attachment?: AssistantFileAttachment;
  resultSummary?: AssistantPreparationResult;
  quickActions?: string[];
  isProcessing?: boolean;
  error?: string;
}
