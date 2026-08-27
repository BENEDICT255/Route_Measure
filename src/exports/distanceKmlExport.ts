/**
 * Distance mode KML export.
 *
 * Exports starting points, destination sites, and independent connection
 * lines grouped by starting point. Does NOT connect destinations to each other.
 */

import type { DistanceAnalysisResult, DestinationSite, StartingPoint, DistanceResult } from '../types/distance';

/** Deterministic color palette for starting points (KML uses AABBGGRR format) */
const SP_COLORS_KML = [
  'ffff6b2f', // Blue (#2F6BFF)
  'ff42b9f4', // Amber (#F4B942)
  'ff9dcea3', // Teal (#A3CE9D)
  'ff5a6be8', // Coral (#E86B5A)
  'ffb87dd4', // Violet (#D47DB8)
  'ff8c9ea0', // Slate (#A09E8C)
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export distance analysis results as KML.
 */
export function exportDistanceKml(analysisResult: DistanceAnalysisResult): void {
  const spMap = new Map<string, StartingPoint>();
  for (const sp of analysisResult.startingPoints) {
    spMap.set(sp.uid, sp);
  }

  const destMap = new Map<string, DestinationSite>();
  for (const d of analysisResult.destinations) {
    destMap.set(d.uid, d);
  }

  // Group results by starting point
  const grouped = new Map<string, DistanceResult[]>();
  for (const r of analysisResult.results) {
    if (!grouped.has(r.startingPointUid)) {
      grouped.set(r.startingPointUid, []);
    }
    grouped.get(r.startingPointUid)!.push(r);
  }

  // Build KML folders per starting point
  const folders: string[] = [];
  let spIndex = 0;

  for (const [spUid, results] of grouped) {
    const sp = spMap.get(spUid);
    if (!sp) continue;

    const color = SP_COLORS_KML[spIndex % SP_COLORS_KML.length];
    spIndex++;

    // Starting point placemark
    const spPlacemark = `
        <Placemark>
          <name>${escapeXml(sp.name)}</name>
          <description>Starting Point: ${escapeXml(sp.name)}
Latitude: ${sp.latitude}
Longitude: ${sp.longitude}
Assigned Destinations: ${results.length}</description>
          <Style>
            <IconStyle>
              <color>ff0000ff</color>
              <scale>1.3</scale>
            </IconStyle>
          </Style>
          <Point>
            <coordinates>${sp.longitude},${sp.latitude},0</coordinates>
          </Point>
        </Placemark>`;

    // Destination placemarks and connection lines
    const destPlacemarks: string[] = [];
    const connectionLines: string[] = [];

    for (const r of results) {
      const dest = destMap.get(r.destinationUid);
      if (!dest) continue;

      const destName = dest.siteName || dest.siteId || `Site Row ${dest.sourceRow}`;

      destPlacemarks.push(`
        <Placemark>
          <name>${escapeXml(destName)}</name>
          <description>Site: ${escapeXml(destName)}
${dest.siteId ? `Site ID: ${escapeXml(dest.siteId)}` : ''}
${dest.region ? `Region: ${escapeXml(dest.region)}` : ''}
Starting Point: ${escapeXml(sp.name)}
Distance: ${r.distanceKm.toFixed(1)} km (${r.distanceMetres.toFixed(1)} m)
Bearing: ${r.bearing.toFixed(2)}°</description>
          <Point>
            <coordinates>${dest.longitude},${dest.latitude},0</coordinates>
          </Point>
        </Placemark>`);

      // Independent connection line (NOT chained)
      connectionLines.push(`
        <Placemark>
          <name>${escapeXml(sp.name)} → ${escapeXml(destName)} (${r.distanceKm.toFixed(1)} km)</name>
          <styleUrl>#style_${escapeXml(spUid)}</styleUrl>
          <LineString>
            <tessellate>1</tessellate>
            <coordinates>
              ${sp.longitude},${sp.latitude},0
              ${dest.longitude},${dest.latitude},0
            </coordinates>
          </LineString>
        </Placemark>`);
    }

    folders.push(`
      <Folder>
        <name>${escapeXml(sp.name)} (${results.length} sites)</name>
        <Style id="style_${escapeXml(spUid)}">
          <LineStyle>
            <color>${color}</color>
            <width>2</width>
          </LineStyle>
        </Style>
        ${spPlacemark}
        ${destPlacemarks.join('')}
        ${connectionLines.join('')}
      </Folder>`);
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>RouteMeasure — Distance Analysis</name>
    <description>Point-to-point distance analysis. ${analysisResult.summary.destinationCount} destinations, ${analysisResult.summary.startingPointCount} starting points.</description>
    ${folders.join('')}
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'RouteMeasure_Distance_Analysis.kml';
  a.click();
  URL.revokeObjectURL(url);
}
