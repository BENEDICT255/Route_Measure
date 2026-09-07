import { describe, it, expect } from 'vitest';
import { detectColumnsFromValues, analyzeColumnValues, isNonCoordinateHeader } from './columnDetection';
import { detectColumns } from './headerDetection';
import { selectBestSheet, analyzeSheet } from './workbookAnalysis';
import type { RawSheetData } from '../types/workbook';

describe('Column Detection and BOQ False-Positive Prevention', () => {
  it('correctly flags BOQ and table index headers as non-coordinate', () => {
    expect(isNonCoordinateHeader('S/n')).toBe(true);
    expect(isNonCoordinateHeader('SN')).toBe(true);
    expect(isNonCoordinateHeader('S/N')).toBe(true);
    expect(isNonCoordinateHeader('No.')).toBe(true);
    expect(isNonCoordinateHeader('Qty')).toBe(true);
    expect(isNonCoordinateHeader('Quantity')).toBe(true);
    expect(isNonCoordinateHeader('Rate')).toBe(true);
    expect(isNonCoordinateHeader('Amount')).toBe(true);
    expect(isNonCoordinateHeader('Total Price (TZS)')).toBe(true);
    expect(isNonCoordinateHeader('Services (TZS)')).toBe(true);
    expect(isNonCoordinateHeader('Transportation (TZS)')).toBe(true);
    expect(isNonCoordinateHeader('Site ID')).toBe(true);

    expect(isNonCoordinateHeader('Latitude')).toBe(false);
    expect(isNonCoordinateHeader('Longitude')).toBe(false);
    expect(isNonCoordinateHeader('Lat')).toBe(false);
    expect(isNonCoordinateHeader('Lon')).toBe(false);
  });

  it('rejects S/n and Qty from being detected as coordinates in a BOQ Summary sheet', () => {
    const boqSummarySheet: RawSheetData = {
      sheetName: 'Summary',
      headers: ['S/n', 'Description', 'Site Name', 'Site ID', 'Qty', 'Services (TZS)', 'Transportation (TZS)', 'Total Price (TZS)'],
      rows: [
        [1, 'Site aggregate concrete', 'Tower 1', 'TZ001', 1, 50000, 10000, 60000],
        [2, 'Site aggregate concrete', 'Tower 2', 'TZ002', 1, 50000, 10000, 60000],
        [3, 'Site aggregate concrete', 'Tower 3', 'TZ003', 1, 50000, 10000, 60000],
        [4, 'Site aggregate concrete', 'Tower 4', 'TZ004', 1, 50000, 10000, 60000],
        [5, 'Site aggregate concrete', 'Tower 5', 'TZ005', 1, 50000, 10000, 60000],
      ],
      totalRowCount: 6,
    };

    const valueResult = detectColumnsFromValues(boqSummarySheet);
    expect(valueResult.latitudeColumn).toBeNull();
    expect(valueResult.longitudeColumn).toBeNull();

    const analysis = analyzeSheet(boqSummarySheet, ['Summary']);
    expect(analysis.latitudeColumn).toBeNull();
    expect(analysis.longitudeColumn).toBeNull();
    expect(analysis.coordinateRowCount).toBe(0);
  });

  it('correctly identifies coordinate headers with common suffixes and variations', () => {
    const sheetWithVariations: RawSheetData = {
      sheetName: 'GPS Data',
      headers: ['Pole ID', 'Latitude (DD)', 'Longitude (DD)', 'Height'],
      rows: [
        ['P1', -6.8214, 39.2789, 12.5],
        ['P2', -6.8225, 39.2798, 14.0],
      ],
      totalRowCount: 3,
    };

    const headerResult = detectColumns(sheetWithVariations);
    expect(headerResult.latitude).not.toBeNull();
    expect(headerResult.latitude?.originalHeader).toBe('Latitude (DD)');
    expect(headerResult.longitude).not.toBeNull();
    expect(headerResult.longitude?.originalHeader).toBe('Longitude (DD)');
  });

  it('selectBestSheet prefers actual coordinate sheets over BOQ summary sheets', () => {
    const boqSheet: RawSheetData = {
      sheetName: 'Summary',
      headers: ['S/n', 'Description', 'Qty', 'Total'],
      rows: [
        [1, 'Item A', 10, 1000],
        [2, 'Item B', 20, 2000],
      ],
      totalRowCount: 3,
    };

    const routeSheet: RawSheetData = {
      sheetName: 'Route Coordinates',
      headers: ['Point', 'Latitude', 'Longitude'],
      rows: [
        ['P1', -2.58975, 31.31061],
        ['P2', -2.58930, 31.31071],
      ],
      totalRowCount: 3,
    };

    const sheets = new Map<string, RawSheetData>();
    sheets.set('Summary', boqSheet);
    sheets.set('Route Coordinates', routeSheet);

    const best = selectBestSheet(sheets, ['Summary', 'Route Coordinates']);
    expect(best).not.toBeNull();
    expect(best?.sheetName).toBe('Route Coordinates');
    expect(best?.analysis.latitudeColumn?.originalHeader).toBe('Latitude');
    expect(best?.analysis.longitudeColumn?.originalHeader).toBe('Longitude');
  });

  it('correctly does not find coordinate columns across full BOQ workbook with multiple sheets', () => {
    const boqSheet: RawSheetData = {
      sheetName: 'BOQ',
      headers: ['RFP / RFQ Reference', 'Date', 'OpCos', 'Supplier', 'Scope of Works', 'Unit', 'Qty'],
      rows: [
        ['RFP-001', '2026-01-01', 'OpCo1', 'Supplier1', 'Site Aggregate Concrete', 'Site', 16],
        ['RFP-002', '2026-01-01', 'OpCo1', 'Supplier1', 'Excavation and Backfill', 'm3', 100],
      ],
      totalRowCount: 3,
    };

    const summarySheet: RawSheetData = {
      sheetName: 'Summary',
      headers: ['S/n', 'Description', 'Site Name', 'Site ID', 'Qty', 'Services (TZS)', 'Transportation (TZS)', 'Total Price (TZS)'],
      rows: [
        [1, 'Site Aggregate', 'Site A', 'TZ01', 1, 100000, 20000, 120000],
        [2, 'Site Aggregate', 'Site B', 'TZ02', 1, 100000, 20000, 120000],
        [3, 'Site Aggregate', 'Site C', 'TZ03', 1, 100000, 20000, 120000],
      ],
      totalRowCount: 4,
    };

    const sheets = new Map<string, RawSheetData>();
    sheets.set('BOQ', boqSheet);
    sheets.set('Summary', summarySheet);

    const best = selectBestSheet(sheets, ['BOQ', 'Summary']);
    expect(best?.analysis.latitudeColumn).toBeNull();
    expect(best?.analysis.longitudeColumn).toBeNull();
    expect(best?.analysis.coordinateRowCount).toBe(0);
  });
});
