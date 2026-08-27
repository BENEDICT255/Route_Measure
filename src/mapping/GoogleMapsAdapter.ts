/**
 * Google Maps Adapter implementation.
 *
 * Implements MapAdapter for Google Maps JavaScript API.
 * Defaults to Satellite map type. Renders route polylines and markers.
 * Supports MV/LV multi-route rendering with contrast halos.
 *
 * Note: Distance calculations are NOT performed here.
 * The map is visualization-only.
 */

import type { MapAdapter, MapType, MarkerOptions } from '../types/map';
import type { RoutePoint, MeasuredRoute } from '../types/coordinates';

// Declare google global for TypeScript
declare global {
  interface Window {
    google?: any;
    __googleMapsCallback?: () => void;
  }
}

/** Route classification for visual rendering */
export type RouteClassification = 'mv' | 'lv' | 'unclassified';

/** Route rendering options */
export interface RouteRenderOptions {
  strokeColor?: string;
  haloColor?: string;
  opacity?: number;
}

/** Classify a route name as MV, LV, or unclassified */
export function classifyRoute(routeName: string): RouteClassification {
  const upper = routeName.toUpperCase();
  if (upper.includes('MV') || upper.includes('MEDIUM VOLTAGE') || upper.includes('MEDIUM_VOLTAGE')) {
    return 'mv';
  }
  if (upper.includes('LV') || upper.includes('LOW VOLTAGE') || upper.includes('LOW_VOLTAGE')) {
    return 'lv';
  }
  return 'unclassified';
}

/** Route colours by classification */
export const ROUTE_COLORS: Record<RouteClassification, string> = {
  mv: '#2F6BFF',
  lv: '#F4B942',
  unclassified: '#336DFF',
};

/** Script loading promise cache */
let googleMapsPromise: Promise<void> | null = null;

/**
 * Load Google Maps JavaScript API script.
 */
