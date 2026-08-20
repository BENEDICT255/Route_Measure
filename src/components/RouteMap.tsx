import { useEffect, useRef, useState, useMemo } from 'react';
import type { MeasuredRoute, RoutePoint } from '../types/coordinates';
import { GoogleMapsAdapter, classifyRoute, ROUTE_COLORS } from '../mapping/GoogleMapsAdapter';
import type { RouteClassification, RouteRenderOptions } from '../mapping/GoogleMapsAdapter';
import type { MapType } from '../types/map';
import { Geodesic } from 'geographiclib-geodesic';
import { formatDistanceMetres, formatDistanceKilometres } from '../utils/formatters';

type RouteFilter = 'all' | 'mv' | 'lv';

interface RouteMapProps {
  route: MeasuredRoute | null;
  allRoutes?: MeasuredRoute[];
  onPointSelect?: (point: RoutePoint) => void;
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

export function RouteMap({ route, allRoutes, onPointSelect, apiKey, onApiKeyChange }: RouteMapProps) {
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<GoogleMapsAdapter | null>(null);

  const [mapState, setMapState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentMapType, setCurrentMapType] = useState<MapType>('satellite');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [inputKeyVal, setInputKeyVal] = useState<string>(apiKey || '');
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all');

  // Classify routes
  const routeClassifications = useMemo(() => {
    const routes = allRoutes || (route ? [route] : []);
    return routes.map(r => ({
      route: r,
      classification: classifyRoute(r.name),
    }));
  }, [allRoutes, route]);

  const hasMV = routeClassifications.some(r => r.classification === 'mv');
  const hasLV = routeClassifications.some(r => r.classification === 'lv');
  const hasBothTypes = hasMV && hasLV;

  // Dynamic Route Overview statistics
  const routeStats = useMemo(() => {
    if (!route || route.segments.length === 0) return null;

    const geod = Geodesic.WGS84;
    const inv = geod.Inverse(
      route.startPoint.latitude,
      route.startPoint.longitude,
      route.endPoint.latitude,
      route.endPoint.longitude
    );
    const bearing = inv.azi1 !== undefined ? (inv.azi1 + 360) % 360 : 0;

    const segDists = route.segments.map((s) => s.distanceMetres);
    const minSeg = Math.min(...segDists);
    const maxSeg = Math.max(...segDists);
    const avgSeg = route.totalDistanceMetres / route.segments.length;

    return {
      totalM: formatDistanceMetres(route.totalDistanceMetres),
      totalKm: formatDistanceKilometres(route.totalDistanceMetres),
      avgM: `${avgSeg.toFixed(1)} m`,
      minM: `${minSeg.toFixed(1)} m`,
      maxM: `${maxSeg.toFixed(1)} m`,
      bearing: `${bearing.toFixed(2)}°`,
    };
  }, [route]);

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

  // Re-render routes when route/filter changes
  useEffect(() => {
    if (!adapterRef.current?.isLoaded()) return;

    const routes = allRoutes || (route ? [route] : []);
    if (routes.length === 0) return;

    if (hasBothTypes && routes.length > 1) {
      // Multi-route mode with MV/LV classification
      const renderData = routes.map(r => {
        const cls = classifyRoute(r.name);
        const isActive = routeFilter === 'all' || routeFilter === cls;
        return {
          route: r,
          options: {
            strokeColor: ROUTE_COLORS[cls],
            haloColor: '#FFFFFF',
            opacity: isActive ? 0.9 : 0.18,
          } as RouteRenderOptions,
        };
      });

      adapterRef.current.renderMultipleRoutes(renderData, true);
    } else if (route) {
      // Single route mode
      const cls = classifyRoute(route.name);
      adapterRef.current.renderRoute(route, {
        strokeColor: ROUTE_COLORS[cls],
        haloColor: '#FFFFFF',
        opacity: 0.9,
      });
    }
  }, [route, allRoutes, routeFilter, hasBothTypes]);

  // Listen to Fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      // Trigger map resize after fullscreen transition
      setTimeout(() => adapterRef.current?.triggerResize(), 200);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Trigger resize on container size changes (orientation, layout reflow)
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
    if (route && adapterRef.current?.isLoaded()) {
      adapterRef.current.fitRoute(route);
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

  // Segmented filter button style
  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#2563eb' : 'transparent',
    color: 'white',
    border: 'none',
    padding: '4px 10px',
    borderRadius: 5,
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
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
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
            style={{ ...filterBtnStyle(false), color: 'rgba(255,255,255,0.7)' }}
            title="Configure Google Maps API Key"
            onClick={() => setShowKeyInput(!showKeyInput)}
          >
            🔑 Key
          </button>
        </div>
      )}

