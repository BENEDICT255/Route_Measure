/**
 * Workbook parsing types.
 * Types used during Excel workbook analysis and column detection.
 */

/** Detection confidence level */
export enum DetectionConfidence {
  /** Header name matched + values validate = high confidence */
  High = 'high',
  /** Either header or values match but not both */
  Medium = 'medium',
  /** Heuristic guess based on value ranges only */
  Low = 'low',
  /** No detection possible */
  None = 'none',
}

/** A detected column mapping */
export interface DetectedColumn {
  /** Column index (0-based) in the sheet */
  columnIndex: number;
  /** Original header text from the spreadsheet */
  originalHeader: string;
  /** Detection confidence */
  confidence: DetectionConfidence;
  /** Reason for detection */
  reason: string;
}

/** Result of automatic workbook analysis */
export interface WorkbookAnalysis {
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
  /** Detected point/label column (optional) */
  pointColumn: DetectedColumn | null;
  /** Detected route/group column (optional) */
  routeColumn: DetectedColumn | null;
  /** Detected description column (optional) */
  descriptionColumn: DetectedColumn | null;
  /** Detected ordering column (optional) */
  orderColumn: DetectedColumn | null;
  /** Number of usable coordinate rows found */
  coordinateRowCount: number;
  /** First few rows for preview */
  previewRows: Record<string, string | number>[];
  /** All raw headers */
  allHeaders: string[];
  /** Whether ambiguity exists that requires user input */
  hasAmbiguity: boolean;
  /** Description of ambiguity if any */
  ambiguityDescription?: string;
  /** Alternative latitude columns if ambiguous */
  alternativeLatColumns?: DetectedColumn[];
  /** Alternative longitude columns if ambiguous */
  alternativeLonColumns?: DetectedColumn[];
  /** Route ordering method */
  orderingMethod: 'row' | 'column';
  /** Ordering method description */
  orderingDescription: string;
}

/** Raw row data from a worksheet */
export interface RawSheetData {
  /** Worksheet name */
  sheetName: string;
  /** All headers from the detected header row */
  headers: string[];
  /** All data rows (each row is an array of cell values) */
  rows: (string | number | null | undefined)[][];
  /** Total row count including header */
  totalRowCount: number;
}

/** Parsed point data before validation */
export interface ParsedPoint {
  /** Row number in source (1-indexed) */
  sourceRow: number;
  /** Raw latitude value (may be string or number) */
  rawLatitude: string | number | null | undefined;
  /** Raw longitude value (may be string or number) */
  rawLongitude: string | number | null | undefined;
  /** Optional point label */
  label?: string;
  /** Optional route identifier */
  routeId?: string;
  /** Optional description */
  description?: string;
  /** Optional order value */
  orderValue?: number;
  /** All original cell values for this row */
  originalRow: Record<string, string | number | null | undefined>;
}

/** File validation result */
export interface FileValidation {
  valid: boolean;
  error?: string;
  fileName: string;
  fileSize: number;
}
