/**
 * Assignment Modal component for Distance Between Points mode.
 *
 * Dedicated modal for assigning starting points to destination sites.
 * Supports:
 * - Option A: FROM UPLOADED SITES (searchable picker, auto-fills coordinates)
 * - Option B: ENTER MANUALLY (validated lat/lon, name, description)
 * - Reusable starting point library
 * - Checkbox multi-select, Select All, Select All Filtered
 * - Compact filters (Search, Region, Starting Point, Status)
 * - Bulk assignment & row-level quick assignment
 * - Exclude from calculation
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { DestinationSite, StartingPoint, StartingPointSource } from '../types/distance';
import { generateUid } from '../utils/formatters';
import { getDestinationDisplayLabel, getUniqueRegions } from '../workbook/distanceParser';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinations: DestinationSite[];
  startingPoints: StartingPoint[];
  onAssign: (destUids: string[], sp: StartingPoint) => void;
  onClearAssignment: (destUids: string[]) => void;
  onExclude: (destUids: string[]) => void;
  onInclude: (destUids: string[]) => void;
  onAddStartingPoint: (sp: StartingPoint) => void;
  onRemoveStartingPoint: (uid: string) => void;
}

type AssignmentSourceOption = 'sheet' | 'manual';
type StatusFilter = 'all' | 'unassigned' | 'assigned' | 'excluded';

export function AssignmentModal({
  isOpen,
  onClose,
  destinations,
  startingPoints,
  onAssign,
  onClearAssignment,
  onExclude,
  onInclude,
  onAddStartingPoint,
  onRemoveStartingPoint,
}: AssignmentModalProps) {
  // Selection state
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [spFilter, setSpFilter] = useState<string>('all');

  // Bulk assignment configuration
  const [assignSource, setAssignSource] = useState<AssignmentSourceOption>('sheet');
  const [selectedLibrarySpUid, setSelectedLibrarySpUid] = useState<string>('');
  const [isControlsExpanded, setIsControlsExpanded] = useState<boolean>(true);
  
  // Option A (From Sheet) state
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  const [selectedSheetSite, setSelectedSheetSite] = useState<DestinationSite | null>(null);
  const [showSheetDropdown, setShowSheetDropdown] = useState(false);
  const sheetComboboxRef = useRef<HTMLDivElement>(null);

  // Option B (Manual) state
  const [manualName, setManualName] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Quick Assign by Region helper
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [regionSpMap, setRegionSpMap] = useState<Record<string, string>>({});

  // Available regions
  const regions = useMemo(() => getUniqueRegions(destinations), [destinations]);

  // Lookup map for starting points
  const spMap = useMemo(() => {
    const m = new Map<string, StartingPoint>();
    for (const sp of startingPoints) m.set(sp.uid, sp);
    return m;
  }, [startingPoints]);

  // Click outside to close sheet search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sheetComboboxRef.current && !sheetComboboxRef.current.contains(e.target as Node)) {
        setShowSheetDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter destination rows
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

  // Search results for Option A (From Sheet)
  const sheetSearchResults = useMemo(() => {
    const validSites = destinations.filter((d) => d.status !== 'invalid');
    if (!sheetSearchQuery.trim()) return validSites.slice(0, 50);
    const q = sheetSearchQuery.toLowerCase();
    return validSites.filter((d) =>
      (d.siteId && d.siteId.toLowerCase().includes(q)) ||
      (d.siteName && d.siteName.toLowerCase().includes(q)) ||
      (d.legacySiteId && d.legacySiteId.toLowerCase().includes(q)) ||
      (d.region && d.region.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [destinations, sheetSearchQuery]);

  // Summary counts
  const summary = useMemo(() => {
    const total = destinations.length;
    const assigned = destinations.filter((d) => d.status === 'assigned').length;
    const unassigned = destinations.filter((d) => d.status === 'unassigned').length;
    const excluded = destinations.filter((d) => d.status === 'excluded').length;
    return { total, assigned, unassigned, excluded };
  }, [destinations]);

  // Selection handlers
  const handleToggleSelect = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const validFiltered = filteredDests.filter((d) => d.status !== 'invalid');
    if (selectedUids.size === validFiltered.length && validFiltered.length > 0) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(validFiltered.map((d) => d.uid)));
    }
  };

  const handleClearSelection = () => {
    setSelectedUids(new Set());
  };

  // Check if current selected sheet site is inside the selected destinations
  const isSelfAssignment = useMemo(() => {
    if (!selectedSheetSite) return false;
    return selectedUids.has(selectedSheetSite.uid);
  }, [selectedSheetSite, selectedUids]);

  // Target region state for workflow assignment
  const [targetRegion, setTargetRegion] = useState<string>('');

  useEffect(() => {
    if (!targetRegion && regions.length > 0) {
      setTargetRegion(regions[0]);
    }
  }, [regions, targetRegion]);

  // Resolve or create the active starting point from current configuration
  const getOrResolveTargetStartingPoint = (): StartingPoint | null => {
    setManualError(null);

    // 1. If an existing library starting point is chosen
    if (selectedLibrarySpUid) {
      const sp = spMap.get(selectedLibrarySpUid) || null;
      if (sp) return sp;
    }

    // 2. If Option A: From Uploaded Sites
    if (assignSource === 'sheet') {
      if (!selectedSheetSite) {
        setManualError('Please select a site from the uploaded workbook.');
        return null;
      }
      const displayName = getDestinationDisplayLabel(selectedSheetSite);
      // Check if this sheet site already exists in startingPoints
      let existing = startingPoints.find(
        (sp) => sp.source === 'sheet' && sp.sourceSiteUid === selectedSheetSite.uid
      );
      if (!existing) {
        existing = {
          uid: generateUid(),
          name: displayName,
          latitude: selectedSheetSite.latitude,
          longitude: selectedSheetSite.longitude,
          description: selectedSheetSite.region ? `Region: ${selectedSheetSite.region}` : 'Uploaded Site',
          source: 'sheet',
          startingSiteId: selectedSheetSite.siteId || selectedSheetSite.legacySiteId,
          sourceSiteUid: selectedSheetSite.uid,
          sourceRow: selectedSheetSite.sourceRow,
        };
        onAddStartingPoint(existing);
      }
      return existing;
    }

    // 3. If Option B: Enter Manually
    if (assignSource === 'manual') {
      const name = manualName.trim();
      if (!name) {
        setManualError('Starting point name is required.');
        return null;
      }
      const lat = Number(manualLat.trim());
      const lon = Number(manualLon.trim());
      if (isNaN(lat) || manualLat.trim() === '') {
        setManualError('Latitude must be a valid number.');
        return null;
      }
      if (isNaN(lon) || manualLon.trim() === '') {
        setManualError('Longitude must be a valid number.');
        return null;
      }
      if (lat < -90 || lat > 90) {
        setManualError(`Latitude ${lat} is invalid. Latitude must be between -90 and +90.`);
        return null;
      }
      if (lon < -180 || lon > 180) {
        setManualError(`Longitude ${lon} is invalid. Longitude must be between -180 and +180.`);
        return null;
      }

      // Check if duplicate manual name
      let existing = startingPoints.find(
        (sp) => sp.source === 'manual' && sp.name.toLowerCase() === name.toLowerCase()
      );
      if (!existing) {
        existing = {
          uid: generateUid(),
          name,
          latitude: lat,
          longitude: lon,
          description: manualDesc.trim() || undefined,
          source: 'manual',
        };
        onAddStartingPoint(existing);
      }
      return existing;
    }

    return null;
  };

  // Direct action: Select a site from table to be the starting point
  const handleSetSiteAsStartingPoint = (dest: DestinationSite) => {
    setSelectedSheetSite(dest);
    setAssignSource('sheet');
    setSelectedLibrarySpUid('');
    setIsControlsExpanded(true);
    setManualError(null);
    if (dest.region && dest.region.trim()) {
      setTargetRegion(dest.region.trim());
    }
  };

  // Apply to checked checkbox sites
  const handleApplyAssignment = () => {
    const targetSp = getOrResolveTargetStartingPoint();
    if (!targetSp) return;

    const targetUids = Array.from(selectedUids);
    if (targetUids.length === 0) {
      setManualError('Please select one or more destination sites below using the checkboxes.');
      return;
    }

    onAssign(targetUids, targetSp);
    setSelectedUids(new Set());
  };

  // 1-Click: Assign active starting point to ALL destination sites
  const handleAssignToAllSites = () => {
    const targetSp = getOrResolveTargetStartingPoint();
    if (!targetSp) return;

    const allValidUids = destinations
      .filter((d) => d.status !== 'invalid' && d.status !== 'excluded')
      .map((d) => d.uid);

    if (allValidUids.length === 0) return;
    onAssign(allValidUids, targetSp);
    setSelectedUids(new Set());
  };

  // 1-Click: Assign active starting point to all sites in a region
  const handleAssignToRegion = (reg: string) => {
    if (!reg) return;
    const targetSp = getOrResolveTargetStartingPoint();
    if (!targetSp) return;

    const regionUids = destinations
      .filter((d) => d.region === reg && d.status !== 'invalid' && d.status !== 'excluded')
      .map((d) => d.uid);

    if (regionUids.length === 0) {
      setManualError(`No valid destination sites found in region "${reg}".`);
      return;
    }

    onAssign(regionUids, targetSp);
    setSelectedUids(new Set());
  };

  // Quick assign by region apply
  const handleApplyQuickAssign = () => {
    for (const [region, spUid] of Object.entries(regionSpMap)) {
      if (!spUid) continue;
      const sp = spMap.get(spUid);
      if (!sp) continue;
      const matchingDests = destinations
        .filter((d) => d.region === region && d.status !== 'excluded' && d.status !== 'invalid')
        .map((d) => d.uid);
      if (matchingDests.length > 0) {
        onAssign(matchingDests, sp);
      }
    }
    setShowQuickAssign(false);
  };

  if (!isOpen) return null;

  return (
    <div className="rm-assign-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rm-assign-modal-content">
        {/* ─── STICKY HEADER BLOCK (HEADER + SUMMARY BAR PINNED AT TOP) ─── */}
        <div className="rm-assign-sticky-header-block">
          {/* ─── MODAL HEADER ─── */}
          <div className="rm-assign-modal-header">
            <div className="rm-assign-modal-header-left">
              <h2 className="rm-assign-modal-title">Assign Starting Points</h2>
              <p className="rm-assign-modal-subtitle">
                The uploaded coordinates are destination points. Select destination sites and assign the starting point to use for each site.
              </p>
            </div>
            <button className="rm-assign-modal-close" onClick={onClose} title="Done / Close">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* ─── SUMMARY BAR ─── */}
          <div className="rm-assign-summary-bar">
            <div className="rm-assign-summary-stat">
              <span className="rm-stat-label">Destination Sites:</span>
              <span className="rm-stat-val">{summary.total}</span>
            </div>
            <div className="rm-assign-summary-divider" />
            <div className="rm-assign-summary-stat">
              <span className="rm-stat-label">Starting Points:</span>
              <span className="rm-stat-val">{startingPoints.length}</span>
            </div>
            <div className="rm-assign-summary-divider" />
            <div className="rm-assign-summary-stat">
              <span className="rm-stat-label">Assigned:</span>
              <span className="rm-stat-val rm-stat-green">{summary.assigned}</span>
            </div>
            <div className="rm-assign-summary-divider" />
            <div className="rm-assign-summary-stat">
              <span className="rm-stat-label">Unassigned:</span>
              <span className={`rm-stat-val ${summary.unassigned > 0 ? 'rm-stat-amber' : ''}`}>
                {summary.unassigned}
              </span>
            </div>
            <div className="rm-assign-summary-divider" />
            <div className="rm-assign-summary-stat">
              <span className="rm-stat-label">Excluded:</span>
              <span className="rm-stat-val rm-stat-muted">{summary.excluded}</span>
            </div>
            <div className="rm-assign-summary-spacer" />
            <div className="rm-assign-helper-badge">
              💡 Select multiple sites to apply one starting point in bulk
            </div>
          </div>
        </div>

        {/* ─── BULK ASSIGNMENT DRAWER (ACTIVE ASSIGNMENT CONTROLS) ─── */}
        <div className="rm-bulk-assign-panel">
          <div className="rm-bulk-assign-header">
            <div className="rm-bulk-selected-count">
              {selectedUids.size > 0 ? (
                <div className="rm-bulk-count-row">
                  <span>
                    <strong>{selectedUids.size}</strong> site{selectedUids.size > 1 ? 's' : ''} selected
                  </span>
                  {selectedUids.size === 1 && (
                    <button
                      type="button"
                      className="rm-btn-pick-single-start"
                      onClick={() => {
                        const targetDest = destinations.find((d) => selectedUids.has(d.uid));
                        if (targetDest) handleSetSiteAsStartingPoint(targetDest);
                      }}
                      title="Set this selected site as Starting Point"
                    >
                      📍 Set as Starting Point
                    </button>
                  )}
                </div>
              ) : (
                <span className="rm-bulk-none-selected">
                  No sites selected (select checkboxes below to bulk assign)
                </span>
              )}
            </div>

            <div className="rm-bulk-header-right">
              {/* Reusable Library Dropdown */}
              {startingPoints.length > 0 && (
                <div className="rm-library-picker">
                  <span className="rm-picker-label">Existing Starting Point:</span>
                  <select
                    className="rm-library-select"
                    value={selectedLibrarySpUid}
                    onChange={(e) => {
                      setSelectedLibrarySpUid(e.target.value);
                    }}
                  >
                    <option value="">-- Choose or create below --</option>
                    {startingPoints.map((sp) => (
                      <option key={sp.uid} value={sp.uid}>
                        {sp.name} ({sp.source === 'sheet' ? 'Uploaded' : 'Manual'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="rm-toggle-controls-btn"
                onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                title={isControlsExpanded ? 'Minimize setup panel' : 'Expand setup panel'}
              >
                {isControlsExpanded ? 'Hide Setup ▲' : 'Setup Starting Point ▼'}
              </button>
            </div>
          </div>

          {isControlsExpanded && (
            <>
              {/* If not using an existing library starting point, show creation source options */}
              {!selectedLibrarySpUid && (
            <div className="rm-source-section">
              <div className="rm-source-tabs">
                <button
                  type="button"
                  className={`rm-source-tab ${assignSource === 'sheet' ? 'active' : ''}`}
                  onClick={() => setAssignSource('sheet')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 5H11M5 8H11M5 11H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Option A: From Uploaded Sites
                </button>
                <button
                  type="button"
                  className={`rm-source-tab ${assignSource === 'manual' ? 'active' : ''}`}
                  onClick={() => setAssignSource('manual')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Option B: Enter Manually
                </button>
              </div>

              {/* OPTION A: SEARCHABLE UPLOADED SITE PICKER */}
              {assignSource === 'sheet' && (
                <div className="rm-sheet-picker-box">
                  <div className="rm-combobox-wrapper" ref={sheetComboboxRef}>
                    <label className="rm-field-tiny-label">Search Uploaded Site:</label>
                    <div className="rm-combobox-input-wrap">
                      <input
                        type="text"
                        className="rm-combobox-input"
                        placeholder="Search by HT Site ID, Name, Region (e.g. Nanyamba)..."
                        value={selectedSheetSite ? getDestinationDisplayLabel(selectedSheetSite) : sheetSearchQuery}
                        onChange={(e) => {
                          setSelectedSheetSite(null);
                          setSheetSearchQuery(e.target.value);
                          setShowSheetDropdown(true);
                        }}
                        onFocus={() => setShowSheetDropdown(true)}
                      />
                      {selectedSheetSite && (
                        <button
                          type="button"
                          className="rm-combobox-clear-btn"
                          onClick={() => {
                            setSelectedSheetSite(null);
                            setSheetSearchQuery('');
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Autocomplete dropdown */}
                    {showSheetDropdown && !selectedSheetSite && (
                      <div className="rm-combobox-dropdown">
                        {sheetSearchResults.length === 0 ? (
                          <div className="rm-combobox-no-results">No matching uploaded sites found</div>
                        ) : (
                          sheetSearchResults.map((dest) => (
                            <div
                              key={dest.uid}
                              className="rm-combobox-item"
                              onClick={() => {
                                setSelectedSheetSite(dest);
                                setShowSheetDropdown(false);
                              }}
                            >
                              <div className="rm-item-title">
                                {dest.siteName || dest.siteId || `Row ${dest.sourceRow}`}
                                {dest.siteId && dest.siteName && (
                                  <span className="rm-item-id"> — {dest.siteId}</span>
                                )}
                              </div>
                              <div className="rm-item-meta">
                                {dest.region && <span className="rm-item-region">{dest.region} • </span>}
                                <span className="rm-item-coords">
                                  {dest.latitude.toFixed(6)}, {dest.longitude.toFixed(6)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Read-Only Coordinate Preview & Starting Point Assignment Workflow */}
                  {selectedSheetSite && (
                    <div className="rm-assign-workflow-card">
                      <div className="rm-workflow-site-header">
                        <div className="rm-workflow-header-left">
                          <div className="rm-workflow-badge">📍 Starting Point Selected</div>
                          <div className="rm-workflow-site-details">
                            <span className="rm-workflow-site-name">{getDestinationDisplayLabel(selectedSheetSite)}</span>
                            <span className="rm-workflow-site-coords">
                              Lat: {selectedSheetSite.latitude.toFixed(6)}, Lon: {selectedSheetSite.longitude.toFixed(6)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rm-workflow-change-btn"
                          onClick={() => {
                            setSelectedSheetSite(null);
                            setSheetSearchQuery('');
                          }}
                          title="Choose a different site"
                        >
                          Change Site
                        </button>
                      </div>

                      {isSelfAssignment && (
                        <div className="rm-self-assign-note">
                          ℹ️ Note: This site is also in your destinations list. Its calculated distance to itself will be 0 m.
                        </div>
                      )}

                      <div className="rm-workflow-prompt-bar">
                        <span className="rm-workflow-prompt-text">
                          Set <strong>{getDestinationDisplayLabel(selectedSheetSite)}</strong> as starting point for:
                        </span>
                      </div>

                      <div className="rm-workflow-target-grid">
                        {/* Option 1: All Destination Sites */}
                        <button
                          type="button"
                          className="rm-workflow-action-card"
                          onClick={handleAssignToAllSites}
                        >
                          <div className="rm-wac-icon">🌐</div>
                          <div className="rm-wac-content">
                            <div className="rm-wac-title">All Destination Sites</div>
                            <div className="rm-wac-desc">Assign to all {summary.total} sites in this workbook</div>
                          </div>
                          <span className="rm-wac-arrow">→</span>
                        </button>

                        {/* Option 2: Sites in Region */}
                        {regions.length > 0 && (
                          <div className="rm-workflow-action-card region-card">
                            <div className="rm-wac-icon">🗺️</div>
                            <div className="rm-wac-content">
                              <div className="rm-wac-title">Sites in Region</div>
                              <div className="rm-wac-region-picker">
                                <select
                                  className="rm-workflow-region-select"
                                  value={targetRegion}
                                  onChange={(e) => setTargetRegion(e.target.value)}
                                >
                                  {regions.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="rm-workflow-region-btn"
                                  onClick={() => handleAssignToRegion(targetRegion)}
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Option 3: Selected Checkbox Sites */}
                        <button
                          type="button"
                          className={`rm-workflow-action-card ${selectedUids.size > 0 ? 'active-selection' : ''}`}
                          disabled={selectedUids.size === 0}
                          onClick={handleApplyAssignment}
                        >
                          <div className="rm-wac-icon">☑️</div>
                          <div className="rm-wac-content">
                            <div className="rm-wac-title">Selected Checkbox Sites</div>
                            <div className="rm-wac-desc">
                              {selectedUids.size > 0
                                ? `Apply to ${selectedUids.size} selected site${selectedUids.size !== 1 ? 's' : ''}`
                                : 'Check boxes next to sites below, then click here'}
                            </div>
                          </div>
                          <span className="rm-wac-arrow">→</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OPTION B: MANUAL COORDINATE ENTRY */}
              {assignSource === 'manual' && (
                <div className="rm-manual-entry-box">
                  <div className="rm-manual-grid">
                    <div className="rm-manual-field">
                      <label>Starting Point Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Amanzi Warehouse"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                      />
                    </div>
                    <div className="rm-manual-field">
                      <label>Latitude * (-90 to +90)</label>
                      <input
                        type="text"
                        placeholder="e.g. -6.795598"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                      />
                    </div>
                    <div className="rm-manual-field">
                      <label>Longitude * (-180 to +180)</label>
                      <input
                        type="text"
                        placeholder="e.g. 39.216737"
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                      />
                    </div>
                    <div className="rm-manual-field">
                      <label>Description (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Main warehouse"
                        value={manualDesc}
                        onChange={(e) => setManualDesc(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {manualError && (
            <div className="rm-manual-error-alert">
              ⚠️ {manualError}
            </div>
          )}

          {/* Action buttons */}
          <div className="rm-bulk-actions-row">
            <button
              type="button"
              className="rm-btn-apply-bulk"
              disabled={selectedUids.size === 0}
              onClick={handleApplyAssignment}
            >
              Apply to {selectedUids.size} Selected Site{selectedUids.size !== 1 ? 's' : ''}
            </button>
            <button
              type="button"
              className="rm-btn-secondary-action"
              disabled={selectedUids.size === 0}
              onClick={() => {
                onClearAssignment(Array.from(selectedUids));
                setSelectedUids(new Set());
              }}
            >
              Clear Assignment
            </button>
            <button
              type="button"
              className="rm-btn-secondary-action"
              disabled={selectedUids.size === 0}
              onClick={() => {
                onExclude(Array.from(selectedUids));
                setSelectedUids(new Set());
              }}
            >
              Exclude from Calculation
            </button>
            <button
              type="button"
              className="rm-btn-secondary-action"
              disabled={selectedUids.size === 0}
              onClick={() => {
                onInclude(Array.from(selectedUids));
                setSelectedUids(new Set());
              }}
            >
              Include in Calculation
            </button>
          </div>
        </>
      )}
    </div>

        {/* ─── FILTER & TOOLBAR ─── */}
        <div className="rm-assign-toolbar">
          <div className="rm-assign-search-box">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Filter table by Site ID, Name, Region..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {regions.length > 0 && (
            <div className="rm-toolbar-filter">
              <label>Region/WHS:</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
              >
                <option value="all">All Regions ({regions.length})</option>
                {regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          <div className="rm-toolbar-filter">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All Status</option>
              <option value="unassigned">Unassigned Only ({summary.unassigned})</option>
              <option value="assigned">Assigned Only ({summary.assigned})</option>
              <option value="excluded">Excluded Only ({summary.excluded})</option>
            </select>
          </div>

          <div className="rm-toolbar-filter">
            <label>Starting Point:</label>
            <select
              value={spFilter}
              onChange={(e) => setSpFilter(e.target.value)}
            >
              <option value="all">All Starting Points</option>
              <option value="none">None (Unassigned)</option>
              {startingPoints.map((sp) => (
                <option key={sp.uid} value={sp.uid}>{sp.name}</option>
              ))}
            </select>
          </div>

          {regions.length > 0 && (
            <button
              type="button"
              className="rm-quick-assign-toggle-btn"
              onClick={() => setShowQuickAssign(!showQuickAssign)}
            >
              ⚡ Quick Assign by Region
            </button>
          )}
        </div>

        {/* ─── QUICK ASSIGN DRAWER (OPTIONAL SHORTCUT) ─── */}
        {showQuickAssign && (
          <div className="rm-quick-assign-drawer">
            <div className="rm-quick-assign-title">
              ⚡ Quick Assign Starting Points by Region/WHS
            </div>
            <div className="rm-quick-assign-grid">
              {regions.map((reg) => (
                <div key={reg} className="rm-quick-assign-item">
                  <span className="rm-qa-region-name">{reg}</span>
                  <select
                    className="rm-qa-select"
                    value={regionSpMap[reg] || ''}
                    onChange={(e) => setRegionSpMap({ ...regionSpMap, [reg]: e.target.value })}
                  >
                    <option value="">-- Choose Starting Point --</option>
                    {startingPoints.map((sp) => (
                      <option key={sp.uid} value={sp.uid}>{sp.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="rm-quick-assign-actions">
              <button
                type="button"
                className="rm-btn-qa-apply"
                onClick={handleApplyQuickAssign}
              >
                Apply Region Assignments
              </button>
              <button
                type="button"
                className="rm-btn-qa-cancel"
                onClick={() => setShowQuickAssign(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ─── SPREADSHEET-STYLE ASSIGNMENT TABLE ─── */}
        <div className="rm-assign-table-wrap">
          <table className="rm-assign-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredDests.length > 0 &&
                      filteredDests.every((d) => selectedUids.has(d.uid) || d.status === 'invalid')
                    }
                    onChange={handleSelectAllFiltered}
                    title="Select All Filtered"
                  />
                </th>
                <th>HT Site ID</th>
                <th>Legacy Site ID</th>
                <th>Site Name</th>
                <th>Region/WHS</th>
                <th>Destination Lat</th>
                <th>Destination Lon</th>
                <th>Starting Point</th>
                <th>Source</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDests.length === 0 ? (
                <tr>
                  <td colSpan={11} className="rm-table-empty-cell">
                    No destination sites match the active filters.
                  </td>
                </tr>
              ) : (
                filteredDests.map((dest) => {
                  const isSelected = selectedUids.has(dest.uid);
                  const assignedSp = dest.assignedStartingPointUid
                    ? spMap.get(dest.assignedStartingPointUid)
                    : null;

                  return (
                    <tr
                      key={dest.uid}
                      className={`${isSelected ? 'selected-row' : ''} ${dest.status === 'excluded' ? 'excluded-row' : ''}`}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={dest.status === 'invalid'}
                          onChange={() => handleToggleSelect(dest.uid)}
                        />
                      </td>
                      <td className="font-mono font-bold">{dest.siteId || '—'}</td>
                      <td className="font-mono text-muted">{dest.legacySiteId || '—'}</td>
                      <td className="font-semibold">{dest.siteName || '—'}</td>
                      <td>
                        {dest.region ? (
                          <span className="rm-region-pill">{dest.region}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="font-mono">{dest.latitude.toFixed(6)}</td>
                      <td className="font-mono">{dest.longitude.toFixed(6)}</td>
                      <td>
                        {dest.status === 'excluded' ? (
                          <span className="rm-table-dimmed">Excluded from calculation</span>
                        ) : assignedSp ? (
                          <span className="rm-table-sp-name">{assignedSp.name}</span>
                        ) : (
                          <span className="rm-table-unassigned">Not assigned</span>
                        )}
                      </td>
                      <td>
                        {assignedSp ? (
                          <span className={`rm-sp-source-badge rm-source-${assignedSp.source}`}>
                            {assignedSp.source === 'sheet' ? 'Uploaded' : assignedSp.source === 'detected' ? 'Detected' : 'Manual'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {dest.status === 'assigned' && (
                          <span className="rm-status-badge rm-status-assigned">Assigned ✓</span>
                        )}
                        {dest.status === 'unassigned' && (
                          <span className="rm-status-badge rm-status-unassigned">Unassigned !</span>
                        )}
                        {dest.status === 'excluded' && (
                          <span className="rm-status-badge rm-status-excluded">Excluded</span>
                        )}
                        {dest.status === 'invalid' && (
                          <span className="rm-status-badge rm-status-invalid" title={dest.validationError}>
                            Invalid ⚠️
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {dest.status === 'excluded' ? (
                          <button
                            type="button"
                            className="rm-row-action-btn"
                            onClick={() => onInclude([dest.uid])}
                          >
                            Include
                          </button>
                        ) : (
                          <div className="rm-row-action-group">
                            <button
                              type="button"
                              className="rm-row-action-btn rm-row-btn-start"
                              onClick={() => handleSetSiteAsStartingPoint(dest)}
                              title="Select this site as Starting Point"
                            >
                              📍 Set as Start
                            </button>
                            {dest.assignedStartingPointUid && (
                              <button
                                type="button"
                                className="rm-row-action-btn"
                                onClick={() => onClearAssignment([dest.uid])}
                                title="Clear assignment"
                              >
                                Clear
                              </button>
                            )}
                            <button
                              type="button"
                              className="rm-row-action-btn"
                              onClick={() => onExclude([dest.uid])}
                              title="Exclude from calculation"
                            >
                              Exclude
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── MODAL FOOTER ─── */}
        <div className="rm-assign-modal-footer">
          <div className="rm-footer-left-status">
            {summary.unassigned === 0 && summary.assigned > 0 ? (
              <span className="rm-footer-status-success">
                ✓ All {summary.assigned} included destination sites have starting points assigned.
              </span>
            ) : (
              <span className="rm-footer-status-pending">
                ⚠️ {summary.unassigned} site{summary.unassigned !== 1 ? 's' : ''} still need starting points.
              </span>
            )}
          </div>
          <div className="rm-footer-right-actions">
            <button type="button" className="rm-btn-done-assign" onClick={onClose}>
              Done / Return to Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