      {/* ─── MV/LV ROUTE FILTER (only when both types exist) ─── */}
      {mapState === 'loaded' && hasBothTypes && (
        <div className="rm-route-filter-bar">
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', marginRight: 6 }}>
            ROUTES
          </span>
          <button style={filterBtnStyle(routeFilter === 'all')} onClick={() => setRouteFilter('all')}>All</button>
          <button
            style={{
              ...filterBtnStyle(routeFilter === 'mv'),
              background: routeFilter === 'mv' ? ROUTE_COLORS.mv : 'transparent',
            }}
            onClick={() => setRouteFilter('mv')}
          >
            MV
          </button>
          <button
            style={{
              ...filterBtnStyle(routeFilter === 'lv'),
              background: routeFilter === 'lv' ? ROUTE_COLORS.lv : 'transparent',
              color: routeFilter === 'lv' ? '#0f172a' : 'white',
            }}
            onClick={() => setRouteFilter('lv')}
          >
            LV
          </button>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
          {/* Inline legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#cbd5e1' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 14, height: 3, background: ROUTE_COLORS.mv, borderRadius: 2, display: 'inline-block' }} />
              MV
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 14, height: 3, background: ROUTE_COLORS.lv, borderRadius: 2, display: 'inline-block' }} />
              LV
            </span>
          </div>
        </div>
      )}

      {/* ─── FLOATING ROUTE OVERVIEW PANEL (TOP-LEFT OF MAP) ─── */}
      {routeStats && (
        <div className="rm-route-overview-panel">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 10 }}>
            Route Overview
          </div>

          <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Total Distance</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{routeStats.totalM}</div>
            <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 500 }}>{routeStats.totalKm}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
              <span style={{ color: '#94a3b8' }}>Average Segment</span>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{routeStats.avgM}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
              <span style={{ color: '#94a3b8' }}>Min Segment</span>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{routeStats.minM}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
              <span style={{ color: '#94a3b8' }}>Max Segment</span>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{routeStats.maxM}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
              <span style={{ color: '#94a3b8' }}>Bearing (Start → End)</span>
              <span style={{ fontWeight: 600, color: '#60a5fa' }}>{routeStats.bearing}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM LEFT CONTROL: Fullscreen Toggle ─── */}
      <div className="rm-map-bottom-left">
        <button
          onClick={toggleFullscreen}
          className="rm-map-fullscreen-btn"
        >
          {isFullscreen ? (
            <>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M4 1v3H1M10 1v3h3M4 13v-3H1M10 13v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Exit Fullscreen
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M1 4V1h3M13 4V1h-3M1 10v3h3M13 10v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Full Screen
            </>
          )}
        </button>
      </div>

      {/* ─── API KEY INPUT MODAL ─── */}
      {showKeyInput && (
        <div style={{
          position: 'absolute', top: 52, right: 14, zIndex: 20,
          background: '#0f172a', color: 'white', padding: 16, borderRadius: 10,
          width: 320, maxWidth: 'calc(100% - 28px)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid #334155'
        }}>
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
              width: '100%', padding: '6px 10px', borderRadius: 6,
              border: '1px solid #475569', background: '#1e293b',
              color: 'white', fontSize: 12, marginBottom: 10
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
            <button
              className="btn btn-sm btn-accent"
              onClick={handleSaveApiKey}
            >
              Save & Reload
            </button>
          </div>
        </div>
      )}

      {/* Map DOM Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading state */}
      {mapState === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#0a1428',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, zIndex: 5
        }}>
          <div className="spinner" style={{ width: 36, height: 36, borderColor: '#334155', borderTopColor: '#38bdf8' }}></div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Loading Satellite Imagery...</div>
        </div>
      )}

      {/* Graceful Fallback overlay */}
      {mapState === 'error' && (
        <div className="map-fallback" style={{ position: 'absolute', inset: 0, background: '#0f172a', color: 'white', zIndex: 5 }}>
          <div style={{ fontSize: 32 }}>🛰️</div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: 15 }}>Satellite Map Visualization</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 360, lineHeight: 1.5 }}>
            {errorMessage}
          </div>
          {route && (
            <div style={{
              marginTop: 12, padding: '10px 18px', background: '#1e293b',
              borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid #334155', color: '#38bdf8'
            }}>
              Route Distance: {route.totalDistanceMetres.toFixed(1)} m ({(route.totalDistanceMetres / 1000).toFixed(4)} km)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
