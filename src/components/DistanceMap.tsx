/**
 * Distance Map component.
 *
 * Visualizes starting points, destination sites, and independent connection
 * lines on a Google Maps satellite view. Does NOT connect destinations to
 * each other — each line is an independent starting-point → destination
 * geodesic measurement.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import type { DistanceAnalysisResult, DestinationSite, StartingPoint, DistanceResult } from '../types/distance';
import { GoogleMapsAdapter } from '../mapping/GoogleMapsAdapter';
import type { MapType } from '../types/map';
import { formatNumber } from '../utils/formatters';

/** Deterministic color palette for starting points */
const SP_COLORS = [
  '#2F6BFF', // Blue
  '#F4B942', // Amber
  '#34D399', // Teal
  '#F87171', // Coral
  '#A78BFA', // Violet
  '#94A3B8', // Slate
  '#FB923C', // Orange
  '#38BDF8', // Sky
];

interface DistanceMapProps {
  analysisResult: DistanceAnalysisResult;
  startingPointFilter: string;
  selectedSiteUid: string | null;
  onSiteSelect: (destUid: string) => void;
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

export function DistanceMap({
  analysisResult,
  startingPointFilter,
  selectedSiteUid,
  onSiteSelect,
  apiKey,
  onApiKeyChange,
}: DistanceMapProps) {
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<GoogleMapsAdapter | null>(null);

  const [mapState, setMapState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentMapType, setCurrentMapType] = useState<MapType>('satellite');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [inputKeyVal, setInputKeyVal] = useState(apiKey || '');
  const [showLegend, setShowLegend] = useState(true);

  const { destinations, startingPoints, results } = analysisResult;

  // SP color mapping
  const spColorMap = useMemo(() => {
    const m = new Map<string, string>();
    startingPoints.forEach((sp, idx) => {
      m.set(sp.uid, SP_COLORS[idx % SP_COLORS.length]);
    });
    return m;
  }, [startingPoints]);

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

  // Filter results by starting point
  const visibleResults = useMemo(() => {
    if (startingPointFilter === 'all') return results;
    return results.filter((r) => r.startingPointUid === startingPointFilter);
  }, [results, startingPointFilter]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    const adapter = new GoogleMapsAdapter();
    adapterRef.current = adapter;

    setMapState('loading');

    adapter
      .initialize(containerRef.current, apiKey)
      .then(() => {
        if (!isMounted) return;
        setMapState('loaded');
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Google Maps initialization failed:', err);
        setMapState('error');
        setErrorMessage('Satellite map is temporarily unavailable.');
      });

    return () => {
      isMounted = false;
      adapter.destroy();
    };
  }, [apiKey]);

  // Render distance visualization
  useEffect(() => {
    if (!adapterRef.current?.isLoaded() || mapState !== 'loaded') return;

    const map = adapterRef.current.getMap();
    if (!map) return;

    // Clear any existing route overlays
    adapterRef.current.clear();

    // Clear our custom markers and lines
    if ((map as any).__distanceMarkers) {
      (map as any).__distanceMarkers.forEach((m: any) => m.setMap(null));
    }
    if ((map as any).__distanceLines) {
      (map as any).__distanceLines.forEach((l: any) => l.setMap(null));
    }

    const gMaps = window.google?.maps;
    if (!gMaps) return;

    const markers: any[] = [];
    const lines: any[] = [];
    const bounds = new gMaps.LatLngBounds();

    // Visible starting points
    const visibleSPUids = new Set(visibleResults.map((r) => r.startingPointUid));

    // Draw starting point markers
    for (const sp of startingPoints) {
      if (!visibleSPUids.has(sp.uid)) continue;

      const color = spColorMap.get(sp.uid) || SP_COLORS[0];
      const pos = { lat: sp.latitude, lng: sp.longitude };
      bounds.extend(pos);

      const marker = new gMaps.Marker({
        position: pos,
        map,
        title: sp.name,
        icon: {
          path: gMaps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
        },
        zIndex: 100,
      });

      markers.push(marker);
    }

    // Draw destination markers and connection lines
    for (const r of visibleResults) {
      const dest = destMap.get(r.destinationUid);
      const sp = spMap.get(r.startingPointUid);
      if (!dest || !sp) continue;

      const color = spColorMap.get(sp.uid) || SP_COLORS[0];
      const isSelected = selectedSiteUid === dest.uid;
      const destPos = { lat: dest.latitude, lng: dest.longitude };
      const spPos = { lat: sp.latitude, lng: sp.longitude };
      bounds.extend(destPos);

      // Destination marker (smaller)
      const marker = new gMaps.Marker({
        position: destPos,
        map,
        title: dest.siteName || dest.siteId || `Site Row ${dest.sourceRow}`,
        icon: {
          path: gMaps.SymbolPath.CIRCLE,
          scale: isSelected ? 8 : 5,
          fillColor: isSelected ? '#ffffff' : color,
          fillOpacity: isSelected ? 1 : 0.8,
          strokeColor: color,
          strokeWeight: isSelected ? 3 : 1.5,
        },
        zIndex: isSelected ? 90 : 50,
      });

      marker.addListener('click', () => {
        onSiteSelect(dest.uid);
      });

      markers.push(marker);

      // Independent connection line (NOT chained)
      const line = new gMaps.Polyline({
        path: [spPos, destPos],
        map,
        strokeColor: color,
        strokeOpacity: isSelected ? 0.9 : 0.25,
        strokeWeight: isSelected ? 3 : 1.5,
        geodesic: true,
        zIndex: isSelected ? 80 : 10,
      });

      line.addListener('click', () => {
        onSiteSelect(dest.uid);
      });

      lines.push(line);
    }

    // Store for cleanup
    (map as any).__distanceMarkers = markers;
    (map as any).__distanceLines = lines;

    // Fit bounds
    if (visibleResults.length > 0) {
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
    }
  }, [visibleResults, selectedSiteUid, mapState, startingPoints, destMap, spMap, spColorMap, onSiteSelect]);

