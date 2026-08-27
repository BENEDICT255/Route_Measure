import { describe, it, expect } from 'vitest';
import { analyzeDistanceWorkbook } from './distanceDetection';
import type { RawSheetData } from '../types/workbook';

describe('Distance Workbook Detection', () => {
  it('detects HT Site ID, Site Name, Region/WHS, and coordinates', () => {
    const rawSheet: RawSheetData = {
      sheetName: 'Distance Analysis',
      headers: ['HT Site ID', 'Legacy Site ID', 'Site Name', 'Region/WHS', 'Latitude', 'Longitude'],
      rows: [
        ['TZDA0277', 'DAR-101', 'Kariakoo Market', 'Dar es Salaam', -6.8214, 39.2789],
        ['TZMT2166', 'MTW-202', 'Mkunya', 'Mtwara', -10.5833, 39.8167],
        ['TZDA0467', 'DAR-103', 'Mikocheni Tower', 'Dar es Salaam', -6.7645, 39.2456],
      ],
      totalRowCount: 4,
    };

    const analysis = analyzeDistanceWorkbook(rawSheet, null, ['Distance Analysis']);

    expect(analysis.latitudeColumn?.originalHeader).toBe('Latitude');
    expect(analysis.longitudeColumn?.originalHeader).toBe('Longitude');
    expect(analysis.siteIdColumn?.originalHeader).toBe('HT Site ID');
    expect(analysis.legacySiteIdColumn?.originalHeader).toBe('Legacy Site ID');
    expect(analysis.siteNameColumn?.originalHeader).toBe('Site Name');
    expect(analysis.regionColumn?.originalHeader).toBe('Region/WHS');
    expect(analysis.siteCount).toBe(3);
  });
});
