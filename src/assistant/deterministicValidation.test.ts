import { describe, it, expect } from 'vitest';
import {
  validateCoordinatePair,
  validateNormalizedPoints,
  validateNormalizedDistanceSites,
  buildPreparationSummary,
} from './deterministicValidation';

describe('Deterministic Coordinate Validation Engine', () => {
  it('validates genuine WGS84 coordinates as valid', () => {
    const res = validateCoordinatePair(-2.58930, 31.31071);
    expect(res.valid).toBe(true);
    expect(res.parsedLat).toBe(-2.58930);
    expect(res.parsedLon).toBe(31.31071);
    expect(res.errors.length).toBe(0);
  });

  it('rejects out-of-bounds latitudes (> 90 degrees)', () => {
    const res = validateCoordinatePair(130.2, 31.31071);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('outside the valid WGS84 range'))).toBe(true);
  });

  it('detects and flags swapped coordinates', () => {
    // Latitude is 110 (out of [-90, 90] but within [-180, 180]) and Longitude is -2.5
    const res = validateCoordinatePair(110.5, -2.589);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('swapped'))).toBe(true);
  });

  it('rejects projected coordinates (UTM / Easting / Northing > 1000)', () => {
    const res = validateCoordinatePair(524300, 9714200);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('projected coordinates'))).toBe(true);
  });

  it('rejects NaN, empty strings, and missing coordinates', () => {
    const res1 = validateCoordinatePair('invalid', 31.31071);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes('not a valid number'))).toBe(true);

    const res2 = validateCoordinatePair(null, undefined);
    expect(res2.valid).toBe(false);
    expect(res2.errors.length).toBe(2);
  });

  it('flags unclassified voltage routes for review', () => {
    const points = validateNormalizedPoints([
      {
        pointId: 'P1',
        latitude: -2.58930,
        longitude: 31.31071,
        routeType: 'unclassified',
      },
    ]);
    expect(points[0].status).toBe('needs_review');
    expect(points[0].warnings.some((w) => w.includes('voltage classification'))).toBe(true);
  });

  it('correctly categorizes valid LV and MV points', () => {
    const points = validateNormalizedPoints([
      { pointId: 'LV1', latitude: -2.58930, longitude: 31.31071, routeType: 'LV' },
      { pointId: 'MV1', latitude: -2.58885, longitude: 31.31081, routeType: 'MV' },
      { pointId: 'Bad1', latitude: 150.0, longitude: 31.31081, routeType: 'LV' },
    ]);

    expect(points[0].status).toBe('valid');
    expect(points[1].status).toBe('valid');
    expect(points[2].status).toBe('invalid');

    const summary = buildPreparationSummary('lv_mv', points, []);
    expect(summary.totalCount).toBe(3);
    expect(summary.validCount).toBe(2);
    expect(summary.invalidCount).toBe(1);
    expect(summary.lvCount).toBe(2);
    expect(summary.mvCount).toBe(1);
    expect(summary.overallStatus).toBe('invalid');
  });

  it('validates distance destination sites', () => {
    const sites = validateNormalizedDistanceSites([
      {
        siteId: 'TZDA01',
        siteName: 'Dar Hub',
        latitude: -6.8234,
        longitude: 39.2695,
      },
    ]);
    expect(sites[0].status).toBe('valid');
    expect(sites[0].siteName).toBe('Dar Hub');
  });
});