export function loadGoogleMapsApi(apiKey?: string): Promise<void> {
  if (googleMapsPromise) return googleMapsPromise;

  if (window.google?.maps) {
    googleMapsPromise = Promise.resolve();
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = '__googleMapsCallback';
    window[callbackName] = () => {
      resolve();
      delete window[callbackName];
    };

    const script = document.createElement('script');
    const keyParam = apiKey ? `key=${apiKey}&` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Google Maps JavaScript API failed to load.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export class GoogleMapsAdapter implements MapAdapter {
  private map: any = null;
  private polylines: any[] = [];
  private markers: any[] = [];
  private infoWindow: any = null;
  private pointClickCallback: ((point: RoutePoint) => void) | null = null;
  private loaded = false;

  async initialize(container: HTMLElement, apiKey?: string): Promise<void> {
    await loadGoogleMapsApi(apiKey);

    if (!window.google?.maps) {
      throw new Error('Google Maps API object not found.');
    }

    const defaultCenter = { lat: 0, lng: 0 };
    this.map = new window.google.maps.Map(container, {
      center: defaultCenter,
      zoom: 3,
      mapTypeId: window.google.maps.MapTypeId.SATELLITE,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: window.google.maps.ControlPosition.TOP_RIGHT,
        mapTypeIds: [
          window.google.maps.MapTypeId.SATELLITE,
          window.google.maps.MapTypeId.HYBRID,
          window.google.maps.MapTypeId.ROADMAP,
        ],
      },
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
    });

    this.infoWindow = new window.google.maps.InfoWindow();
    this.loaded = true;

    // Observe container for Google's dev warning modal and automatically dismiss / hide it
    const observer = new MutationObserver(() => {
      const dismissBtn = container.querySelector('.dismissButton') as HTMLButtonElement | null;
      if (dismissBtn) {
        dismissBtn.click();
      }
      const errContainer = container.querySelector('.gm-err-container') as HTMLElement | null;
      if (errContainer) {
        errContainer.style.display = 'none';
      }
      const moc = container.querySelector('.gm-style-moc') as HTMLElement | null;
      if (moc) {
        moc.style.display = 'none';
      }
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  renderRoute(route: MeasuredRoute, options?: RouteRenderOptions): void {
    if (!this.map || !window.google?.maps) return;

    this.clear();

    const path = route.points.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
    }));

    const strokeColor = options?.strokeColor || '#336DFF';
    const haloColor = options?.haloColor || '#FFFFFF';
    const opacity = options?.opacity ?? 0.9;

    // Contrast halo (wider under-stroke for visibility on satellite)
    const haloPolyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: haloColor,
      strokeOpacity: opacity * 0.4,
      strokeWeight: 7,
      map: this.map,
    });
    this.polylines.push(haloPolyline);

    // Main route line
    const mainPolyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor,
      strokeOpacity: opacity,
      strokeWeight: 4,
      map: this.map,
    });
    this.polylines.push(mainPolyline);

    // Render markers with optional color
    this.renderPoints(route.points, { color: strokeColor });

    // Fit bounds
    this.fitRoute(route);
  }

  /** Render multiple routes with individual colours and opacities */
  renderMultipleRoutes(
    routes: { route: MeasuredRoute; options: RouteRenderOptions }[],
    fitAll: boolean = true
  ): void {
    if (!this.map || !window.google?.maps) return;

    this.clear();

    const allBounds = new window.google.maps.LatLngBounds();

    routes.forEach(({ route, options }) => {
      const path = route.points.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
      }));

      const strokeColor = options?.strokeColor || '#336DFF';
      const haloColor = options?.haloColor || '#FFFFFF';
      const opacity = options?.opacity ?? 0.9;

      // Halo
      const halo = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: haloColor,
        strokeOpacity: opacity * 0.35,
        strokeWeight: 7,
        map: this.map,
      });
      this.polylines.push(halo);

      // Main line
      const main = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor,
        strokeOpacity: opacity,
        strokeWeight: 4,
        map: this.map,
      });
      this.polylines.push(main);

      // Markers
      this.renderRouteMarkers(route.points, strokeColor, opacity);

      // Accumulate bounds
      route.points.forEach((p) => {
        allBounds.extend({ lat: p.latitude, lng: p.longitude });
      });
    });

    if (fitAll && !allBounds.isEmpty()) {
      this.map.fitBounds(allBounds);
    }
  }

  /** Render markers for a specific route with colour */
  private renderRouteMarkers(points: RoutePoint[], routeColor: string, opacity: number = 1): void {
    if (!this.map || !window.google?.maps) return;

    points.forEach((point, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === points.length - 1;

      const color = isStart ? '#16A34A' : isEnd ? '#DC2626' : routeColor;

      const marker = new window.google.maps.Marker({
        position: { lat: point.latitude, lng: point.longitude },
        map: this.map,
        title: `${point.displayLabel} (Seq: ${point.sequenceIndex + 1})`,
        opacity: Math.max(opacity, 0.3),
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isStart || isEnd ? 7 : 5,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        if (this.pointClickCallback) {
          this.pointClickCallback(point);
        }

        const content = `
          <div style="font-family: sans-serif; padding: 4px; max-width: 220px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #0F172A;">
              ${escapeHtml(point.displayLabel)}
            </div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 2px;">
              <strong>Lat:</strong> ${point.latitude.toFixed(5)}
            </div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 2px;">
              <strong>Lon:</strong> ${point.longitude.toFixed(5)}
            </div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 2px;">
              <strong>Sequence:</strong> ${point.sequenceIndex + 1}
            </div>
            ${point.description ? `<div style="font-size: 12px; color: #475569; margin-top: 4px;"><strong>Desc:</strong> ${escapeHtml(point.description)}</div>` : ''}
          </div>
        `;

        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, marker);
      });

      this.markers.push(marker);
    });
  }

  renderPoints(points: RoutePoint[], options?: MarkerOptions & { color?: string }): void {
    if (!this.map || !window.google?.maps) return;

    // Clear existing markers
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];

    const routeColor = options?.color || '#2563EB';
    this.renderRouteMarkers(points, routeColor);
  }

  fitRoute(route: MeasuredRoute): void {
    if (!this.map || !window.google?.maps || route.points.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    route.points.forEach((p) => {
      bounds.extend({ lat: p.latitude, lng: p.longitude });
    });

    this.map.fitBounds(bounds);

    // Don't zoom in too close for 1-2 points
    if (route.points.length === 1) {
      this.map.setZoom(15);
    }
  }

  focusPoint(point: RoutePoint, zoom: number = 17): void {
    if (!this.map) return;
    this.map.setCenter({ lat: point.latitude, lng: point.longitude });
    this.map.setZoom(zoom);
  }

  setMapType(type: MapType): void {
    if (!this.map || !window.google?.maps) return;
    const typeId =
      type === 'satellite'
        ? window.google.maps.MapTypeId.SATELLITE
        : type === 'hybrid'
        ? window.google.maps.MapTypeId.HYBRID
        : window.google.maps.MapTypeId.ROADMAP;
    this.map.setMapTypeId(typeId);
  }

  triggerResize(): void {
    if (this.map && window.google?.maps) {
      window.google.maps.event.trigger(this.map, 'resize');
    }
  }

  clear(): void {
    this.polylines.forEach((p) => p.setMap(null));
    this.polylines = [];
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];
  }

  destroy(): void {
    this.clear();
    this.map = null;
    this.loaded = false;
  }

  getMap(): any {
    return this.map;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  onPointClick(callback: (point: RoutePoint) => void): void {
    this.pointClickCallback = callback;
  }

  setPointLabelsVisible(_visible: boolean): void {}
  setSegmentLabelsVisible(_visible: boolean): void {}

  highlightPoint(point: RoutePoint | null): void {
    if (!point || !this.map) return;
    this.focusPoint(point);
  }

  highlightSegment(_segmentIndex: number | null): void {}
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
