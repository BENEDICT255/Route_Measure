/**
 * Workbook reader module.
 */

import * as XLSX from 'xlsx';
import type { RawSheetData, FileValidation } from '../types/workbook';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_DISPLAY,
  ACCEPTED_FILE_EXTENSIONS,
} from '../utils/constants';

export function validateFile(file: File): FileValidation {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ACCEPTED_FILE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format "${ext}". Please upload an .xlsx file.`,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed size of ${MAX_FILE_SIZE_DISPLAY}.`,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The uploaded file is empty.',
      fileName: file.name,
      fileSize: file.size,
    };
  }

  return {
    valid: true,
    fileName: file.name,
    fileSize: file.size,
  };
}

export async function readWorkbook(
  file: File
): Promise<{ sheets: Map<string, RawSheetData>; sheetNames: string[] }> {
  const arrayBuffer = await file.arrayBuffer();

  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellText: true,
    raw: true,
  });

  const sheets = new Map<string, RawSheetData>();
  const sheetNames = workbook.SheetNames;

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawData: (string | number | null | undefined)[][] =
      XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        raw: true,
      });

    if (rawData.length === 0) continue;

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
      const row = rawData[i];
      if (row && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
        headerRowIndex = i;
        break;
      }
    }

    const headerRow = rawData[headerRowIndex] || [];
    const headers = headerRow.map((cell) =>
      cell !== null && cell !== undefined ? String(cell).trim() : ''
    );

    const dataRows = rawData.slice(headerRowIndex + 1).filter((row) =>
      row && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
    );

    sheets.set(sheetName, {
      sheetName,
      headers,
      rows: dataRows,
      totalRowCount: rawData.length,
    });
  }

  return { sheets, sheetNames };
}

export async function generateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'hash-unavailable';
  }
}
