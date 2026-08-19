/**
 * Application constants.
 */

export const APP_VERSION = '1.0.0';
export const APP_NAME = 'RouteMeasure';
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_SIZE_DISPLAY = '10 MB';
export const MAX_COORDINATE_ROWS = 5000;
export const MAX_RENDERED_COORDINATES = 2000;
export const MAX_ROUTES = 100;
export const ACCEPTED_FILE_EXTENSIONS = ['.xlsx'];
export const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const DEFAULT_MAP_TYPE = 'satellite' as const;
export const CALCULATION_METHOD_REPORT =
  'WGS84 ellipsoidal geodesic polyline measurement using the Karney algorithm via GeographicLib';
