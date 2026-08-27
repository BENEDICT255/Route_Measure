import { describe, it, expect } from 'vitest';
import { calculateDistances, recomputeRanks } from './distanceCalculator';
import type { DestinationSite, StartingPoint } from '../types/distance';

describe('Distance Calculator', () => {
  const warehouseAmanzi: StartingPoint = {
    uid: 'sp-amanzi',
    name: 'Amanzi Warehouse',
    latitude: -6.795598434,
    longitude: 39.216737374,
    source: 'manual',
  };

  const warehouseMtwara: StartingPoint = {
    uid: 'sp-mtwara',
    name: 'Mtwara Warehouse',
    latitude: -10.2741,
    longitude: 40.1806,
    source: 'manual',
  };

  const sites: DestinationSite[] = [
    {
      uid: 'dest-1',
      siteId: 'TZDA0277',
      siteName: 'Kariakoo Market',
      region: 'Dar es Salaam',
      latitude: -6.8214,
      longitude: 39.2789,
      sourceRow: 2,
      sourceSheet: 'Distance Analysis',
      metadata: {},
      assignedStartingPointUid: 'sp-amanzi',
      status: 'assigned',
    },
    {
      uid: 'dest-2',
      siteId: 'TZMT2166',
      siteName: 'Mkunya',
      region: 'Mtwara',
      latitude: -10.5833,
      longitude: 39.8167,
      sourceRow: 3,
      sourceSheet: 'Distance Analysis',
      metadata: {},
      assignedStartingPointUid: 'sp-mtwara',
      status: 'assigned',
    },
    {
      uid: 'dest-3',
      siteId: 'TZDA0467',
      siteName: 'Mikocheni Tower',
      region: 'Dar es Salaam',
      latitude: -6.7645,
      longitude: 39.2456,
      sourceRow: 4,
      sourceSheet: 'Distance Analysis',
      metadata: {},
      assignedStartingPointUid: 'sp-amanzi',
      status: 'assigned',
    },
    {
      uid: 'dest-4',
      siteId: 'TZEX0001',
      siteName: 'Excluded Site',
      region: 'Other',
      latitude: -7.0,
      longitude: 39.0,
      sourceRow: 5,
      sourceSheet: 'Distance Analysis',
      metadata: {},
      assignedStartingPointUid: null,
      status: 'excluded',
    },
  ];

  it('calculates independent geodesic distances accurately', () => {
    const result = calculateDistances(
      sites,
      [warehouseAmanzi, warehouseMtwara],
      'test.xlsx',
      'Distance Analysis'
    );

    // Only 3 assigned sites calculated
    expect(result.results.length).toBe(3);
    expect(result.summary.destinationCount).toBe(3);
    expect(result.summary.startingPointCount).toBe(2);

    // Verify Kariakoo distance from Amanzi (~7.4 km)
    const kariakoo = result.results.find((r) => r.destinationUid === 'dest-1');
    expect(kariakoo).toBeDefined();
    expect(kariakoo!.distanceKm).toBeGreaterThan(6);
    expect(kariakoo!.distanceKm).toBeLessThan(9);

    // Verify Mkunya distance from Mtwara (~52 km)
    const mkunya = result.results.find((r) => r.destinationUid === 'dest-2');
    expect(mkunya).toBeDefined();
    expect(mkunya!.distanceKm).toBeGreaterThan(45);
    expect(mkunya!.distanceKm).toBeLessThan(60);

    // Furthest should be ranked 1
    expect(result.results[0].rank).toBe(1);
    expect(result.summary.furthestSite?.uid).toBe('dest-2');
  });

  it('recomputes ranks properly', () => {
    const result = calculateDistances(
      sites,
      [warehouseAmanzi, warehouseMtwara],
      'test.xlsx',
      'Distance Analysis'
    );

    const nearestFirst = recomputeRanks(result.results, 'nearest');
    expect(nearestFirst[0].rank).toBe(1);
    expect(nearestFirst[0].distanceMetres).toBeLessThan(nearestFirst[1].distanceMetres);
  });
});
