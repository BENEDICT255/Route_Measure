/**
 * Assignment Table component.
 *
 * Spreadsheet-style interface for assigning starting points to destination
 * sites in the Distance Between Points measurement mode.
 *
 * Features:
 * - Checkbox row selection for bulk assignment
 * - Searchable starting point dropdown per row
 * - Compact filters (search, region, status, starting point)
 * - Bulk assignment bar
 * - Select All / Select All Filtered
 * - Assignment summary
 * - Quick Assign by group (when region column exists)
 * - Exclude from calculation
 */

import { useState, useMemo, useCallback } from 'react';
import type { DestinationSite, StartingPoint } from '../types/distance';
import { getDestinationDisplayLabel, getUniqueRegions } from '../workbook/distanceParser';

interface AssignmentTableProps {
  destinations: DestinationSite[];
  startingPoints: StartingPoint[];
  onAssign: (destUids: string[], spUid: string) => void;
  onExclude: (destUids: string[]) => void;
  onInclude: (destUids: string[]) => void;
  onOpenStartingPointManager: () => void;
}

type StatusFilter = 'all' | 'unassigned' | 'assigned' | 'excluded' | 'invalid';

export function AssignmentTable({
  destinations,
  startingPoints,
  onAssign,
  onExclude,
  onInclude,
  onOpenStartingPointManager,
}: AssignmentTableProps) {
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [spFilter, setSpFilter] = useState<string>('all');
  const [bulkSpUid, setBulkSpUid] = useState<string>('');
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [quickAssignMap, setQuickAssignMap] = useState<Record<string, string>>({});

  // Available regions
  const regions = useMemo(() => getUniqueRegions(destinations), [destinations]);
  const hasRegionColumn = regions.length > 0;

  // SP lookup
  const spMap = useMemo(() => {
    const m = new Map<string, StartingPoint>();
    for (const sp of startingPoints) m.set(sp.uid, sp);
    return m;
  }, [startingPoints]);

  // Filter destinations
  const filteredDests = useMemo(() => {
    return destinations.filter((d) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          (d.siteId && d.siteId.toLowerCase().includes(q)) ||
          (d.siteName && d.siteName.toLowerCase().includes(q)) ||
          (d.legacySiteId && d.legacySiteId.toLowerCase().includes(q)) ||
          (d.region && d.region.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Region filter
      if (regionFilter !== 'all' && d.region !== regionFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;

      // Starting point filter
      if (spFilter !== 'all') {
        if (spFilter === 'none' && d.assignedStartingPointUid) return false;
        if (spFilter !== 'none' && d.assignedStartingPointUid !== spFilter) return false;
      }

      return true;
    });
  }, [destinations, searchQuery, regionFilter, statusFilter, spFilter]);

  // Summary counts
  const summary = useMemo(() => {
    const total = destinations.length;
    const assigned = destinations.filter((d) => d.status === 'assigned').length;
    const unassigned = destinations.filter((d) => d.status === 'unassigned').length;
    const excluded = destinations.filter((d) => d.status === 'excluded').length;
    const invalid = destinations.filter((d) => d.status === 'invalid').length;
    const usedSPs = new Set(
      destinations.filter((d) => d.assignedStartingPointUid).map((d) => d.assignedStartingPointUid)
    );
    return { total, assigned, unassigned, excluded, invalid, startingPointCount: usedSPs.size };
  }, [destinations]);

  // Selection handlers
  const toggleSelect = useCallback((uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allFilteredUids = filteredDests.filter((d) => d.status !== 'invalid').map((d) => d.uid);
    setSelectedUids(new Set(allFilteredUids));
  }, [filteredDests]);

  const selectNone = useCallback(() => {
    setSelectedUids(new Set());
  }, []);

  const isAllSelected = filteredDests.length > 0 &&
    filteredDests.filter((d) => d.status !== 'invalid').every((d) => selectedUids.has(d.uid));

  // Bulk assign
  const handleBulkAssign = useCallback(() => {
    if (!bulkSpUid || selectedUids.size === 0) return;
    onAssign(Array.from(selectedUids), bulkSpUid);
    setSelectedUids(new Set());
    setBulkSpUid('');
  }, [bulkSpUid, selectedUids, onAssign]);

  // Bulk exclude
  const handleBulkExclude = useCallback(() => {
    if (selectedUids.size === 0) return;
    onExclude(Array.from(selectedUids));
    setSelectedUids(new Set());
  }, [selectedUids, onExclude]);

  // Quick Assign by region
  const handleQuickAssignApply = useCallback(() => {
    for (const [region, spUid] of Object.entries(quickAssignMap)) {
      if (!spUid) continue;
      const regionDestUids = destinations
        .filter((d) => d.region === region && d.status !== 'invalid')
        .map((d) => d.uid);
      if (regionDestUids.length > 0) {
        onAssign(regionDestUids, spUid);
      }
    }
    setShowQuickAssign(false);
    setQuickAssignMap({});
  }, [quickAssignMap, destinations, onAssign]);

  // Individual row assign
  const handleRowAssign = useCallback((destUid: string, spUid: string) => {
    onAssign([destUid], spUid);
  }, [onAssign]);

  return (
    <div className="rm-assign-container">
      {/* ─── HEADER ─── */}
      <div className="rm-assign-header">
        <div>
          <h3 className="rm-assign-title">Assign Starting Points</h3>
          <p className="rm-assign-subtitle">
            Select the starting point for each destination site. Use checkboxes for bulk assignment.
          </p>
        </div>
        <button className="rm-assign-manage-sp-btn" onClick={onOpenStartingPointManager}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5V11M5 8H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Manage Starting Points ({startingPoints.length})
        </button>
      </div>

      {/* ─── SUMMARY BAR ─── */}
      <div className="rm-assign-summary">
        <span className="rm-assign-summary-item">
          <strong>{summary.total}</strong> Sites
        </span>
        <span className="rm-assign-summary-divider">·</span>
        <span className="rm-assign-summary-item">
          <strong>{summary.startingPointCount}</strong> Starting Points
        </span>
        <span className="rm-assign-summary-divider">·</span>
        <span className="rm-assign-summary-item rm-assign-status-assigned">
          <strong>{summary.assigned}</strong> Assigned
        </span>
        <span className="rm-assign-summary-divider">·</span>
        <span className="rm-assign-summary-item rm-assign-status-unassigned">
          <strong>{summary.unassigned}</strong> Unassigned
        </span>
        {summary.excluded > 0 && (
          <>
            <span className="rm-assign-summary-divider">·</span>
            <span className="rm-assign-summary-item rm-assign-status-excluded">
              <strong>{summary.excluded}</strong> Excluded
            </span>
          </>
        )}
        {summary.invalid > 0 && (
          <>
            <span className="rm-assign-summary-divider">·</span>
            <span className="rm-assign-summary-item rm-assign-status-invalid">
              <strong>{summary.invalid}</strong> Invalid
            </span>
          </>
        )}
      </div>

      {/* ─── FILTERS BAR ─── */}
      <div className="rm-assign-filters">
        <div className="rm-assign-search-wrap">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rm-assign-search"
          />
        </div>

        {hasRegionColumn && (
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rm-assign-filter-select"
          >
            <option value="all">All Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rm-assign-filter-select"
        >
          <option value="all">All Status</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
          <option value="excluded">Excluded</option>
          <option value="invalid">Invalid</option>
        </select>

        <select
          value={spFilter}
          onChange={(e) => setSpFilter(e.target.value)}
          className="rm-assign-filter-select"
        >
          <option value="all">All Starting Points</option>
          <option value="none">No Starting Point</option>
          {startingPoints.map((sp) => (
            <option key={sp.uid} value={sp.uid}>{sp.name}</option>
          ))}
        </select>

        {hasRegionColumn && (
          <button
            className="rm-assign-quick-btn"
            onClick={() => setShowQuickAssign(!showQuickAssign)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 4M4 8H12M4 12H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Quick Assign
          </button>
        )}
      </div>

      {/* ─── QUICK ASSIGN BY GROUP ─── */}
      {showQuickAssign && hasRegionColumn && (
        <div className="rm-quick-assign-panel">
          <div className="rm-quick-assign-title">Quick Assign by Region</div>
          <div className="rm-quick-assign-grid">
            {regions.map((region) => {
              const count = destinations.filter((d) => d.region === region && d.status !== 'invalid').length;
              return (
                <div key={region} className="rm-quick-assign-row">
                  <span className="rm-quick-assign-region">{region} ({count})</span>
                  <select
                    value={quickAssignMap[region] || ''}
                    onChange={(e) => setQuickAssignMap({ ...quickAssignMap, [region]: e.target.value })}
                    className="rm-quick-assign-select"
                  >
                    <option value="">— Select —</option>
                    {startingPoints.map((sp) => (
                      <option key={sp.uid} value={sp.uid}>{sp.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="rm-quick-assign-actions">
            <button className="rm-quick-assign-cancel" onClick={() => setShowQuickAssign(false)}>Cancel</button>
            <button className="rm-quick-assign-apply" onClick={handleQuickAssignApply}>
              Apply Assignments
            </button>
          </div>
        </div>
      )}

      {/* ─── BULK ACTION BAR ─── */}
      {selectedUids.size > 0 && (
        <div className="rm-assign-bulk-bar">
          <span className="rm-assign-bulk-count">
            {selectedUids.size} selected
          </span>
          <div className="rm-assign-bulk-actions">
            <span className="rm-assign-bulk-label">Assign to:</span>
            <select
              value={bulkSpUid}
              onChange={(e) => setBulkSpUid(e.target.value)}
              className="rm-assign-bulk-select"
            >
              <option value="">— Select Starting Point —</option>
              {startingPoints.map((sp) => (
                <option key={sp.uid} value={sp.uid}>{sp.name}</option>
              ))}
            </select>
            <button
              className="rm-assign-bulk-apply"
              onClick={handleBulkAssign}
              disabled={!bulkSpUid}
            >
              Apply
            </button>
            <div className="rm-assign-bulk-divider" />
            <button className="rm-assign-bulk-exclude" onClick={handleBulkExclude}>
              Exclude
            </button>
            <button
              className="rm-assign-bulk-include"
              onClick={() => { onInclude(Array.from(selectedUids)); setSelectedUids(new Set()); }}
            >
              Include
            </button>
          </div>
        </div>
      )}

      {/* ─── DATA TABLE ─── */}
      <div className="rm-assign-table-wrap">
        <table className="rm-assign-table">
          <thead>
            <tr>
              <th className="rm-assign-th-check">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={() => isAllSelected ? selectNone() : selectAll()}
                />
              </th>
              <th>#</th>
              {destinations.some((d) => d.siteId) && <th>Site ID</th>}
              {destinations.some((d) => d.siteName) && <th>Site Name</th>}
              {hasRegionColumn && <th>Region/WHS</th>}
              <th>Latitude</th>
              <th>Longitude</th>
              <th className="rm-assign-th-sp">Starting Point</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredDests.map((dest, idx) => {
              const sp = dest.assignedStartingPointUid
                ? spMap.get(dest.assignedStartingPointUid)
                : null;
              const isSelected = selectedUids.has(dest.uid);

              return (
                <tr
                  key={dest.uid}
                  className={`rm-assign-row rm-assign-row-${dest.status} ${isSelected ? 'rm-assign-row-selected' : ''}`}
                >
                  <td className="rm-assign-td-check">
                    {dest.status !== 'invalid' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(dest.uid)}
                      />
                    )}
                  </td>
                  <td className="rm-assign-td-idx">{idx + 1}</td>
                  {destinations.some((d) => d.siteId) && (
                    <td className="rm-assign-td-id">{dest.siteId || '—'}</td>
                  )}
                  {destinations.some((d) => d.siteName) && (
                    <td className="rm-assign-td-name">{dest.siteName || '—'}</td>
                  )}
                  {hasRegionColumn && (
                    <td className="rm-assign-td-region">{dest.region || '—'}</td>
                  )}
                  <td className="rm-assign-td-coord">{dest.latitude.toFixed(5)}</td>
                  <td className="rm-assign-td-coord">{dest.longitude.toFixed(5)}</td>
                  <td className="rm-assign-td-sp">
                    {dest.status !== 'invalid' ? (
                      <select
                        value={dest.assignedStartingPointUid || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleRowAssign(dest.uid, e.target.value);
                          }
                        }}
                        className="rm-assign-sp-select"
                      >
                        <option value="">— Select —</option>
                        {startingPoints.map((s) => (
                          <option key={s.uid} value={s.uid}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rm-assign-invalid-text">Invalid coords</span>
                    )}
                  </td>
                  <td>
                    <span className={`rm-assign-status-badge rm-assign-badge-${dest.status}`}>
                      {dest.status === 'assigned' && '✓ Assigned'}
                      {dest.status === 'unassigned' && '○ Unassigned'}
                      {dest.status === 'excluded' && '✕ Excluded'}
                      {dest.status === 'invalid' && '⚠ Invalid'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredDests.length === 0 && (
          <div className="rm-assign-no-results">
            No sites match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
