/**
 * Google Maps Adapter implementation.
 *
 * Implements MapAdapter for Google Maps JavaScript API.
 * Defaults to Satellite map type. Renders route polylines and markers.
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
  private polyline: any = null;
  private markers: any[] = [];
  private infoWindow: any = null;
  private container: HTMLElement | null = null;
  private pointClickCallback: ((point: RoutePoint) => void) | null = null;
  private loaded = false;

  async initialize(container: HTMLElement, apiKey?: string): Promise<void> {
    this.container = container;
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
      fullscreenControl: false, // We provide our own bottom-left fullscreen button
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

  renderRoute(route: MeasuredRoute): void {
    if (!this.map || !window.google?.maps) return;

    this.clear();

    const path = route.points.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
    }));

    // Draw route polyline
    this.polyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#336DFF',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map: this.map,
    });

    // Render markers
    this.renderPoints(route.points);

    // Fit bounds
    this.fitRoute(route);
  }

  renderPoints(points: RoutePoint[], options?: MarkerOptions): void {
    if (!this.map || !window.google?.maps) return;

    // Clear existing markers
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];

    points.forEach((point, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === points.length - 1;

      // Custom marker icon colors
      const color = isStart ? '#16A34A' : isEnd ? '#DC2626' : '#2563EB';

      const marker = new window.google.maps.Marker({
        position: { lat: point.latitude, lng: point.longitude },
        map: this.map,
        title: `${point.displayLabel} (Seq: ${point.sequenceIndex + 1})`,
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

        const cumDist = routeCumDistances.get(point.uid) || 0;

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

  clear(): void {
    if (this.polyline) {
      this.polyline.setMap(null);
      this.polyline = null;
    }
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];
  }

  destroy(): void {
    this.clear();
    this.map = null;
    this.loaded = false;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  onPointClick(callback: (point: RoutePoint) => void): void {
    this.pointClickCallback = callback;
  }

  setPointLabelsVisible(visible: boolean): void {
    // Can toggle marker label visibility if needed
  }

  setSegmentLabelsVisible(visible: boolean): void {}

  highlightPoint(point: RoutePoint | null): void {
    if (!point || !this.map) return;
    this.focusPoint(point);
  }

  highlightSegment(segmentIndex: number | null): void {}
}

const routeCumDistances = new Map<string, number>();

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
