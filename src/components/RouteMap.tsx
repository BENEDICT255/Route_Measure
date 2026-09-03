import { useEffect, useRef, useState, useMemo } from 'react';
import type { MeasuredRoute, RoutePoint } from '../types/coordinates';
import { GoogleMapsAdapter, classifyRoute, ROUTE_COLORS } from '../mapping/GoogleMapsAdapter';
import type { RouteRenderOptions } from '../mapping/GoogleMapsAdapter';
import type { MapType } from '../types/map';
import { Geodesic } from 'geographiclib-geodesic';
import { formatDistanceMetres, formatDistanceKilometres } from '../utils/formatters';

interface RouteMapProps {
  route: MeasuredRoute | null;
  allRoutes?: MeasuredRoute[];
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  onPointSelect?: (point: RoutePoint) => void;
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

export function RouteMap({
  route,
  allRoutes,
  selectedFilter,
  onFilterChange,
  onPointSelect,
  apiKey,
  onApiKeyChange,
}: RouteMapProps) {
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<GoogleMapsAdapter | null>(null);

  const [mapState, setMapState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentMapType, setCurrentMapType] = useState<MapType>('satellite');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [inputKeyVal, setInputKeyVal] = useState<string>(apiKey || '');

  // Master list of all routes available
  const availableRoutes = useMemo(() => {
    return allRoutes && allRoutes.length > 0 ? allRoutes : route ? [route] : [];
  }, [allRoutes, route]);

  // Determine which routes are active/visible based on selectedFilter
  const visibleRoutes = useMemo(() => {
    if (availableRoutes.length === 0) return [];
    if (selectedFilter === 'all') return availableRoutes;

    const matched = availableRoutes.filter(
      (r) =>
        r.uid === selectedFilter ||
        classifyRoute(r.name) === selectedFilter.toLowerCase() ||
        r.name.toLowerCase() === selectedFilter.toLowerCase()
    );

    return matched.length > 0 ? matched : availableRoutes;
  }, [availableRoutes, selectedFilter]);

  // Classify routes for UI buttons and legends
  const routeClassifications = useMemo(() => {
    return availableRoutes.map((r) => ({
      route: r,
      classification: classifyRoute(r.name),
    }));
  }, [availableRoutes]);

  const hasMV = routeClassifications.some((r) => r.classification === 'mv');
  const hasLV = routeClassifications.some((r) => r.classification === 'lv');
  const hasBothTypes = hasMV && hasLV;

  // Dynamic Route Overview statistics for active/visible routes
  const routeStats = useMemo(() => {
    if (visibleRoutes.length === 0) return null;

    const geod = Geodesic.WGS84;

    if (visibleRoutes.length === 1) {
      const r = visibleRoutes[0];
      if (r.segments.length === 0) return null;

      const inv = geod.Inverse(
        r.startPoint.latitude,
        r.startPoint.longitude,
        r.endPoint.latitude,
        r.endPoint.longitude
      );
      const bearing = inv.azi1 !== undefined ? (inv.azi1 + 360) % 360 : 0;

      const segDists = r.segments.map((s) => s.distanceMetres);
      const minSeg = Math.min(...segDists);
      const maxSeg = Math.max(...segDists);
      const avgSeg = r.totalDistanceMetres / r.segments.length;

      return {
        title: `${r.name} Overview`,
        totalM: formatDistanceMetres(r.totalDistanceMetres),
        totalKm: formatDistanceKilometres(r.totalDistanceMetres),
        avgM: `${avgSeg.toFixed(1)} m`,
        minM: `${minSeg.toFixed(1)} m`,
        maxM: `${maxSeg.toFixed(1)} m`,
        bearing: `${bearing.toFixed(2)}°`,
      };
    }

    // Combined across all visible routes
    const allSegments = visibleRoutes.flatMap((r) => r.segments);
    if (allSegments.length === 0) return null;

    const totalDist = visibleRoutes.reduce((sum, r) => sum + r.totalDistanceMetres, 0);
    const segDists = allSegments.map((s) => s.distanceMetres);
    const minSeg = Math.min(...segDists);
    const maxSeg = Math.max(...segDists);
    const avgSeg = totalDist / allSegments.length;

    const first = visibleRoutes[0];
    const last = visibleRoutes[visibleRoutes.length - 1];
    const inv = geod.Inverse(
      first.startPoint.latitude,
      first.startPoint.longitude,
      last.endPoint.latitude,
      last.endPoint.longitude
    );
    const bearing = inv.azi1 !== undefined ? (inv.azi1 + 360) % 360 : 0;

    return {
      title: 'Route Overview (All)',
      totalM: formatDistanceMetres(totalDist),
      totalKm: formatDistanceKilometres(totalDist),
      avgM: `${avgSeg.toFixed(1)} m`,
      minM: `${minSeg.toFixed(1)} m`,
      maxM: `${maxSeg.toFixed(1)} m`,
      bearing: `${bearing.toFixed(2)}°`,
    };
  }, [visibleRoutes]);

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
        if (onPointSelect) {
          adapter.onPointClick(onPointSelect);
        }
        // Automatically fit route immediately upon loading!
        setTimeout(() => {
          if (!isMounted || !adapterRef.current) return;
          if (visibleRoutes.length === 1) {
            adapterRef.current.fitRoute(visibleRoutes[0]);
          } else if (visibleRoutes.length > 1) {
            const renderData = visibleRoutes.map((r) => ({
              route: r,
              options: { strokeColor: ROUTE_COLORS[classifyRoute(r.name)] },
            }));
            adapterRef.current.renderMultipleRoutes(renderData, true);
          }
        }, 120);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Google Maps initialization failed:', err);
        setMapState('error');
        setErrorMessage(
          'Satellite map is temporarily unavailable. Your coordinate-derived measurement is still available.'
        );
      });

    return () => {
      isMounted = false;
      adapter.destroy();
    };
  }, [apiKey]);

  // Re-render ONLY visible routes when selection or available routes change
  useEffect(() => {
    if (!adapterRef.current?.isLoaded()) return;
    if (visibleRoutes.length === 0) {
      adapterRef.current.clear();
      return;
    }

    if (visibleRoutes.length > 1) {
      // Multi-route mode with classification colours
      const renderData = visibleRoutes.map((r) => {
        const cls = classifyRoute(r.name);
        return {
          route: r,
          options: {
            strokeColor: ROUTE_COLORS[cls],
            haloColor: '#FFFFFF',
            opacity: 0.95,
          } as RouteRenderOptions,
        };
      });

      adapterRef.current.renderMultipleRoutes(renderData, true);
    } else {
      // Single route mode — ONLY render this 1 route, other routes completely absent
      const singleRoute = visibleRoutes[0];
      const cls = classifyRoute(singleRoute.name);
      adapterRef.current.renderRoute(singleRoute, {
        strokeColor: ROUTE_COLORS[cls],
        haloColor: '#FFFFFF',
        opacity: 0.95,
      });
      adapterRef.current.fitRoute(singleRoute);
    }
  }, [visibleRoutes, mapState]);

  // Listen to Fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      setTimeout(() => adapterRef.current?.triggerResize(), 200);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Trigger resize on container size changes
  useEffect(() => {
    if (!mapWrapperRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      adapterRef.current?.triggerResize();
    });
    resizeObserver.observe(mapWrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const toggleMapType = (type: MapType) => {
    setCurrentMapType(type);
    adapterRef.current?.setMapType(type);
  };

  const handleFitRoute = () => {
    if (!adapterRef.current?.isLoaded()) return;
    if (visibleRoutes.length === 1) {
      adapterRef.current.fitRoute(visibleRoutes[0]);
    } else if (visibleRoutes.length > 1) {
      const renderData = visibleRoutes.map((r) => ({
        route: r,
        options: { strokeColor: ROUTE_COLORS[classifyRoute(r.name)] },
      }));
      adapterRef.current.renderMultipleRoutes(renderData, true);
    }
  };

  const toggleFullscreen = () => {
    if (!mapWrapperRef.current) return;

    if (!document.fullscreenElement) {
      mapWrapperRef.current.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable full-screen mode:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit full-screen mode:', err);
      });
    }
  };

  const handleSaveApiKey = () => {
    if (onApiKeyChange) {
      onApiKeyChange(inputKeyVal.trim());
    }
    setShowKeyInput(false);
  };

  // Filter button active checker
  const isFilterActive = (filterKey: string) => {
    if (filterKey === 'all') return selectedFilter === 'all';
    return (
      selectedFilter.toLowerCase() === filterKey.toLowerCase() ||
      visibleRoutes.some(
        (r) =>
          r.uid === selectedFilter &&
          (r.name.toLowerCase() === filterKey.toLowerCase() ||
            classifyRoute(r.name) === filterKey.toLowerCase())
      )
    );
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#14181f' : 'transparent',
    color: active ? '#ffffff' : '#4e5868',
    border: 'none',
    padding: '4px 11px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 36,
  });

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
      {/* ─── TOP RIGHT CONTROLS BAR ─── */}
      {mapState === 'loaded' && (
        <div className="rm-map-controls-bar">
          <button
            style={filterBtnStyle(currentMapType === 'satellite')}
            onClick={() => toggleMapType('satellite')}
          >
            Satellite
          </button>
          <button
            style={filterBtnStyle(currentMapType === 'hybrid')}
            onClick={() => toggleMapType('hybrid')}
          >
            Hybrid
          </button>
          <button
            style={filterBtnStyle(currentMapType === 'roadmap')}
            onClick={() => toggleMapType('roadmap')}
          >
            Map
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.12)', margin: '0 2px' }} />
          <button
            style={{ ...filterBtnStyle(false), display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={handleFitRoute}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 2V5M8 11V14M2 8H5M11 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Fit Route
          </button>
          <button
            style={{ ...filterBtnStyle(false), color: '#64748b' }}
            title="Configure Google Maps API Key"
            onClick={() => setShowKeyInput(!showKeyInput)}
          >
            🔑 Key
          </button>
        </div>
      )}

      {/* ─── ROUTE FILTER BUTTONS ON MAP (shown whenever multi-route exists) ─── */}
      {mapState === 'loaded' && availableRoutes.length > 1 && (
        <div className="rm-route-filter-bar">
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginRight: 6 }}>
            ROUTES
          </span>

          {/* ALL BUTTON */}
          <button
            style={filterBtnStyle(isFilterActive('all'))}
            onClick={() => onFilterChange('all')}
          >
            All
          </button>

          {/* DYNAMIC ROUTE BUTTONS (e.g. MV, LV) */}
          {hasBothTypes ? (
            <>
              <button
                style={{
                  ...filterBtnStyle(isFilterActive('mv')),
                  background: isFilterActive('mv') ? ROUTE_COLORS.mv : 'transparent',
                  color: isFilterActive('mv') ? '#ffffff' : '#4e5868',
                }}
                onClick={() => onFilterChange('mv')}
              >
                MV
              </button>
              <button
                style={{
                  ...filterBtnStyle(isFilterActive('lv')),
                  background: isFilterActive('lv') ? ROUTE_COLORS.lv : 'transparent',
                  color: isFilterActive('lv') ? '#0f172a' : '#4e5868',
                }}
                onClick={() => onFilterChange('lv')}
              >
                LV
              </button>
            </>
          ) : (
            availableRoutes.map((r) => {
              const cls = classifyRoute(r.name);
              const color = ROUTE_COLORS[cls];
              const active = isFilterActive(r.uid) || isFilterActive(r.name);
              return (
                <button
                  key={r.uid}
                  style={{
                    ...filterBtnStyle(active),
                    background: active ? color : 'transparent',
                    color: active && cls === 'lv' ? '#0f172a' : active ? '#ffffff' : '#4e5868',
                  }}
                  onClick={() => onFilterChange(r.uid)}
                >
                  {r.name}
                </button>
              );
            })
          )}

          {/* INLINE LEGEND */}
          <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#64748b' }}>
            {hasMV && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 14,
                    height: 3.5,
                    background: ROUTE_COLORS.mv,
                    borderRadius: 2,
                    display: 'inline-block',
                  }}
                />
                MV
              </span>
            )}
            {hasLV && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 14,
                    height: 3.5,
                    background: ROUTE_COLORS.lv,
                    borderRadius: 2,
                    display: 'inline-block',
                  }}
                />
                LV
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── FLOATING ROUTE OVERVIEW PANEL (TOP-LEFT OF MAP) ─── */}
      {routeStats && (
        <div className="rm-route-overview-panel">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#14181f', marginBottom: 10 }}>
            {routeStats.title}
          </div>

          <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Total Distance</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#14181f' }}>{routeStats.totalM}</div>
            <div style={{ fontSize: 11, color: '#4e5868', fontWeight: 600 }}>{routeStats.totalKm}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4e5868' }}>
              <span style={{ color: '#64748b' }}>Average Segment</span>
              <span style={{ fontWeight: 700, color: '#14181f' }}>{routeStats.avgM}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4e5868' }}>
              <span style={{ color: '#64748b' }}>Min Segment</span>
              <span style={{ fontWeight: 700, color: '#14181f' }}>{routeStats.minM}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4e5868' }}>
              <span style={{ color: '#64748b' }}>Max Segment</span>
              <span style={{ fontWeight: 700, color: '#14181f' }}>{routeStats.maxM}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4e5868' }}>
              <span style={{ color: '#64748b' }}>Bearing (Start → End)</span>
              <span style={{ fontWeight: 700, color: '#14181f' }}>{routeStats.bearing}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM LEFT CONTROL: Fullscreen Toggle ─── */}
      <div className="rm-map-bottom-left">
        <button onClick={toggleFullscreen} className="rm-map-fullscreen-btn">
          {isFullscreen ? (
            <>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M4 1v3H1M10 1v3h3M4 13v-3H1M10 13v-3h3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Exit Fullscreen
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 4V1h3M13 4V1h-3M1 10v3h3M13 10v3h-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Full Screen
            </>
          )}
        </button>
      </div>

      {/* ─── API KEY INPUT MODAL ─── */}
      {showKeyInput && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 14,
            zIndex: 20,
            background: '#0f172a',
            color: 'white',
            padding: 16,
            borderRadius: 10,
            width: 320,
            maxWidth: 'calc(100% - 28px)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            Google Maps API Key
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.4 }}>
            Enter your Google Cloud Maps API key to display official watermark-free tiles.
          </div>
          <input
            type="text"
            placeholder="AIzaSy..."
            value={inputKeyVal}
            onChange={(e) => setInputKeyVal(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #475569',
              background: '#1e293b',
              color: 'white',
              fontSize: 12,
              marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ color: '#cbd5e1' }}
              onClick={() => setShowKeyInput(false)}
            >
              Cancel
            </button>
            <button className="btn btn-sm btn-accent" onClick={handleSaveApiKey}>
              Save & Reload
            </button>
          </div>
        </div>
      )}

      {/* Map DOM Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading state */}
      {mapState === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0a1428',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 5,
          }}
        >
          <div
            className="spinner"
            style={{ width: 36, height: 36, borderColor: '#334155', borderTopColor: '#38bdf8' }}
          ></div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
            Loading Satellite Imagery...
          </div>
        </div>
      )}

      {/* Graceful Fallback overlay */}
      {mapState === 'error' && (
        <div
          className="map-fallback"
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0f172a',
            color: 'white',
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 32 }}>🛰️</div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: 15 }}>
            Satellite Map Visualization
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 360, lineHeight: 1.5 }}>
            {errorMessage}
          </div>
          {routeStats && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 18px',
                background: '#1e293b',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid #334155',
                color: '#38bdf8',
              }}
            >
              Route Distance: {routeStats.totalM} ({routeStats.totalKm})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
