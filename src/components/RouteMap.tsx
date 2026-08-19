import { useEffect, useRef, useState, useMemo } from 'react';
import type { MeasuredRoute, RoutePoint } from '../types/coordinates';
import { GoogleMapsAdapter } from '../mapping/GoogleMapsAdapter';
import type { MapType } from '../types/map';
import { Geodesic } from 'geographiclib-geodesic';
import { formatDistanceMetres, formatDistanceKilometres } from '../utils/formatters';

interface RouteMapProps {
  route: MeasuredRoute | null;
  onPointSelect?: (point: RoutePoint) => void;
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

export function RouteMap({ route, onPointSelect, apiKey, onApiKeyChange }: RouteMapProps) {
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<GoogleMapsAdapter | null>(null);

  const [mapState, setMapState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentMapType, setCurrentMapType] = useState<MapType>('satellite');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [inputKeyVal, setInputKeyVal] = useState<string>(apiKey || '');

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
        if (route) {
          adapter.renderRoute(route);
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

  // Re-render route when route changes
  useEffect(() => {
    if (adapterRef.current?.isLoaded() && route) {
      adapterRef.current.renderRoute(route);
    }
  }, [route]);

  // Listen to Fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
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

  return (
    <div
      ref={mapWrapperRef}
      className="map-container"
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '100%',
        minHeight: isFullscreen ? '100vh' : '560px',
        borderRadius: isFullscreen ? '0px' : '14px',
        overflow: 'hidden',
        background: '#0a1428',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* ─── TOP RIGHT CONTROLS BAR: Satellite / Hybrid / Map / Fit Route / Key ─── */}
      {mapState === 'loaded' && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(10, 20, 42, 0.82)',
            backdropFilter: 'blur(10px)',
            padding: '4px 6px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          <button
            style={{
              background: currentMapType === 'satellite' ? '#2563eb' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => toggleMapType('satellite')}
          >
            Satellite
          </button>
          <button
            style={{
              background: currentMapType === 'hybrid' ? '#2563eb' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => toggleMapType('hybrid')}
          >
            Hybrid
          </button>
          <button
            style={{
              background: currentMapType === 'roadmap' ? '#2563eb' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => toggleMapType('roadmap')}
          >
            Map
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
          <button
            style={{
              background: 'transparent',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={handleFitRoute}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 2V5M8 11V14M2 8H5M11 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Fit Route
          </button>
          <button
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              border: 'none',
              padding: '5px 8px',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
            title="Configure Google Maps API Key"
            onClick={() => setShowKeyInput(!showKeyInput)}
          >
            🔑 Key
          </button>
        </div>
      )}

      {/* ─── FLOATING ROUTE OVERVIEW PANEL (TOP-LEFT OF MAP) ─── */}
      {routeStats && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 10,
            background: 'rgba(9, 18, 38, 0.85)',
            backdropFilter: 'blur(12px)',
            color: 'white',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '12px 14px',
            minWidth: 175,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: 10,
            }}
          >
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
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          zIndex: 10,
          display: 'flex',
          gap: 6,
        }}
      >
        <button
          onClick={toggleFullscreen}
          style={{
            background: 'rgba(10, 20, 42, 0.82)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(25, 38, 68, 0.95)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(10, 20, 42, 0.82)')}
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
          width: 320, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid #334155'
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
