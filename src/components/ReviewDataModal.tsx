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
  const [quickFixNotice, setQuickFixNotice] = useState<string | null>(null);

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

  // Dataset coordinate medians for intelligent swap detection
  const datasetMedians = useMemo(() => {
    const validLats: number[] = [];
    const validLons: number[] = [];
    const items = isLVMV ? points : sites;
    for (const item of items) {
      const lat = typeof item.latitude === 'number' ? item.latitude : Number(item.rawLatitude);
      const lon = typeof item.longitude === 'number' ? item.longitude : Number(item.rawLongitude);
      if (Number.isFinite(lat)) validLats.push(lat);
      if (Number.isFinite(lon)) validLons.push(lon);
    }
    if (validLats.length < 2 || validLons.length < 2) return null;
    validLats.sort((a, b) => a - b);
    validLons.sort((a, b) => a - b);
    return {
      medianLat: validLats[Math.floor(validLats.length / 2)],
      medianLon: validLons[Math.floor(validLons.length / 2)],
    };
  }, [isLVMV, points, sites]);

  // Check if a coordinate pair appears to be reversed/swapped
  const checkIsSwapped = (
    lat: number | null | undefined,
    lon: number | null | undefined,
    rawLat?: unknown,
    rawLon?: unknown,
    warnings?: string[]
  ) => {
    const latVal = lat ?? Number(rawLat);
    const lonVal = lon ?? Number(rawLon);

    // Warning explicitly mentions swap/order
    if (warnings?.some((w) => /swap|reversed|latitude.*range.*longitude|order/i.test(w))) {
      return true;
    }

    // Latitude outside [-90, 90] but fits in longitude range
    if (Number.isFinite(latVal) && (latVal < -90 || latVal > 90) && Number.isFinite(lonVal) && lonVal >= -90 && lonVal <= 90) {
      return true;
    }

    // Heuristic: compare with dataset median cluster
    if (datasetMedians && Number.isFinite(latVal) && Number.isFinite(lonVal)) {
      const { medianLat, medianLon } = datasetMedians;
      const latDiffNormal = Math.abs(latVal - medianLat);
      const latDiffSwapped = Math.abs(latVal - medianLon);
      const lonDiffNormal = Math.abs(lonVal - medianLon);
      const lonDiffSwapped = Math.abs(lonVal - medianLat);

      if (latDiffSwapped < 8 && lonDiffSwapped < 8 && latDiffNormal > 10 && lonDiffNormal > 10) {
        return true;
      }
    }

    return false;
  };

  // Detect swappable records
  const swappableItems = useMemo(() => {
    if (isLVMV) {
      return points.filter((p) => checkIsSwapped(p.latitude, p.longitude, p.rawLatitude, p.rawLongitude, p.warnings));
    } else {
      return sites.filter((s) => checkIsSwapped(s.latitude, s.longitude, s.rawLatitude, s.rawLongitude, s.warnings));
    }
  }, [isLVMV, points, sites, datasetMedians]);

  if (!isOpen) return null;

  // Swap coordinates on a single LV/MV point
  const handleSwapPointCoordinates = (id: string) => {
    setPoints((prev) =>
      prev.map((pt) => {
        if (pt.id !== id) return pt;

        const newLat = pt.longitude ?? pt.rawLongitude;
        const newLon = pt.latitude ?? pt.rawLatitude;
        const coordCheck = validateCoordinatePair(newLat, newLon);

        // Remove swap-related warnings since user resolved it
        const filteredWarnings = (pt.warnings || []).filter(
          (w) => !/swap|reversed|latitude.*range.*longitude|order/i.test(w)
        );
        const warnings = [...filteredWarnings, ...coordCheck.warnings];
        const errors = coordCheck.errors;

        let status: ValidationStatus = 'valid';
        if (errors.length > 0) status = 'invalid';
        else if (warnings.length > 0 || pt.routeType === 'unclassified') status = 'needs_review';

        return {
          ...pt,
          latitude: coordCheck.parsedLat,
          longitude: coordCheck.parsedLon,
          rawLatitude: String(newLat ?? ''),
          rawLongitude: String(newLon ?? ''),
          warnings,
          validationErrors: errors.length > 0 ? errors : undefined,
          status,
        };
      })
    );
    setQuickFixNotice('Swapped coordinates successfully.');
    setTimeout(() => setQuickFixNotice(null), 3000);
  };

  // Swap coordinates on a single distance site
  const handleSwapSiteCoordinates = (id: string) => {
    setSites((prev) =>
      prev.map((st) => {
        if (st.id !== id) return st;

        const newLat = st.longitude ?? st.rawLongitude;
        const newLon = st.latitude ?? st.rawLatitude;
        const coordCheck = validateCoordinatePair(newLat, newLon);

        const filteredWarnings = (st.warnings || []).filter(
          (w) => !/swap|reversed|latitude.*range.*longitude|order/i.test(w)
        );
        const warnings = [...filteredWarnings, ...coordCheck.warnings];
        const errors = coordCheck.errors;

        let status: ValidationStatus = 'valid';
        if (errors.length > 0) status = 'invalid';
        else if (warnings.length > 0) status = 'needs_review';

        return {
          ...st,
          latitude: coordCheck.parsedLat,
          longitude: coordCheck.parsedLon,
          rawLatitude: String(newLat ?? ''),
          rawLongitude: String(newLon ?? ''),
          warnings,
          validationErrors: errors.length > 0 ? errors : undefined,
          status,
        };
      })
    );
    setQuickFixNotice('Swapped coordinates successfully.');
    setTimeout(() => setQuickFixNotice(null), 3000);
  };

  // Quick Fix: Swap ALL inverted coordinates at once
  const handleQuickFixAllSwaps = () => {
    if (isLVMV) {
      setPoints((prev) =>
        prev.map((pt) => {
          if (!checkIsSwapped(pt.latitude, pt.longitude, pt.rawLatitude, pt.rawLongitude, pt.warnings)) {
            return pt;
          }
          const newLat = pt.longitude ?? pt.rawLongitude;
          const newLon = pt.latitude ?? pt.rawLatitude;
          const coordCheck = validateCoordinatePair(newLat, newLon);
          const filteredWarnings = (pt.warnings || []).filter(
            (w) => !/swap|reversed|latitude.*range.*longitude|order/i.test(w)
          );
          const warnings = [...filteredWarnings, ...coordCheck.warnings];
          const errors = coordCheck.errors;

          let status: ValidationStatus = 'valid';
          if (errors.length > 0) status = 'invalid';
          else if (warnings.length > 0 || pt.routeType === 'unclassified') status = 'needs_review';

          return {
            ...pt,
            latitude: coordCheck.parsedLat,
            longitude: coordCheck.parsedLon,
            rawLatitude: String(newLat ?? ''),
            rawLongitude: String(newLon ?? ''),
            warnings,
            validationErrors: errors.length > 0 ? errors : undefined,
            status,
          };
        })
      );
    } else {
      setSites((prev) =>
        prev.map((st) => {
          if (!checkIsSwapped(st.latitude, st.longitude, st.rawLatitude, st.rawLongitude, st.warnings)) {
            return st;
          }
          const newLat = st.longitude ?? st.rawLongitude;
          const newLon = st.latitude ?? st.rawLatitude;
          const coordCheck = validateCoordinatePair(newLat, newLon);
          const filteredWarnings = (st.warnings || []).filter(
            (w) => !/swap|reversed|latitude.*range.*longitude|order/i.test(w)
          );
          const warnings = [...filteredWarnings, ...coordCheck.warnings];
          const errors = coordCheck.errors;

          let status: ValidationStatus = 'valid';
          if (errors.length > 0) status = 'invalid';
          else if (warnings.length > 0) status = 'needs_review';

          return {
            ...st,
            latitude: coordCheck.parsedLat,
            longitude: coordCheck.parsedLon,
            rawLatitude: String(newLat ?? ''),
            rawLongitude: String(newLon ?? ''),
            warnings,
            validationErrors: errors.length > 0 ? errors : undefined,
            status,
          };
        })
      );
    }
    setQuickFixNotice(`Fixed coordinates for ${swappableItems.length} record(s).`);
    setTimeout(() => setQuickFixNotice(null), 3500);
  };

  // Quick Fix: Batch classify all unclassified as LV or MV
  const handleBatchClassify = (targetVoltage: 'LV' | 'MV') => {
    setPoints((prev) =>
      prev.map((pt) => {
        if (pt.routeType !== 'unclassified') return pt;
        const coordCheck = validateCoordinatePair(
          pt.latitude ?? pt.rawLatitude,
          pt.longitude ?? pt.rawLongitude
        );
        const filteredWarnings = (pt.warnings || []).filter(
          (w) => !/unclassified|voltage.*classification/i.test(w)
        );
        const warnings = [...filteredWarnings, ...coordCheck.warnings];
        let status: ValidationStatus = 'valid';
        if (coordCheck.errors.length > 0) status = 'invalid';
        else if (warnings.length > 0) status = 'needs_review';

        return {
          ...pt,
          routeType: targetVoltage,
          routeId: targetVoltage === 'LV' ? 'LV Route' : 'MV Route',
          warnings,
          status,
        };
      })
    );
    setQuickFixNotice(`Classified all unconfirmed points as ${targetVoltage}.`);
    setTimeout(() => setQuickFixNotice(null), 3500);
  };

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

  const hasQuickFixes = swappableItems.length > 0 || (isLVMV && summary.unclassified > 0);

  return (
    <div
      className="rm-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
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
                <span className="rm-stat-val text-amber">{summary.lv}</span>
              </div>
              <div className="rm-review-summary-stat">
                <span className="rm-stat-label">MV POLES</span>
                <span className="rm-stat-val text-blue">{summary.mv}</span>
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

        {/* Quick Fix Toast / Banner */}
        {hasQuickFixes && (
          <div className="rm-quick-fix-banner">
            <div className="rm-qf-left">
              <span className="rm-qf-badge">⚡ Quick Fix</span>
              <span className="rm-qf-text">
                {swappableItems.length > 0 && (
                  <span>
                    <strong>{swappableItems.length} point{swappableItems.length > 1 ? 's' : ''}</strong> ({swappableItems.map((i) => ('pointId' in i ? i.pointId : i.siteId)).slice(0, 3).join(', ')}{swappableItems.length > 3 ? '...' : ''}) appears to have Latitude and Longitude inverted.
                  </span>
                )}
                {swappableItems.length > 0 && isLVMV && summary.unclassified > 0 && <span> • </span>}
                {isLVMV && summary.unclassified > 0 && (
                  <span>
                    <strong>{summary.unclassified}</strong> point{summary.unclassified > 1 ? 's need' : ' needs'} voltage classification.
                  </span>
                )}
              </span>
            </div>

            <div className="rm-qf-actions">
              {swappableItems.length > 0 && (
                <button
                  type="button"
                  className="rm-btn-qf-primary"
                  onClick={handleQuickFixAllSwaps}
                  title="Swap Latitude and Longitude for all affected points"
                >
                  ⇄ Swap Coordinates ({swappableItems.length})
                </button>
              )}
              {isLVMV && summary.unclassified > 0 && (
                <>
                  <button
                    type="button"
                    className="rm-btn-qf-secondary"
                    onClick={() => handleBatchClassify('LV')}
                    title="Set all unconfirmed points as Low Voltage (LV)"
                  >
                    Set All to LV ({summary.unclassified})
                  </button>
                  <button
                    type="button"
                    className="rm-btn-qf-secondary"
                    onClick={() => handleBatchClassify('MV')}
                    title="Set all unconfirmed points as Medium Voltage (MV)"
                  >
                    Set All to MV ({summary.unclassified})
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Quick Fix Feedback Notice */}
        {quickFixNotice && (
          <div className="rm-qf-toast">
            ✓ {quickFixNotice}
          </div>
        )}

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
                  <th style={{ width: '45px', textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: '130px' }}>VOLTAGE</th>
                  <th style={{ width: '140px' }}>POINT ID</th>
                  <th style={{ width: '150px' }}>LATITUDE (DD)</th>
                  <th style={{ width: '38px', textAlign: 'center' }}>SWAP</th>
                  <th style={{ width: '150px' }}>LONGITUDE (DD)</th>
                  <th>PROVENANCE & NOTES</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: '130px' }}>SITE ID</th>
                  <th style={{ width: '140px' }}>SITE NAME</th>
                  <th style={{ width: '120px' }}>REGION</th>
                  <th style={{ width: '150px' }}>LATITUDE (DD)</th>
                  <th style={{ width: '38px', textAlign: 'center' }}>SWAP</th>
                  <th style={{ width: '150px' }}>LONGITUDE (DD)</th>
                  <th>PROVENANCE & NOTES</th>
                </tr>
              )}
            </thead>
            <tbody>
              {isLVMV
                ? filteredPoints.map((pt) => {
                    const isErr = pt.status === 'invalid';
                    const isWarn = pt.status === 'needs_review';
                    const isSwapped = checkIsSwapped(
                      pt.latitude,
                      pt.longitude,
                      pt.rawLatitude,
                      pt.rawLongitude,
                      pt.warnings
                    );

                    return (
                      <tr key={pt.id} className={isErr ? 'row-invalid' : isWarn ? 'row-warn' : ''}>
                        <td className="text-center">
                          {pt.status === 'valid' && (
                            <span className="rm-status-badge valid" title="Valid coordinates">
                              ✓
                            </span>
                          )}
                          {pt.status === 'needs_review' && (
                            <span className="rm-status-badge warn" title={pt.warnings.join('; ')}>
                              ⚠
                            </span>
                          )}
                          {pt.status === 'invalid' && (
                            <span className="rm-status-badge error" title={pt.validationErrors?.join('; ')}>
                              ✕
                            </span>
                          )}
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
                            className={`rm-table-input font-mono ${
                              pt.validationErrors?.some((e) => e.includes('Latitude')) ? 'input-error' : ''
                            } ${isSwapped ? 'input-warn' : ''}`}
                            value={pt.latitude ?? pt.rawLatitude ?? ''}
                            onChange={(e) => handleUpdatePoint(pt.id, 'latitude', e.target.value)}
                          />
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className={`rm-btn-swap-coords ${isSwapped ? 'swap-suggested' : ''}`}
                            onClick={() => handleSwapPointCoordinates(pt.id)}
                            title={isSwapped ? '⚡ Inverted coordinates detected! Click to swap' : 'Swap Latitude & Longitude'}
                          >
                            ⇄
                          </button>
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`rm-table-input font-mono ${
                              pt.validationErrors?.some((e) => e.includes('Longitude')) ? 'input-error' : ''
                            } ${isSwapped ? 'input-warn' : ''}`}
                            value={pt.longitude ?? pt.rawLongitude ?? ''}
                            onChange={(e) => handleUpdatePoint(pt.id, 'longitude', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="rm-provenance-cell">
                            <div className="rm-provenance-top-row">
                              <span className="rm-provenance-badge">
                                {pt.source.sheet ? `Sheet: ${pt.source.sheet} ` : ''}
                                {pt.source.page ? `Page: ${pt.source.page} ` : ''}
                                {pt.source.row ? `Row ${pt.source.row} ` : ''}
                                {pt.source.line ? `Line ${pt.source.line} ` : ''}
                                {!pt.source.row && !pt.source.page && !pt.source.line ? pt.source.type : ''}
                              </span>
                              {isSwapped && (
                                <button
                                  type="button"
                                  className="rm-row-quickfix-btn"
                                  onClick={() => handleSwapPointCoordinates(pt.id)}
                                >
                                  ⚡ Quick Fix: Swap Lat/Lon
                                </button>
                              )}
                            </div>
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
                    const isSwapped = checkIsSwapped(
                      st.latitude,
                      st.longitude,
                      st.rawLatitude,
                      st.rawLongitude,
                      st.warnings
                    );

                    return (
                      <tr key={st.id} className={isErr ? 'row-invalid' : isWarn ? 'row-warn' : ''}>
                        <td className="text-center">
                          {st.status === 'valid' && (
                            <span className="rm-status-badge valid" title="Valid coordinates">
                              ✓
                            </span>
                          )}
                          {st.status === 'needs_review' && (
                            <span className="rm-status-badge warn" title={st.warnings.join('; ')}>
                              ⚠
                            </span>
                          )}
                          {st.status === 'invalid' && (
                            <span className="rm-status-badge error" title={st.validationErrors?.join('; ')}>
                              ✕
                            </span>
                          )}
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
                            className={`rm-table-input font-mono ${
                              st.validationErrors?.some((e) => e.includes('Latitude')) ? 'input-error' : ''
                            } ${isSwapped ? 'input-warn' : ''}`}
                            value={st.latitude ?? st.rawLatitude ?? ''}
                            onChange={(e) => handleUpdateSite(st.id, 'latitude', e.target.value)}
                          />
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className={`rm-btn-swap-coords ${isSwapped ? 'swap-suggested' : ''}`}
                            onClick={() => handleSwapSiteCoordinates(st.id)}
                            title={isSwapped ? '⚡ Inverted coordinates detected! Click to swap' : 'Swap Latitude & Longitude'}
                          >
                            ⇄
                          </button>
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`rm-table-input font-mono ${
                              st.validationErrors?.some((e) => e.includes('Longitude')) ? 'input-error' : ''
                            } ${isSwapped ? 'input-warn' : ''}`}
                            value={st.longitude ?? st.rawLongitude ?? ''}
                            onChange={(e) => handleUpdateSite(st.id, 'longitude', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="rm-provenance-cell">
                            <div className="rm-provenance-top-row">
                              <span className="rm-provenance-badge">
                                {st.source.sheet ? `Sheet: ${st.source.sheet} ` : ''}
                                {st.source.page ? `Page: ${st.source.page} ` : ''}
                                {st.source.row ? `Row ${st.source.row} ` : ''}
                                {st.source.line ? `Line ${st.source.line} ` : ''}
                                {!st.source.row && !st.source.page && !st.source.line ? st.source.type : ''}
                              </span>
                              {isSwapped && (
                                <button
                                  type="button"
                                  className="rm-row-quickfix-btn"
                                  onClick={() => handleSwapSiteCoordinates(st.id)}
                                >
                                  ⚡ Quick Fix: Swap Lat/Lon
                                </button>
                              )}
                            </div>
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
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path
                  d="M14 10V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M4.66669 6.66663L8.00002 9.99996L11.3334 6.66663"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M8 10V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
              title={
                summary.invalid > 0
                  ? 'Correct all invalid coordinates before continuing'
                  : 'Confirm changes and pass validated data to RouteMeasure'
              }
            >
              ✓ Confirm Changes & Use in RouteMeasure →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
