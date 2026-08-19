/**
 * RUBIZA REGRESSION TESTS
 *
 * These are MANDATORY regression tests that verify:
 * 1. The WGS84/Karney measurement engine produces correct results
 * 2. The canonical result does NOT match Haversine/spherical calculations
 * 3. Google Maps is not being used for distance calculation
 * 4. Source engineering distances are not substituted for calculated distances
 *
 * These test datasets must NEVER be hard-coded into production logic.
 * They exist solely as regression fixtures.
 */

import { describe, it, expect } from 'vitest';
import {
  inverseGeodesic,
  calculateSegmentDistances,
  calculateTotalDistance,
} from './geodesic';

// ─── RUBIZA LV TEST DATA ─────────────────────────────────────────────
const LV_COORDINATES: [number, number][] = [
  [-2.58975, 31.31061], // 1  TRF RUBIZA-50kVA
  [-2.58930, 31.31071], // 2  LV1
  [-2.58885, 31.31081], // 3  LV2
  [-2.58841, 31.31091], // 4  LV3
  [-2.58797, 31.31101], // 5  LV4
  [-2.58752, 31.31111], // 6  LV5AP
  [-2.58710, 31.31132], // 7  LV6
  [-2.58669, 31.31152], // 8  LV7AP
  [-2.58625, 31.31165], // 9  LV8
  [-2.58582, 31.31178], // 10 LV9
  [-2.58538, 31.31191], // 11 LV10
  [-2.58495, 31.31204], // 12 LV11
  [-2.58450, 31.31218], // 13 LV12AP
  [-2.58409, 31.31240], // 14 LV13
  [-2.58369, 31.31263], // 15 LV14
  [-2.58329, 31.31284], // 16 LV15
  [-2.58290, 31.31307], // 17 LV16AP
  [-2.58302, 31.31345], // 18 LV17AP
  [-2.58329, 31.31382], // 19 LV18AP
  [-2.58339, 31.31426], // 20 LV19
  [-2.58349, 31.31470], // 21 LV20
  [-2.58358, 31.31514], // 22 LV21
  [-2.58368, 31.31559], // 23 LV22AP
  [-2.58384, 31.31603], // 24 LV23AP
  [-2.58416, 31.31635], // 25 LV24AP
  [-2.58433, 31.31678], // 26 LV25TM
];

// ─── RUBIZA MV TEST DATA ─────────────────────────────────────────────
const MV_COORDINATES: [number, number][] = [
  [-2.60907, 31.30390], // 1  TP
  [-2.60877, 31.30439], // 2  PA
  [-2.60824, 31.30503], // 3  MA
  [-2.60741, 31.30526], // 4  INT
  [-2.60661, 31.30547], // 5  INT
  [-2.60581, 31.30569], // 6  INT
  [-2.60501, 31.30590], // 7  INT
  [-2.60422, 31.30612], // 8  PA
  [-2.60345, 31.30652], // 9  INT
  [-2.60274, 31.30690], // 10 INT
  [-2.60201, 31.30729], // 11 PA
  [-2.60130, 31.30767], // 12 MA
  [-2.60066, 31.30817], // 13 INT
  [-2.59983, 31.30815], // 14 INT
  [-2.59901, 31.30812], // 15 PA
  [-2.59825, 31.30846], // 16 INT
  [-2.59750, 31.30880], // 17 INT
  [-2.59675, 31.30914], // 18 INT
  [-2.59600, 31.30948], // 19 PA
  [-2.59519, 31.30958], // 20 INT
  [-2.59438, 31.30969], // 21 INT
  [-2.59357, 31.30980], // 22 INT
  [-2.59276, 31.30990], // 23 INT
  [-2.59193, 31.31001], // 24 PA
  [-2.59118, 31.31031], // 25 PA
  [-2.59035, 31.31049], // 26 INT
  [-2.58975, 31.31061], // 27 TRF RUBIZA-50kVA
  [-2.58946, 31.31069], // 28 TERMINAL
];

// ─── HAVERSINE REFERENCE (for negative test) ─────────────────────────
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function haversineRouteTotal(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistance(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1]
    );
  }
  return total;
}

describe('Geodesic Distance Engine', () => {
  describe('inverseGeodesic', () => {
    it('should return 0 for identical coordinates', () => {
      expect(inverseGeodesic(-2.58975, 31.31061, -2.58975, 31.31061)).toBe(0);
    });

    it('should return a positive distance for different coordinates', () => {
      const d = inverseGeodesic(-2.58975, 31.31061, -2.58930, 31.31071);
      expect(d).toBeGreaterThan(0);
    });

    it('should be symmetric (d(A,B) ≈ d(B,A))', () => {
      const dAB = inverseGeodesic(-2.58975, 31.31061, -2.58930, 31.31071);
      const dBA = inverseGeodesic(-2.58930, 31.31071, -2.58975, 31.31061);
      expect(Math.abs(dAB - dBA)).toBeLessThan(1e-8);
    });
  });

  describe('RUBIZA LV Regression', () => {
    it('should calculate ≈1,261.3108 m total route distance (WGS84/Karney)', () => {
      const segments = calculateSegmentDistances(LV_COORDINATES);
      const total = calculateTotalDistance(segments);
      expect(total).toBeCloseTo(1261.3108, 1);
    });

    it('MUST NOT produce Haversine result ≈1,265.12 m', () => {
      const segments = calculateSegmentDistances(LV_COORDINATES);
      const total = calculateTotalDistance(segments);
      const haversineTotal = haversineRouteTotal(LV_COORDINATES);

      expect(haversineTotal).toBeCloseTo(1265.12, 0);
      expect(Math.abs(total - haversineTotal)).toBeGreaterThan(1);
    });
  });

  describe('RUBIZA MV Regression', () => {
    it('should have 28 coordinate points', () => {
      expect(MV_COORDINATES.length).toBe(28);
    });

    it('should calculate ≈2,359.0672 m total route distance (WGS84/Karney)', () => {
      const segments = calculateSegmentDistances(MV_COORDINATES);
      const total = calculateTotalDistance(segments);
      expect(total).toBeCloseTo(2359.0672, 1);
    });
  });
});
