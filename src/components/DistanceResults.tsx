/**
 * Distance Results component.
 *
 * Displays the results of a Distance Between Points analysis.
 * Shows summary metrics, sortable results table, and starting point filter.
 */

import { useState, useMemo, useCallback } from 'react';
import type { DistanceAnalysisResult, DistanceResult, DestinationSite, StartingPoint } from '../types/distance';
import { recomputeRanks } from '../measurement/distanceCalculator';
import { getDestinationDisplayLabel } from '../workbook/distanceParser';
import { formatNumber } from '../utils/formatters';

interface DistanceResultsProps {
  analysisResult: DistanceAnalysisResult;
  onExportExcel: () => void;
  onExportKml: () => void;
  onSiteSelect: (destUid: string) => void;
  selectedSiteUid: string | null;
  startingPointFilter: string;
  onStartingPointFilterChange: (spUid: string) => void;
}

type SortField = 'rank' | 'distance' | 'siteName' | 'region' | 'startingPoint';
type SortDir = 'asc' | 'desc';

export function DistanceResultsPanel({
  analysisResult,
  onExportExcel,
  onExportKml,
  onSiteSelect,
  selectedSiteUid,
  startingPointFilter,
  onStartingPointFilterChange,
}: DistanceResultsProps) {
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const { destinations, startingPoints, results, summary } = analysisResult;

  // Lookup maps
  const destMap = useMemo(() => {
    const m = new Map<string, DestinationSite>();
    for (const d of destinations) m.set(d.uid, d);
    return m;
  }, [destinations]);

  const spMap = useMemo(() => {
    const m = new Map<string, StartingPoint>();
    for (const sp of startingPoints) m.set(sp.uid, sp);
    return m;
  }, [startingPoints]);

  // Filter by starting point
  const filteredResults = useMemo(() => {
    let filtered = results;

    if (startingPointFilter !== 'all') {
      filtered = filtered.filter((r) => r.startingPointUid === startingPointFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        const dest = destMap.get(r.destinationUid);
        if (!dest) return false;
        return (
          (dest.siteId && dest.siteId.toLowerCase().includes(q)) ||
          (dest.siteName && dest.siteName.toLowerCase().includes(q)) ||
          (dest.region && dest.region.toLowerCase().includes(q))
        );
      });
    }

    return filtered;
  }, [results, startingPointFilter, searchQuery, destMap]);

  // Sort
  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults];
    sorted.sort((a, b) => {
      let cmp = 0;
      const destA = destMap.get(a.destinationUid);
      const destB = destMap.get(b.destinationUid);

      switch (sortField) {
        case 'rank':
          cmp = a.rank - b.rank;
          break;
        case 'distance':
          cmp = a.distanceMetres - b.distanceMetres;
          break;
        case 'siteName':
          cmp = (destA?.siteName || '').localeCompare(destB?.siteName || '');
          break;
        case 'region':
          cmp = (destA?.region || '').localeCompare(destB?.region || '');
          break;
        case 'startingPoint': {
          const spA = spMap.get(a.startingPointUid);
          const spB = spMap.get(b.startingPointUid);
          cmp = (spA?.name || '').localeCompare(spB?.name || '');
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [filteredResults, sortField, sortDir, destMap, spMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'distance' ? 'desc' : 'asc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  // Filtered summary
  const filteredSummary = useMemo(() => {
    if (filteredResults.length === 0) return null;
    const totalKm = filteredResults.reduce((s, r) => s + r.distanceKm, 0);
    const avgKm = totalKm / filteredResults.length;
    const sorted = [...filteredResults].sort((a, b) => a.distanceMetres - b.distanceMetres);
    const nearest = sorted[0];
    const furthest = sorted[sorted.length - 1];
    const nearestDest = destMap.get(nearest.destinationUid);
    const furthestDest = destMap.get(furthest.destinationUid);
    return {
      count: filteredResults.length,
      avgKm,
      nearest: nearestDest ? { name: getDestinationDisplayLabel(nearestDest), km: nearest.distanceKm } : null,
      furthest: furthestDest ? { name: getDestinationDisplayLabel(furthestDest), km: furthest.distanceKm } : null,
    };
  }, [filteredResults, destMap]);

  return (
    <div className="rm-dist-results">
      {/* ─── SUMMARY CARDS ─── */}
      <div className="rm-dist-summary-grid">
        <div className="rm-dist-summary-card rm-dist-summary-primary">
          <div className="rm-dist-summary-label">Distance Analysis</div>
          <div className="rm-dist-summary-value">{summary.destinationCount}</div>
          <div className="rm-dist-summary-sub">Destination Sites</div>
        </div>

        <div className="rm-dist-summary-card">
          <div className="rm-dist-summary-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="8" cy="8" r="2" fill="currentColor" />
            </svg>
          </div>
          <div className="rm-dist-summary-value">{summary.startingPointCount}</div>
          <div className="rm-dist-summary-sub">Starting Points</div>
        </div>

        <div className="rm-dist-summary-card">
          <div className="rm-dist-summary-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 12L8 4L14 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="rm-dist-summary-value">
            {formatNumber(summary.averageDistanceKm, 1)} km
          </div>
          <div className="rm-dist-summary-sub">Average Distance</div>
        </div>

        <div className="rm-dist-summary-card">
          <div className="rm-dist-summary-icon" style={{ color: '#10b981' }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M4 9L8 13L12 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="rm-dist-summary-value">
            {summary.nearestSite ? `${formatNumber(summary.nearestSite.distanceKm, 1)} km` : '—'}
          </div>
          <div className="rm-dist-summary-sub">
            Nearest{summary.nearestSite ? ` — ${summary.nearestSite.name}` : ''}
          </div>
        </div>

        <div className="rm-dist-summary-card">
          <div className="rm-dist-summary-icon" style={{ color: '#ef4444' }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M4 7L8 3L12 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="rm-dist-summary-value">
            {summary.furthestSite ? `${formatNumber(summary.furthestSite.distanceKm, 1)} km` : '—'}
          </div>
          <div className="rm-dist-summary-sub">
            Furthest{summary.furthestSite ? ` — ${summary.furthestSite.name}` : ''}
          </div>
        </div>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div className="rm-dist-filter-bar">
        <div className="rm-dist-search-wrap">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rm-dist-search"
          />
        </div>

        <select
          value={startingPointFilter}
          onChange={(e) => onStartingPointFilterChange(e.target.value)}
          className="rm-dist-filter-select"
        >
          <option value="all">All Starting Points</option>
          {startingPoints.map((sp) => (
            <option key={sp.uid} value={sp.uid}>{sp.name}</option>
          ))}
        </select>

        <div className="rm-dist-export-actions">
          <button className="rm-dist-export-btn" onClick={onExportExcel}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 5L11 11M11 5L5 11" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Excel Report
          </button>
          <button className="rm-dist-export-btn" onClick={onExportKml}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
              <ellipse cx="8" cy="8" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            KML Export
          </button>
        </div>
      </div>

      {/* ─── RESULTS TABLE ─── */}
      <div className="rm-dist-table-wrap">
        <table className="rm-dist-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('rank')} className="rm-dist-th-sort">
                Rank {sortIcon('rank')}
              </th>
              {destinations.some((d) => d.siteId) && <th>Site ID</th>}
              <th onClick={() => handleSort('siteName')} className="rm-dist-th-sort">
                Site Name {sortIcon('siteName')}
              </th>
              {destinations.some((d) => d.region) && (
                <th onClick={() => handleSort('region')} className="rm-dist-th-sort">
                  Region/WHS {sortIcon('region')}
                </th>
              )}
              <th onClick={() => handleSort('startingPoint')} className="rm-dist-th-sort">
                Starting Point {sortIcon('startingPoint')}
              </th>
              <th>Lat</th>
              <th>Lon</th>
              <th onClick={() => handleSort('distance')} className="rm-dist-th-sort">
                Distance (km) {sortIcon('distance')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((r) => {
              const dest = destMap.get(r.destinationUid);
              const sp = spMap.get(r.startingPointUid);
              if (!dest) return null;

              const isSelected = selectedSiteUid === dest.uid;

              return (
                <tr
                  key={r.destinationUid}
                  className={`rm-dist-row ${isSelected ? 'rm-dist-row-selected' : ''}`}
                  onClick={() => onSiteSelect(dest.uid)}
                >
                  <td className="rm-dist-td-rank">{r.rank}</td>
                  {destinations.some((d) => d.siteId) && (
                    <td className="rm-dist-td-id">{dest.siteId || '—'}</td>
                  )}
                  <td className="rm-dist-td-name">{dest.siteName || getDestinationDisplayLabel(dest)}</td>
                  {destinations.some((d) => d.region) && (
                    <td className="rm-dist-td-region">{dest.region || '—'}</td>
                  )}
                  <td className="rm-dist-td-sp">{sp?.name || '—'}</td>
                  <td className="rm-dist-td-coord">{dest.latitude.toFixed(5)}</td>
                  <td className="rm-dist-td-coord">{dest.longitude.toFixed(5)}</td>
                  <td className="rm-dist-td-distance">
                    <strong>{formatNumber(r.distanceKm, 1)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sortedResults.length === 0 && (
          <div className="rm-dist-no-results">No results match the current filters.</div>
        )}
      </div>
    </div>
  );
}