  // Fullscreen handling
  useEffect(() => {
    const handleFS = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => adapterRef.current?.triggerResize(), 200);
    };
    document.addEventListener('fullscreenchange', handleFS);
    return () => document.removeEventListener('fullscreenchange', handleFS);
  }, []);

  // Resize observer
  useEffect(() => {
    if (!mapWrapperRef.current) return;
    const obs = new ResizeObserver(() => adapterRef.current?.triggerResize());
    obs.observe(mapWrapperRef.current);
    return () => obs.disconnect();
  }, []);

  const toggleMapType = (type: MapType) => {
    setCurrentMapType(type);
    adapterRef.current?.setMapType(type);
  };

  const handleFitAll = () => {
    if (!adapterRef.current?.isLoaded()) return;
    const map = adapterRef.current.getMap();
    if (!map || !window.google?.maps) return;

    const bounds = new window.google.maps.LatLngBounds();
    for (const r of visibleResults) {
      const dest = destMap.get(r.destinationUid);
      const sp = spMap.get(r.startingPointUid);
      if (dest) bounds.extend({ lat: dest.latitude, lng: dest.longitude });
      if (sp) bounds.extend({ lat: sp.latitude, lng: sp.longitude });
    }
    map.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
  };

  const toggleFullscreen = () => {
    if (!mapWrapperRef.current) return;
    if (!document.fullscreenElement) {
      mapWrapperRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSaveApiKey = () => {
    if (onApiKeyChange) onApiKeyChange(inputKeyVal.trim());
    setShowKeyInput(false);
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#2563eb' : 'transparent',
    color: 'white',
    border: 'none',
    padding: '4px 11px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 36,
  });

  // Selected site info panel
  const selectedResult = selectedSiteUid
    ? visibleResults.find((r) => r.destinationUid === selectedSiteUid)
    : null;
  const selectedDest = selectedSiteUid ? destMap.get(selectedSiteUid) : null;
  const selectedSP = selectedResult ? spMap.get(selectedResult.startingPointUid) : null;

  return (
    <div
      ref={mapWrapperRef}
      className="map-container rm-map-container"
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '100%',
        minHeight: isFullscreen ? '100vh' : '400px',
        borderRadius: isFullscreen ? '0px' : '14px',
        overflow: 'hidden',
        background: '#0a1428',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* ─── TOP RIGHT CONTROLS ─── */}
      {mapState === 'loaded' && (
        <div className="rm-map-controls-bar">
          <button style={filterBtnStyle(currentMapType === 'satellite')} onClick={() => toggleMapType('satellite')}>
            Satellite
          </button>
          <button style={filterBtnStyle(currentMapType === 'hybrid')} onClick={() => toggleMapType('hybrid')}>
            Hybrid
          </button>
          <button style={filterBtnStyle(currentMapType === 'roadmap')} onClick={() => toggleMapType('roadmap')}>
            Map
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
          <button
            style={{ ...filterBtnStyle(false), display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={handleFitAll}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 2V5M8 11V14M2 8H5M11 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Fit All
          </button>
          <button
            style={{ ...filterBtnStyle(false), color: 'rgba(255,255,255,0.7)' }}
            title="Configure Google Maps API Key"
            onClick={() => setShowKeyInput(!showKeyInput)}
          >
            🔑 Key
          </button>
        </div>
      )}

      {/* ─── LEGEND ─── */}
      {mapState === 'loaded' && startingPoints.length > 1 && showLegend && (
        <div className="rm-dist-map-legend">
          <div className="rm-dist-legend-title">
            Starting Points
            <button className="rm-dist-legend-close" onClick={() => setShowLegend(false)}>×</button>
          </div>
          {startingPoints.map((sp) => {
            const color = spColorMap.get(sp.uid) || SP_COLORS[0];
            const count = results.filter((r) => r.startingPointUid === sp.uid).length;
            return (
              <div key={sp.uid} className="rm-dist-legend-item">
                <span className="rm-dist-legend-dot" style={{ background: color }} />
                <span className="rm-dist-legend-name">{sp.name}</span>
                <span className="rm-dist-legend-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── SELECTED SITE INFO ─── */}
      {selectedDest && selectedResult && selectedSP && (
        <div className="rm-dist-map-info-panel">
          <div className="rm-dist-info-title">
            {selectedDest.siteName || selectedDest.siteId || `Site Row ${selectedDest.sourceRow}`}
          </div>
          {selectedDest.siteId && (
            <div className="rm-dist-info-row">
              <span className="rm-dist-info-label">Site ID</span>
              <span className="rm-dist-info-value">{selectedDest.siteId}</span>
            </div>
          )}
          <div className="rm-dist-info-row">
            <span className="rm-dist-info-label">Starting Point</span>
            <span className="rm-dist-info-value">{selectedSP.name}</span>
          </div>
          <div className="rm-dist-info-row rm-dist-info-highlight">
            <span className="rm-dist-info-label">Distance</span>
            <span className="rm-dist-info-value">
              {formatNumber(selectedResult.distanceKm, 1)} km
            </span>
          </div>
          <div className="rm-dist-info-row">
            <span className="rm-dist-info-label">Bearing</span>
            <span className="rm-dist-info-value">{selectedResult.bearing.toFixed(2)}°</span>
          </div>
          <div className="rm-dist-info-row">
            <span className="rm-dist-info-label">Coordinates</span>
            <span className="rm-dist-info-value">
              {selectedDest.latitude.toFixed(5)}, {selectedDest.longitude.toFixed(5)}
            </span>
          </div>
        </div>
      )}

      {/* ─── FULLSCREEN BUTTON ─── */}
      <div className="rm-map-bottom-left">
        <button onClick={toggleFullscreen} className="rm-map-fullscreen-btn">
          {isFullscreen ? (
            <>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M4 1v3H1M10 1v3h3M4 13v-3H1M10 13v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Exit Fullscreen
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M1 4V1h3M13 4V1h-3M1 10v3h3M13 10v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Full Screen
            </>
          )}
        </button>
      </div>

      {/* ─── API KEY INPUT ─── */}
      {showKeyInput && (
        <div style={{
          position: 'absolute', top: 52, right: 14, zIndex: 20,
          background: '#0f172a', color: 'white', padding: 16,
          borderRadius: 10, width: 320, maxWidth: 'calc(100% - 28px)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid #334155',
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Google Maps API Key</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.4 }}>
            Enter your Google Cloud Maps API key.
          </div>
          <input
            type="text"
            placeholder="AIzaSy..."
            value={inputKeyVal}
            onChange={(e) => setInputKeyVal(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 6,
              border: '1px solid #475569', background: '#1e293b',
              color: 'white', fontSize: 12, marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-ghost" style={{ color: '#cbd5e1' }} onClick={() => setShowKeyInput(false)}>
              Cancel
            </button>
            <button className="btn btn-sm btn-accent" onClick={handleSaveApiKey}>
              Save & Reload
            </button>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading */}
      {mapState === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#0a1428',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, zIndex: 5,
        }}>
          <div className="spinner" style={{ width: 36, height: 36, borderColor: '#334155', borderTopColor: '#38bdf8' }} />
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Loading Satellite Imagery...</div>
        </div>
      )}

      {/* Error fallback */}
      {mapState === 'error' && (
        <div className="map-fallback" style={{
          position: 'absolute', inset: 0, background: '#0f172a',
          color: 'white', zIndex: 5, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <div style={{ fontSize: 32 }}>🛰️</div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: 15 }}>Satellite Map Visualization</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 360, lineHeight: 1.5 }}>
            {errorMessage}
          </div>
        </div>
      )}
    </div>
  );
}
