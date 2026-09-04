import { useState, useMemo } from 'react';
import type {
  NormalizedPointRecord,
  NormalizedDistanceRecord,
  AssistantTargetMode,
  ValidationStatus,
} from '../assistant/types';
import { validateCoordinatePair } from '../assistant/deterministicValidation';
import { exportAssistantNormalizedExcel } from '../assistant/exportNormalizedExcel';

interface ReviewDataModalProps {
  isOpen: boolean;
  mode: AssistantTargetMode;
  initialPoints: NormalizedPointRecord[];
  initialSites: NormalizedDistanceRecord[];
  onClose: () => void;
  onConfirmUseInRouteMeasure: (
    mode: AssistantTargetMode,
    points: NormalizedPointRecord[],
    sites: NormalizedDistanceRecord[]
  ) => void;
}

type FilterTab = 'all' | 'valid' | 'needs_review' | 'invalid' | 'lv' | 'mv' | 'unclassified';

export function ReviewDataModal({
  isOpen,
  mode,
  initialPoints,
  initialSites,
  onClose,
  onConfirmUseInRouteMeasure,
}: ReviewDataModalProps) {
  const [points, setPoints] = useState<NormalizedPointRecord[]>(initialPoints);
  const [sites, setSites] = useState<NormalizedDistanceRecord[]>(initialSites);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const isLVMV = mode === 'lv_mv';

  // Live validation summary
  const summary = useMemo(() => {
    const items = isLVMV ? points : sites;
    const total = items.length;
    const valid = items.filter((i) => i.status === 'valid').length;
    const needsReview = items.filter((i) => i.status === 'needs_review').length;
    const invalid = items.filter((i) => i.status === 'invalid').length;

    let lv = 0;
    let mv = 0;
    let unclassified = 0;

    if (isLVMV) {
      lv = points.filter((p) => p.routeType === 'LV').length;
      mv = points.filter((p) => p.routeType === 'MV').length;
      unclassified = points.filter((p) => p.routeType === 'unclassified').length;
    }

    return { total, valid, needsReview, invalid, lv, mv, unclassified };
  }, [isLVMV, points, sites]);

  if (!isOpen) return null;

  // Filtered rows
  const filteredPoints = points.filter((p) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'valid') return p.status === 'valid';
    if (activeFilter === 'needs_review') return p.status === 'needs_review';
    if (activeFilter === 'invalid') return p.status === 'invalid';
    if (activeFilter === 'lv') return p.routeType === 'LV';
    if (activeFilter === 'mv') return p.routeType === 'MV';
    if (activeFilter === 'unclassified') return p.routeType === 'unclassified';
    return true;
  });

  const filteredSites = sites.filter((s) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'valid') return s.status === 'valid';
    if (activeFilter === 'needs_review') return s.status === 'needs_review';
    if (activeFilter === 'invalid') return s.status === 'invalid';
    return true;
  });

  // Edit Handlers for LV/MV
  const handleUpdatePoint = (
    id: string,
    field: 'pointId' | 'routeType' | 'latitude' | 'longitude' | 'description',
    value: string
  ) => {
    setPoints((prev) =>
      prev.map((pt) => {
        if (pt.id !== id) return pt;

        const updated = { ...pt };

        if (field === 'pointId') {
          updated.pointId = value.trim();
        } else if (field === 'routeType') {
          updated.routeType = value as 'LV' | 'MV' | 'unclassified';
          updated.routeId = value === 'LV' ? 'LV Route' : value === 'MV' ? 'MV Route' : 'Route 1';
        } else if (field === 'description') {
          updated.description = value;
        } else if (field === 'latitude') {
          updated.rawLatitude = value;
          const coordCheck = validateCoordinatePair(value, updated.longitude ?? updated.rawLongitude);
          updated.latitude = coordCheck.parsedLat;
          updated.validationErrors = coordCheck.errors.length > 0 ? coordCheck.errors : undefined;
        } else if (field === 'longitude') {
          updated.rawLongitude = value;
          const coordCheck = validateCoordinatePair(updated.latitude ?? updated.rawLatitude, value);
          updated.longitude = coordCheck.parsedLon;
          updated.validationErrors = coordCheck.errors.length > 0 ? coordCheck.errors : undefined;
        }

        // Re-evaluate point status
        const coordCheck = validateCoordinatePair(
          updated.latitude ?? updated.rawLatitude,
          updated.longitude ?? updated.rawLongitude
        );

        if (coordCheck.errors.length > 0) {
          updated.status = 'invalid';
          updated.validationErrors = coordCheck.errors;
        } else if (updated.routeType === 'unclassified' || coordCheck.warnings.length > 0) {
          updated.status = 'needs_review';
          updated.validationErrors = undefined;
        } else {
          updated.status = 'valid';
          updated.validationErrors = undefined;
        }

        return updated;
      })
    );
  };

  // Edit Handlers for Distance Sites
  const handleUpdateSite = (
    id: string,
    field: 'siteId' | 'siteName' | 'region' | 'latitude' | 'longitude',
    value: string
  ) => {
    setSites((prev) =>
      prev.map((st) => {
        if (st.id !== id) return st;

        const updated = { ...st };
        if (field === 'siteId') updated.siteId = value.trim();
        if (field === 'siteName') updated.siteName = value.trim();
        if (field === 'region') updated.region = value.trim();

        if (field === 'latitude') {
          updated.rawLatitude = value;
          const coordCheck = validateCoordinatePair(value, updated.longitude ?? updated.rawLongitude);
          updated.latitude = coordCheck.parsedLat;
          updated.validationErrors = coordCheck.errors.length > 0 ? coordCheck.errors : undefined;
        } else if (field === 'longitude') {
          updated.rawLongitude = value;
          const coordCheck = validateCoordinatePair(updated.latitude ?? updated.rawLatitude, value);
          updated.longitude = coordCheck.parsedLon;
          updated.validationErrors = coordCheck.errors.length > 0 ? coordCheck.errors : undefined;
        }

        const coordCheck = validateCoordinatePair(
          updated.latitude ?? updated.rawLatitude,
          updated.longitude ?? updated.rawLongitude
        );

        if (coordCheck.errors.length > 0) {
          updated.status = 'invalid';
          updated.validationErrors = coordCheck.errors;
        } else if (coordCheck.warnings.length > 0) {
          updated.status = 'needs_review';
          updated.validationErrors = undefined;
        } else {
          updated.status = 'valid';
          updated.validationErrors = undefined;
        }

        return updated;
      })
    );
  };

  const handleDownloadExcel = () => {
    exportAssistantNormalizedExcel(mode, points, sites);
  };

  const handleConfirmUse = () => {
    if (summary.invalid > 0) return;
    onConfirmUseInRouteMeasure(mode, points, sites);
  };

  return (
    <div className="rm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
      <div className="rm-review-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="rm-review-modal-header">
          <div>
            <div className="rm-review-badge">Human-in-the-Loop Review</div>
            <h2 id="review-modal-title" className="rm-review-title">
              Review Prepared Data — {isLVMV ? 'LV & MV Route' : 'Distance Between Points'}
            </h2>
            <p className="rm-review-subtitle">
              Verify coordinates, resolve uncertain voltage types, and inspect source provenance before measurement.
            </p>
          </div>
          <button className="rm-review-close-btn" onClick={onClose} aria-label="Close review dialog">
            ✕
          </button>
        </div>

        {/* Validation Summary Bar */}
        <div className="rm-review-summary-bar">
          <div className="rm-review-summary-stat">
            <span className="rm-stat-label">TOTAL RECORDS</span>
            <span className="rm-stat-val">{summary.total}</span>
          </div>
          <div className="rm-review-summary-stat text-green">
            <span className="rm-stat-label">READY</span>
            <span className="rm-stat-val">{summary.valid}</span>
          </div>
          <div className="rm-review-summary-stat text-amber">
            <span className="rm-stat-label">NEEDS REVIEW</span>
            <span className="rm-stat-val">{summary.needsReview}</span>
          </div>
          <div className="rm-review-summary-stat text-red">
            <span className="rm-stat-label">INVALID</span>
            <span className="rm-stat-val">{summary.invalid}</span>
          </div>
          {isLVMV && (
            <>
              <div className="rm-stat-divider" />
              <div className="rm-review-summary-stat">
                <span className="rm-stat-label">LV POLES</span>
                <span className="rm-stat-val">{summary.lv}</span>
              </div>
              <div className="rm-review-summary-stat">
                <span className="rm-stat-label">MV POLES</span>
                <span className="rm-stat-val">{summary.mv}</span>
              </div>
              {summary.unclassified > 0 && (
                <div className="rm-review-summary-stat text-amber">
                  <span className="rm-stat-label">UNCLASSIFIED</span>
                  <span className="rm-stat-val">{summary.unclassified}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="rm-review-filters">
          <button
            className={`rm-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({summary.total})
          </button>
          <button
            className={`rm-filter-chip ${activeFilter === 'valid' ? 'active' : ''}`}
            onClick={() => setActiveFilter('valid')}
          >
            ✓ Ready ({summary.valid})
          </button>
          {summary.needsReview > 0 && (
            <button
              className={`rm-filter-chip warning ${activeFilter === 'needs_review' ? 'active' : ''}`}
              onClick={() => setActiveFilter('needs_review')}
            >
              ⚠ Needs Review ({summary.needsReview})
            </button>
          )}
          {summary.invalid > 0 && (
            <button
              className={`rm-filter-chip danger ${activeFilter === 'invalid' ? 'active' : ''}`}
              onClick={() => setActiveFilter('invalid')}
            >
              ✕ Invalid ({summary.invalid})
            </button>
          )}
          {isLVMV && (
            <>
              <button
                className={`rm-filter-chip ${activeFilter === 'lv' ? 'active' : ''}`}
                onClick={() => setActiveFilter('lv')}
              >
                LV ({summary.lv})
              </button>
              <button
                className={`rm-filter-chip ${activeFilter === 'mv' ? 'active' : ''}`}
                onClick={() => setActiveFilter('mv')}
              >
                MV ({summary.mv})
              </button>
              {summary.unclassified > 0 && (
                <button
                  className={`rm-filter-chip warning ${activeFilter === 'unclassified' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('unclassified')}
                >
                  Unclassified ({summary.unclassified})
                </button>
              )}
            </>
          )}
        </div>

        {/* Table Body */}
        <div className="rm-review-table-container">
          <table className="rm-review-table">
            <thead>
              {isLVMV ? (
                <tr>
                  <th style={{ width: '40px' }}>STATUS</th>
                  <th style={{ width: '130px' }}>VOLTAGE</th>
                  <th style={{ width: '130px' }}>POINT ID</th>
                  <th style={{ width: '140px' }}>LATITUDE (DD)</th>
                  <th style={{ width: '140px' }}>LONGITUDE (DD)</th>
                  <th>PROVENANCE & NOTES</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: '40px' }}>STATUS</th>
                  <th style={{ width: '130px' }}>SITE ID</th>
                  <th style={{ width: '140px' }}>SITE NAME</th>
                  <th style={{ width: '120px' }}>REGION</th>
                  <th style={{ width: '140px' }}>LATITUDE (DD)</th>
                  <th style={{ width: '140px' }}>LONGITUDE (DD)</th>
                  <th>PROVENANCE & NOTES</th>
                </tr>
              )}
            </thead>
            <tbody>
              {isLVMV
                ? filteredPoints.map((pt) => {
                    const isErr = pt.status === 'invalid';
                    const isWarn = pt.status === 'needs_review';
                    return (
                      <tr key={pt.id} className={isErr ? 'row-invalid' : isWarn ? 'row-warn' : ''}>
                        <td className="text-center">
                          {pt.status === 'valid' && <span className="rm-status-badge valid" title="Valid coordinates">✓</span>}
                          {pt.status === 'needs_review' && <span className="rm-status-badge warn" title={pt.warnings.join('; ')}>⚠</span>}
                          {pt.status === 'invalid' && <span className="rm-status-badge error" title={pt.validationErrors?.join('; ')}>✕</span>}
                        </td>
                        <td>
                          <div className="rm-voltage-selector">
                            <button
                              type="button"
                              className={`rm-v-pill ${pt.routeType === 'LV' ? 'active-lv' : ''}`}
                              onClick={() => handleUpdatePoint(pt.id, 'routeType', 'LV')}
                            >
                              LV
                            </button>
                            <button
                              type="button"
                              className={`rm-v-pill ${pt.routeType === 'MV' ? 'active-mv' : ''}`}
                              onClick={() => handleUpdatePoint(pt.id, 'routeType', 'MV')}
                            >
                              MV
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rm-table-input"
                            value={pt.pointId}
                            onChange={(e) => handleUpdatePoint(pt.id, 'pointId', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`rm-table-input font-mono ${pt.validationErrors?.some((e) => e.includes('Latitude')) ? 'input-error' : ''}`}
                            value={pt.latitude ?? pt.rawLatitude ?? ''}
                            onChange={(e) => handleUpdatePoint(pt.id, 'latitude', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`rm-table-input font-mono ${pt.validationErrors?.some((e) => e.includes('Longitude')) ? 'input-error' : ''}`}
                            value={pt.longitude ?? pt.rawLongitude ?? ''}
                            onChange={(e) => handleUpdatePoint(pt.id, 'longitude', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="rm-provenance-cell">
                            <span className="rm-provenance-badge">
                              {pt.source.sheet ? `Sheet: ${pt.source.sheet}` : ''}
                              {pt.source.page ? `Page: ${pt.source.page}` : ''}
                              {pt.source.row ? `Row ${pt.source.row}` : ''}
                              {pt.source.line ? `Line ${pt.source.line}` : ''}
                              {!pt.source.row && !pt.source.page && !pt.source.line ? pt.source.type : ''}
                            </span>
                            {pt.validationErrors && (
                              <span className="rm-note-error">{pt.validationErrors.join(', ')}</span>
                            )}
                            {pt.warnings.length > 0 && !pt.validationErrors && (
                              <span className="rm-note-warn">{pt.warnings.join(', ')}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : filteredSites.map((st) => {
                    const isErr = st.status === 'invalid';
                    const isWarn = st.status === 'needs_review';
                    return (
                      <tr key={st.id} className={isErr ? 'row-invalid' : isWarn ? 'row-warn' : ''}>
                        <td className="text-center">
                          {st.status === 'valid' && <span className="rm-status-badge valid" title="Valid coordinates">✓</span>}
                          {st.status === 'needs_review' && <span className="rm-status-badge warn" title={st.warnings.join('; ')}>⚠</span>}
                          {st.status === 'invalid' && <span className="rm-status-badge error" title={st.validationErrors?.join('; ')}>✕</span>}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rm-table-input"
                            value={st.siteId}
                            onChange={(e) => handleUpdateSite(st.id, 'siteId', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rm-table-input"
                            value={st.siteName}
                            onChange={(e) => handleUpdateSite(st.id, 'siteName', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rm-table-input"
                            value={st.region || ''}
                            onChange={(e) => handleUpdateSite(st.id, 'region', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`rm-table-input font-mono ${st.validationErrors?.some((e) => e.includes('Latitude')) ? 'input-error' : ''}`}
                            value={st.latitude ?? st.rawLatitude ?? ''}
                            onChange={(e) => handleUpdateSite(st.id, 'latitude', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`rm-table-input font-mono ${st.validationErrors?.some((e) => e.includes('Longitude')) ? 'input-error' : ''}`}
                            value={st.longitude ?? st.rawLongitude ?? ''}
                            onChange={(e) => handleUpdateSite(st.id, 'longitude', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="rm-provenance-cell">
                            <span className="rm-provenance-badge">
                              {st.source.sheet ? `Sheet: ${st.source.sheet}` : ''}
                              {st.source.page ? `Page: ${st.source.page}` : ''}
                              {st.source.row ? `Row ${st.source.row}` : ''}
                              {st.source.line ? `Line ${st.source.line}` : ''}
                              {!st.source.row && !st.source.page && !st.source.line ? st.source.type : ''}
                            </span>
                            {st.validationErrors && (
                              <span className="rm-note-error">{st.validationErrors.join(', ')}</span>
                            )}
                            {st.warnings.length > 0 && !st.validationErrors && (
                              <span className="rm-note-warn">{st.warnings.join(', ')}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="rm-review-modal-footer">
          <div className="rm-footer-left">
            <button type="button" className="rm-btn-excel-export" onClick={handleDownloadExcel}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 10V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M4.66669 6.66663L8.00002 9.99996L11.3334 6.66663" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 10V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Download Clean Excel
            </button>
          </div>
          <div className="rm-footer-right">
            <button type="button" className="rm-btn-cancel-plain" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="rm-btn-confirm-use"
              disabled={summary.invalid > 0}
              onClick={handleConfirmUse}
              title={summary.invalid > 0 ? 'Correct all invalid coordinates before continuing' : 'Send validated data to RouteMeasure'}
            >
              Use in RouteMeasure →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
