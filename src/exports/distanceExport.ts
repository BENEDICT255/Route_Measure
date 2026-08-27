/**
 * Distance mode Excel export.
 *
 * Generates an Excel report for Distance Between Points results.
 * Completely independent from the LV/MV route export.
 */

import type { DistanceAnalysisResult, DestinationSite, StartingPoint, DistanceResult } from '../types/distance';

/**
 * Export distance analysis results as an Excel workbook.
 */
export async function exportDistanceExcel(
  analysisResult: DistanceAnalysisResult,
  fileHash: string
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const { saveAs } = await import('file-saver');

  const workbook = new ExcelJS.Workbook();

  // ─── Summary Sheet ─────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Property', key: 'prop', width: 40 },
    { header: 'Value', key: 'value', width: 45 },
  ];

  const summary = analysisResult.summary;
  summarySheet.addRows([
    { prop: 'Report Type', value: 'Distance Between Points Analysis' },
    { prop: 'Destination Sites', value: summary.destinationCount },
    { prop: 'Starting Points Used', value: summary.startingPointCount },
    { prop: 'Average Distance (km)', value: Number(summary.averageDistanceKm.toFixed(1)) },
    { prop: 'Nearest Site', value: summary.nearestSite ? `${summary.nearestSite.name} (${summary.nearestSite.distanceKm.toFixed(1)} km)` : 'N/A' },
    { prop: 'Furthest Site', value: summary.furthestSite ? `${summary.furthestSite.name} (${summary.furthestSite.distanceKm.toFixed(1)} km)` : 'N/A' },
    { prop: 'Source File', value: analysisResult.sourceFile },
    { prop: 'Source Worksheet', value: analysisResult.sourceSheet },
    { prop: 'Processing Timestamp', value: analysisResult.processingTimestamp },
    { prop: 'Calculation Method', value: analysisResult.calculationMethod },
    { prop: 'Application Version', value: analysisResult.applicationVersion },
    { prop: 'File Hash (SHA-256)', value: fileHash },
  ]);
  summarySheet.getRow(1).font = { bold: true };

  // ─── Starting Points Sheet ─────────────────────────────────────
  const spSheet = workbook.addWorksheet('Starting Points');
  spSheet.columns = [
    { header: 'Starting Point', key: 'name', width: 30 },
    { header: 'Latitude', key: 'lat', width: 16 },
    { header: 'Longitude', key: 'lon', width: 16 },
    { header: 'Description', key: 'desc', width: 30 },
    { header: 'Source', key: 'source', width: 16 },
    { header: 'Assigned Destinations', key: 'count', width: 22 },
  ];

  const spCountMap = new Map<string, number>();
  for (const r of analysisResult.results) {
    spCountMap.set(r.startingPointUid, (spCountMap.get(r.startingPointUid) || 0) + 1);
  }

  for (const sp of analysisResult.startingPoints) {
    spSheet.addRow({
      name: sp.name,
      lat: sp.latitude,
      lon: sp.longitude,
      desc: sp.description || '',
      source: sp.source,
      count: spCountMap.get(sp.uid) || 0,
    });
  }
  spSheet.getRow(1).font = { bold: true };

  // ─── Distance Results Sheet ────────────────────────────────────
  const resultSheet = workbook.addWorksheet('Distance Results');
  resultSheet.columns = [
    { header: 'Rank (Furthest)', key: 'rank', width: 16 },
    { header: 'Site ID', key: 'siteId', width: 18 },
    { header: 'Legacy Site ID', key: 'legacyId', width: 18 },
    { header: 'Site Name', key: 'siteName', width: 25 },
    { header: 'Region/WHS', key: 'region', width: 20 },
    { header: 'Starting Point', key: 'spName', width: 25 },
    { header: 'Starting Latitude', key: 'spLat', width: 18 },
    { header: 'Starting Longitude', key: 'spLon', width: 18 },
    { header: 'Destination Latitude', key: 'destLat', width: 18 },
    { header: 'Destination Longitude', key: 'destLon', width: 18 },
    { header: 'Distance (m)', key: 'distM', width: 16 },
    { header: 'Distance (km)', key: 'distKm', width: 16 },
    { header: 'Bearing (°)', key: 'bearing', width: 14 },
  ];

  const spMap = new Map<string, StartingPoint>();
  for (const sp of analysisResult.startingPoints) {
    spMap.set(sp.uid, sp);
  }

  const destMap = new Map<string, DestinationSite>();
  for (const d of analysisResult.destinations) {
    destMap.set(d.uid, d);
  }

  // Sort by rank (furthest first)
  const sortedResults = [...analysisResult.results].sort((a, b) => a.rank - b.rank);

  for (const r of sortedResults) {
    const dest = destMap.get(r.destinationUid);
    const sp = spMap.get(r.startingPointUid);
    if (!dest || !sp) continue;

    resultSheet.addRow({
      rank: r.rank,
      siteId: dest.siteId || '',
      legacyId: dest.legacySiteId || '',
      siteName: dest.siteName || '',
      region: dest.region || '',
      spName: sp.name,
      spLat: sp.latitude,
      spLon: sp.longitude,
      destLat: dest.latitude,
      destLon: dest.longitude,
      distM: Number(r.distanceMetres.toFixed(1)),
      distKm: Number(r.distanceKm.toFixed(1)),
      bearing: Number(r.bearing.toFixed(2)),
    });
  }
  resultSheet.getRow(1).font = { bold: true };

  // ─── Write file ────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `RouteMeasure_Distance_Analysis_Report.xlsx`);
}
